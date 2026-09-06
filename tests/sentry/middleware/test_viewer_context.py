from __future__ import annotations

import base64
from typing import cast
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, override_settings
from rest_framework.request import Request

from sentry.auth.services.auth import AuthenticatedToken
from sentry.middleware.auth import AuthenticationMiddleware
from sentry.middleware.viewer_context import ViewerContextMiddleware, _viewer_context_from_request
from sentry.seer import agent_token
from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    encode_viewer_context,
    get_viewer_context,
)


def _craft_jwt_with_header(header: dict) -> str:
    """Build a JWT-shaped string with an attacker-controlled JOSE header.

    `get_unverified_header` reads only the header segment and runs PyJWT's
    `_validate_kid` / `_validate_crit` on it before returning, so a non-string
    `kid` or an unsupported `crit` value raises `InvalidTokenError` from inside
    `viewer_context_from_header` — without ever verifying the signature.
    """
    encoded_header = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    encoded_payload = base64.urlsafe_b64encode(b"{}").rstrip(b"=").decode()
    return f"{encoded_header}.{encoded_payload}.sig"


class ViewerContextFromRequestTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    def test_anonymous_request(self):
        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id is None
        assert ctx.organization_id is None
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is None

    def test_session_authenticated_user(self):
        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id is None
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is None

    def test_token_authenticated_user(self):
        request = self.factory.get("/")
        token = AuthenticatedToken(
            allowed_origins=["*"],
            scopes=["org:read"],
            entity_id=1,
            kind="api_token",
            user_id=self.user.id,
            organization_id=self.organization.id,
        )
        request.user = self.user
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id == self.organization.id
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is token

    def test_org_scoped_token_without_user(self):
        request = self.factory.get("/")
        request.user = AnonymousUser()
        token = AuthenticatedToken(
            allowed_origins=[],
            scopes=["org:read"],
            entity_id=1,
            kind="org_auth_token",
            organization_id=self.organization.id,
        )
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id is None
        assert ctx.organization_id == self.organization.id
        assert ctx.token is token

    def test_token_without_organization(self):
        request = self.factory.get("/")
        token = AuthenticatedToken(
            allowed_origins=[],
            scopes=["org:read"],
            entity_id=1,
            kind="api_token",
            user_id=self.user.id,
        )
        request.user = self.user
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id is None
        assert ctx.token is token


class ViewerContextMiddlewareTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=False)
    def test_skipped_when_disabled(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        assert captured[0] is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_sets_context_during_request(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        assert captured[0] is not None
        assert captured[0].user_id == self.user.id

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_cleans_up_after_request(self):
        middleware = ViewerContextMiddleware(lambda r: MagicMock(status_code=200))

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert get_viewer_context() is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_cleans_up_on_exception(self):
        def get_response(request):
            raise RuntimeError("boom")

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        try:
            middleware(request)
        except RuntimeError:
            pass

        assert get_viewer_context() is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_anonymous_request_sets_empty_context(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx is not None
        assert ctx.user_id is None
        assert ctx.organization_id is None
        assert ctx.token is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_agent_token_sets_agent_context(self):
        # Through the real chain: AuthenticationMiddleware resolves the agent bearer,
        # then this middleware derives user + org + agent actor from it.
        token, _ = agent_token.encode_agent_token(
            user_id=self.user.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            session_id="s1",
        )

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        request = self.factory.get("/api/0/organizations/", HTTP_AUTHORIZATION=f"Bearer {token}")
        with self.feature(agent_token.FEATURE_FLAG):
            AuthenticationMiddleware(lambda r: MagicMock(status_code=200)).process_request(
                cast(Request, request)
            )
        ViewerContextMiddleware(get_response)(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx is not None
        assert ctx.user_id == self.user.id
        assert ctx.organization_id == self.organization.id
        assert ctx.actor_type is ActorType.AGENT
        assert ctx.token is not None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_jwt_header_sets_viewer_context(self):
        vc = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx is not None
        assert ctx.organization_id == 42
        assert ctx.user_id == 7
        assert ctx.actor_type == ActorType.INTEGRATION

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_authenticated_user_takes_precedence_over_jwt(self):
        vc = ViewerContext(organization_id=99, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id == self.user.id
        assert ctx.actor_type == ActorType.USER

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_jwt_used_when_no_authenticated_user(self):
        vc = ViewerContext(organization_id=99, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.organization_id == 99
        assert ctx.actor_type == ActorType.INTEGRATION
        assert ctx.user_id is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    @patch("sentry.middleware.viewer_context.logger")
    def test_logs_warning_on_jwt_request_mismatch(self, mock_logger):
        vc = ViewerContext(organization_id=99, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)

        middleware = ViewerContextMiddleware(lambda r: MagicMock(status_code=200))

        token_auth = AuthenticatedToken(
            allowed_origins=[],
            scopes=["org:read"],
            entity_id=1,
            kind="org_auth_token",
            organization_id=self.organization.id,
        )
        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        request.user = self.user
        request.auth = token_auth

        middleware(request)

        mock_logger.error.assert_called_once_with(
            "viewer_context.jwt_request_mismatch",
            extra={
                "jwt_org_id": 99,
                "request_org_id": self.organization.id,
            },
        )

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_invalid_jwt_falls_back_to_request_user(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT="invalid.jwt.token")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id == self.user.id
        assert ctx.actor_type is ActorType.USER

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_malformed_kid_jwt_falls_back_to_request_user(self):
        # A header whose JOSE header has a non-string `kid` raises
        # InvalidTokenError (not DecodeError) from `get_unverified_header`.
        # The middleware must treat it as "not a viewer-context JWT" and fall
        # back to the request user rather than raising a 500.
        response_holder: list = []
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            mock_response = MagicMock(status_code=200)
            response_holder.append(mock_response)
            return mock_response

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get(
            "/", HTTP_X_VIEWER_CONTEXT=_craft_jwt_with_header({"alg": "HS256", "kid": 12345})
        )
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id == self.user.id
        assert ctx.actor_type is ActorType.USER
        assert response_holder[0].status_code == 200

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_malformed_jwt_anonymous_does_not_raise(self):
        # The bug's reachability claim: the malformed-header check happens
        # before any auth/output gate, so an UNAUTHENTICATED request reaches
        # `is_jwt_viewer_context`. It must still not raise (no 500) and fall
        # back to the empty request context.
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get(
            "/", HTTP_X_VIEWER_CONTEXT=_craft_jwt_with_header({"alg": "HS256", "kid": 12345})
        )
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id is None
        assert ctx.organization_id is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_raw_json_without_signature_falls_back(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get(
            "/",
            HTTP_X_VIEWER_CONTEXT='{"actor_type": "integration", "organization_id": 42}',
        )
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id == self.user.id
        assert ctx.actor_type == ActorType.USER

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_non_jwt_header_ignored(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get(
            "/",
            HTTP_X_VIEWER_CONTEXT='{"actor_type": "integration", "organization_id": 42}',
        )
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id is None
        assert ctx.organization_id is None
