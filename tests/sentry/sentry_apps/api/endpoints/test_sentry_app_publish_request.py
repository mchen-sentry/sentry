from unittest import mock

from django.urls import reverse

from sentry.constants import SentryAppStatus
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test

QUESTIONNAIRE = [
    {"question": "First question", "answer": "First response"},
    {"question": "Second question", "answer": "Second response"},
]


@control_silo_test
class SentryAppPublishRequestTest(APITestCase):
    def upload_logo(self) -> None:
        SentryAppAvatar.objects.create(sentry_app=self.sentry_app, avatar_type=1, color=True)

    def upload_issue_link_logo(self) -> None:
        SentryAppAvatar.objects.create(sentry_app=self.sentry_app, avatar_type=1, color=False)

    def setUp(self) -> None:
        # create user as superuser
        self.user = self.create_user(email="boop@example.com", is_superuser=True)
        self.org = self.create_organization(owner=self.user, name="My Org")
        self.project = self.create_project(organization=self.org)
        self.sentry_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            schema={"elements": [self.create_issue_link_schema()]},
        )
        self.url = reverse("sentry-api-0-sentry-app-publish-request", args=[self.sentry_app.slug])
        self.login_as(user=self.user)

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_request(self, send: mock.MagicMock) -> None:
        self.upload_logo()
        self.upload_issue_link_logo()
        send.return_value = 2
        response = self.client.post(self.url, format="json", data={"questionnaire": QUESTIONNAIRE})
        assert response.status_code == 201
        send.assert_called_with(to=["integrations-platform@sentry.io", self.user.email])
        self.sentry_app.refresh_from_db()
        assert self.sentry_app.status == SentryAppStatus.PUBLISH_REQUEST_INPROGRESS

    def _assert_retry_succeeds(self, send: mock.MagicMock) -> None:
        send.reset_mock()
        send.side_effect = None
        send.return_value = 2
        retry_response = self.client.post(
            self.url, format="json", data={"questionnaire": QUESTIONNAIRE}
        )
        assert retry_response.status_code == 201
        self.sentry_app.refresh_from_db()
        assert self.sentry_app.status == SentryAppStatus.PUBLISH_REQUEST_INPROGRESS

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_request_email_fails(self, send: mock.MagicMock) -> None:
        send.return_value = 0
        self.upload_logo()
        self.upload_issue_link_logo()
        response = self.client.post(self.url, format="json", data={"questionnaire": QUESTIONNAIRE})
        assert response.status_code == 500
        assert response.data == {
            "detail": "Something went wrong trying to send publish confirmation email"
        }
        send.assert_called_with(to=["integrations-platform@sentry.io", self.user.email])
        # A failed email send must not wedge the app in the in-progress state: the status is
        # reverted to UNPUBLISHED so the same admin can retry.
        self.sentry_app.refresh_from_db()
        assert self.sentry_app.status == SentryAppStatus.UNPUBLISHED
        self._assert_retry_succeeds(send)

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_request_email_send_raises(self, send: mock.MagicMock) -> None:
        send.side_effect = Exception("smtp boom")
        self.upload_logo()
        self.upload_issue_link_logo()
        response = self.client.post(self.url, format="json", data={"questionnaire": QUESTIONNAIRE})
        # An unhandled exception out of the email send is surfaced as a 500 by the framework,
        # and the in-progress status must be reverted so the request can be retried instead of
        # wedging the app.
        assert response.status_code == 500
        self.sentry_app.refresh_from_db()
        assert self.sentry_app.status == SentryAppStatus.UNPUBLISHED
        self._assert_retry_succeeds(send)

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_request_invalid_questionnaire_keeps_unpublished(
        self, send: mock.MagicMock
    ) -> None:
        self.upload_logo()
        self.upload_issue_link_logo()
        # Missing required "questionnaire" field fails serializer validation.
        response = self.client.post(self.url, format="json", data={})
        assert response.status_code == 400
        send.assert_not_called()
        # A failed validation must not persist the in-progress status, so the admin can retry.
        self.sentry_app.refresh_from_db()
        assert self.sentry_app.status == SentryAppStatus.UNPUBLISHED
        self._assert_retry_succeeds(send)

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_already_published(self, send_mail: mock.MagicMock) -> None:
        self.sentry_app.update(status=SentryAppStatus.PUBLISHED)
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "Cannot publish already published integration."
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_internal(self, send_mail: mock.MagicMock) -> None:
        self.sentry_app.update(status=SentryAppStatus.INTERNAL)
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "Cannot publish internal integration."
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_no_logo(self, send_mail: mock.MagicMock) -> None:
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "Must upload a logo for the integration."
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_no_issue_link_logo(self, send_mail: mock.MagicMock) -> None:
        """Test that you cannot submit a publication request for an issue link
        integration without having uploaded a black icon."""
        self.upload_logo()
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert (
            response.data["detail"]
            == "Must upload an icon for issue and stack trace linking integrations."
        )
        send_mail.asssert_not_called()

    @mock.patch("sentry.utils.email.message_builder.MessageBuilder.send")
    def test_publish_no_stacktrace_link_logo(self, send_mail: mock.MagicMock) -> None:
        """Test that you cannot submit a publication request for a stacktrace link
        integration without having uploaded a black icon."""
        stacktrace_link_sentry_app = self.create_sentry_app(
            name="Meowin",
            organization=self.org,
            schema={"elements": [self.create_stacktrace_link_schema()]},
        )
        SentryAppAvatar.objects.create(
            sentry_app=stacktrace_link_sentry_app, avatar_type=1, color=True
        )
        url = reverse(
            "sentry-api-0-sentry-app-publish-request", args=[stacktrace_link_sentry_app.slug]
        )
        response = self.client.post(url, format="json")
        assert response.status_code == 400
        assert (
            response.data["detail"]
            == "Must upload an icon for issue and stack trace linking integrations."
        )
        send_mail.asssert_not_called()

    def test_cannot_publish_by_manager(self) -> None:
        self.user_manager = self.create_user("manager@example.com", is_superuser=False)
        self.create_member(user=self.user_manager, organization=self.org, role="manager", teams=[])
        self.login_as(self.user_manager)

        url = reverse("sentry-api-0-sentry-app-publish-request", args=[self.sentry_app.slug])
        response = self.client.post(url, format="json")
        assert response.status_code == 403
