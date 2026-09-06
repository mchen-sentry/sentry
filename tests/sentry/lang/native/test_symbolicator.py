import copy
from unittest.mock import MagicMock, patch

import pytest

from sentry.lang.native.sources import (
    get_sources_for_project,
    redact_internal_sources,
    reverse_aliases_map,
)
from sentry.lang.native.symbolicator import (
    Symbolicator,
    SymbolicatorFunction,
    SymbolicatorSession,
    SymbolicatorTaskKind,
)
from sentry.testutils.helpers import Feature
from sentry.testutils.pytest.fixtures import django_db_all

CUSTOM_SOURCE_CONFIG = """
[{
    "type": "http",
    "id": "custom",
    "layout": {"type": "symstore"},
    "url": "https://msdl.microsoft.com/download/symbols/"
},{
    "type": "appStoreConnect",
    "id": "asc",
    "name": "appconnect-disabled",
    "appconnectIssuer": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "appconnectKey": "foobar",
    "appconnectPrivateKey": "quux",
    "appName": "test",
    "appId": "test",
    "bundleId": "test"
}]
"""


@django_db_all
def test_sources_builtin(default_project) -> None:
    features = {"organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["microsoft"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    # XXX: The order matters here! Project is always first, then builtin sources
    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project", "sentry:microsoft"]


# Test that a builtin source that is not declared in SENTRY_BUILTIN_SOURCES does
# not lead to an error. It should simply be ignored.
@django_db_all
def test_sources_builtin_unknown(default_project) -> None:
    features = {"organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["invalid"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project"]


@django_db_all
def test_sources_custom(default_project) -> None:
    features = {"organizations:custom-symbol-sources": True}

    # Remove builtin sources explicitly to avoid defaults
    default_project.update_option("sentry:builtin_symbol_sources", [])
    default_project.update_option("sentry:symbol_sources", CUSTOM_SOURCE_CONFIG)

    with Feature(features):
        sources = get_sources_for_project(default_project)

    # XXX: The order matters here! Project is always first, then custom sources
    # The appStoreConnect source should be filtered out.
    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project", "custom"]


# Test that previously saved custom sources are not returned if the feature for
# custom sources is missing at query time.
@django_db_all
def test_sources_custom_disabled(default_project) -> None:
    features = {"organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", [])
    default_project.update_option("sentry:symbol_sources", CUSTOM_SOURCE_CONFIG)

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project"]


class TestInternalSourcesRedaction:
    def test_custom_untouched(self) -> None:
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "custom",
                "location": "http://example.net/prefix/path",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        assert response["modules"][0]["candidates"] == candidates

    def test_location_debug_id(self) -> None:
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [{"source": "sentry:microsoft", "download": {"status": "ok"}}]
        assert response["modules"][0]["candidates"] == expected

    def test_notfound_deduplicated(self) -> None:
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "notfound"},
            },
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path1",
                "download": {"status": "notfound"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [{"source": "sentry:microsoft", "download": {"status": "notfound"}}]
        assert response["modules"][0]["candidates"] == expected

    def test_notfound_omitted(self) -> None:
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "notfound"},
            },
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path1",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [{"source": "sentry:microsoft", "download": {"status": "ok"}}]
        assert response["modules"][0]["candidates"] == expected

    def test_multiple_notfound_filtered(self) -> None:
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "notfound"},
            },
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path1",
                "download": {"status": "ok"},
            },
            {
                "source": "sentry:apple",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "notfound"},
            },
            {
                "source": "sentry:apple",
                "location": "http://microsoft.com/prefix/path1",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [
            {"source": "sentry:microsoft", "download": {"status": "ok"}},
            {"source": "sentry:apple", "download": {"status": "ok"}},
        ]
        assert response["modules"][0]["candidates"] == expected

    def test_sentry_project(self) -> None:
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:project",
                "location": "sentry://project_debug_file/123",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [
            {
                "source": "sentry:project",
                "location": "sentry://project_debug_file/123",
                "download": {"status": "ok"},
            },
        ]
        assert response["modules"][0]["candidates"] == expected

    def test_sentry_project_notfound_no_location(self) -> None:
        # For sentry:project status=notfound the location needs to be removed
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:project",
                "location": "Not the locacation you are looking for",
                "download": {"status": "notfound"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [{"source": "sentry:project", "download": {"status": "notfound"}}]
        assert response["modules"][0]["candidates"] == expected


class TestAliasReversion:
    @pytest.fixture
    def builtin_sources(self):
        return {
            "ios": {
                "id": "sentry:ios",
                "name": "Apple",
                "type": "alias",
                "sources": ["ios-source", "tvos-source"],
            },
            "ios-source": {
                "id": "sentry:ios-source",
                "name": "iOS",
                "type": "gcs",
            },
            "tvos-source": {
                "id": "sentry:tvos-source",
                "name": "TvOS",
                "type": "gcs",
            },
        }

    def test_reverse_aliases(self, builtin_sources) -> None:
        reverse_aliases = reverse_aliases_map(builtin_sources)
        expected = {"sentry:ios-source": "sentry:ios", "sentry:tvos-source": "sentry:ios"}
        assert reverse_aliases == expected


def _ok_response() -> MagicMock:
    response = MagicMock()
    response.status_code = 200
    response.ok = True
    response.json.return_value = {"status": "completed"}
    response.content = b"{}"
    response.text = "{}"
    return response


def _session_with_mocked_http(url: str) -> SymbolicatorSession:
    session = SymbolicatorSession(url=url, project_id="1", event_id="event", timeout=1)
    session.session = MagicMock()
    session.session.request.return_value = _ok_response()
    return session


class TestSymbolicatorSessionRequestUrlBuilding:
    def test_create_task_preserves_path_prefix(self) -> None:
        session = _session_with_mocked_http("http://proxy:8080/symbolicator/")
        session.create_task("symbolicate", json={"stacktraces": []})

        method, url = session.session.request.call_args.args
        assert method == "post"
        assert url == "http://proxy:8080/symbolicator/symbolicate"

    def test_query_task_preserves_path_prefix_for_polling(self) -> None:
        session = _session_with_mocked_http("http://proxy:8080/symbolicator/")
        session.query_task("abc-123")

        method, url = session.session.request.call_args.args
        assert method == "get"
        assert url == "http://proxy:8080/symbolicator/requests/abc-123"

    @pytest.mark.parametrize("base_url", ["http://127.0.0.1:3021", "http://127.0.0.1:3021/"])
    def test_default_host_port_base_url_unaffected(self, base_url: str) -> None:
        session = _session_with_mocked_http(base_url)
        session.create_task("symbolicate", json={"stacktraces": []})

        _, url = session.session.request.call_args.args
        assert url == "http://127.0.0.1:3021/symbolicate"

    def test_prefix_without_trailing_slash_replaces_last_segment_per_rfc(self) -> None:
        session = _session_with_mocked_http("http://proxy:8080/symbolicator")
        session.create_task("symbolicate", json={"stacktraces": []})

        _, url = session.session.request.call_args.args
        assert url == "http://proxy:8080/symbolicate"


@django_db_all
class TestSymbolicatorBaseUrlConstruction:
    def _make_symbolicator(self, default_project) -> Symbolicator:
        return Symbolicator(
            SymbolicatorTaskKind(SymbolicatorFunction.native),
            lambda: None,
            default_project,
            "00000000000000000000000000000000",
        )

    @pytest.mark.parametrize(
        ("url", "expected_base_url"),
        [
            ("http://127.0.0.1:3021", "http://127.0.0.1:3021"),
            ("http://127.0.0.1:3021/", "http://127.0.0.1:3021/"),
            ("http://proxy:8080/symbolicator/", "http://proxy:8080/symbolicator/"),
            ("http://proxy:8080/symbolicator", "http://proxy:8080/symbolicator"),
        ],
    )
    def test_base_url_preserves_trailing_slash(
        self, url, expected_base_url, default_project, set_sentry_option
    ) -> None:
        with set_sentry_option("symbolicator.options", {"url": url}):
            symbolicator = self._make_symbolicator(default_project)

        assert symbolicator.base_url == expected_base_url

    @pytest.mark.parametrize("url", ["", "/", "//"])
    def test_rejects_degenerate_url(self, url, default_project, set_sentry_option) -> None:
        with set_sentry_option("symbolicator.options", {"url": url}):
            with pytest.raises(AssertionError):
                self._make_symbolicator(default_project)


@django_db_all
class TestSymbolicatorRequestUrlEndToEnd:
    def test_process_preserves_prefix_in_request_url(
        self, default_project, set_sentry_option
    ) -> None:
        mock_session = MagicMock()
        mock_session.request.return_value = _ok_response()
        with (
            patch("sentry.lang.native.symbolicator.Session", return_value=mock_session),
            set_sentry_option("symbolicator.options", {"url": "http://proxy:8080/symbolicator/"}),
        ):
            symbolicator = Symbolicator(
                SymbolicatorTaskKind(SymbolicatorFunction.native),
                lambda: None,
                default_project,
                "00000000000000000000000000000000",
            )
            symbolicator._process(
                "symbolicate_stacktraces",
                "symbolicate",
                json={"stacktraces": []},
            )

        method, url = mock_session.request.call_args.args
        assert method == "post"
        assert url == "http://proxy:8080/symbolicator/symbolicate"
