from copy import deepcopy
from typing import Any
from unittest import TestCase, mock

import pytest

from sentry.conf.server import FALL_2025_GROUPING_CONFIG, WINTER_2023_GROUPING_CONFIG
from sentry.grouping.api import get_default_grouping_config_dict, load_grouping_config
from sentry.services import eventstore
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping


def _get_context_lines(event_data: dict[str, Any]) -> list[str]:
    frames = event_data["exception"]["values"][0]["stacktrace"]["frames"]
    return [frame["context_line"] for frame in frames]


class PythonMultiprocessingContextLineTest(TestCase):
    POSIX_MULTIPROCESSING_CONTEXT_LINE = (
        "from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=11, pipe_handle=21)"
    )
    WINDOWS_MULTIPROCESSING_CONTEXT_LINE = (
        "from multiprocessing.spawn import spawn_main; spawn_main(parent_pid=12, pipe_handle=31)"
    )

    def _make_event_data(self, context_lines: list[str], platform: str) -> dict[str, Any]:
        return {
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "module": "__main__",
                                    "filename": "<string>",
                                    "function": "<module>",
                                    "context_line": context_line,
                                }
                                for context_line in context_lines
                            ],
                        },
                    }
                ]
            },
            "platform": platform,
        }

    def test_no_parameterization_for_non_python_events(self) -> None:
        context_lines = [self.POSIX_MULTIPROCESSING_CONTEXT_LINE]
        event_data = self._make_event_data(context_lines, "javascript")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_context_lines(event_data) == context_lines

    def test_no_parameterization_for_other_numbers_in_python_context_lines(self) -> None:
        context_lines = [
            "number_1_dog = 'maisey'",
            "charlie_is_co_number_1_dog = True",
            "maisey_dog_ranking = 1",
            "charlie_dog_ranking = 1",
        ]
        event_data = self._make_event_data(context_lines, "python")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_context_lines(event_data) == context_lines

    # TODO: This can go away once we're fully transitioned off of the `newstyle:2023-01-11` grouping
    # config
    def test_no_parameterization_under_2023_grouping_config(self) -> None:
        context_lines = [self.POSIX_MULTIPROCESSING_CONTEXT_LINE]
        event_data = self._make_event_data(context_lines, "python")

        normalize_stacktraces_for_grouping(
            event_data,
            load_grouping_config(get_default_grouping_config_dict(WINTER_2023_GROUPING_CONFIG)),
        )

        assert _get_context_lines(event_data) == context_lines

    def test_parameterizes_python_multiprocess_spawn_calls_posix(self) -> None:
        context_lines = [self.POSIX_MULTIPROCESSING_CONTEXT_LINE]
        event_data = self._make_event_data(context_lines, "python")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_context_lines(event_data) == [
            "from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=<int>, pipe_handle=<int>)"
        ]

    def test_parameterizes_python_multiprocess_spawn_calls_windows(self) -> None:
        context_lines = [self.WINDOWS_MULTIPROCESSING_CONTEXT_LINE]
        event_data = self._make_event_data(context_lines, "python")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_context_lines(event_data) == [
            "from multiprocessing.spawn import spawn_main; spawn_main(parent_pid=<int>, pipe_handle=<int>)"
        ]

    def test_secondary_run_restores_context_line_after_primary_parameterizes(self) -> None:
        # Simulates a grouping-config transition: the primary (FALL_2025) run parameterizes the
        # line, then the secondary (WINTER_2023) run operates on a deep copy and must restore the
        # original line so its hashes match existing groups created under WINTER_2023.
        primary_data = self._make_event_data([self.POSIX_MULTIPROCESSING_CONTEXT_LINE], "python")
        normalize_stacktraces_for_grouping(
            primary_data,
            load_grouping_config(get_default_grouping_config_dict(FALL_2025_GROUPING_CONFIG)),
        )
        assert _get_context_lines(primary_data) == [
            "from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=<int>, pipe_handle=<int>)"
        ]

        secondary_data = deepcopy(primary_data)
        normalize_stacktraces_for_grouping(
            secondary_data,
            load_grouping_config(get_default_grouping_config_dict(WINTER_2023_GROUPING_CONFIG)),
        )
        # The secondary run must produce the same frame state a fresh WINTER_2023 run would have
        # produced, so its grouping hashes link to existing groups instead of fanning out.
        assert _get_context_lines(secondary_data) == [self.POSIX_MULTIPROCESSING_CONTEXT_LINE]
        # The saved original line is preserved across the secondary run.
        frame = secondary_data["exception"]["values"][0]["stacktrace"]["frames"][0]
        assert frame["data"]["orig_context_line"] == self.POSIX_MULTIPROCESSING_CONTEXT_LINE


def _make_hash_event_data(line: str) -> dict[str, Any]:
    return {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {
                                "module": "__main__",
                                "filename": "<string>",
                                "function": "<module>",
                                "context_line": line,
                            }
                        ]
                    }
                }
            ]
        },
        "platform": "python",
    }


def _hashes_for_fresh_run(line: str, grouping_config_id: str) -> list[str]:
    cfg = load_grouping_config(get_default_grouping_config_dict(grouping_config_id))
    data = _make_hash_event_data(line)
    normalize_stacktraces_for_grouping(data, cfg)
    data.setdefault("fingerprint", ["{{ default }}"])
    event = eventstore.backend.create_event(project_id=1, data=data)
    event.project = mock.Mock(id=1)
    hashes, _ = event.get_hashes_and_variants(cfg)
    return hashes


def _secondary_hashes(line: str, primary_config_id: str, secondary_config_id: str) -> list[str]:
    primary_cfg = load_grouping_config(get_default_grouping_config_dict(primary_config_id))
    primary_data = _make_hash_event_data(line)
    normalize_stacktraces_for_grouping(primary_data, primary_cfg)

    secondary_data = deepcopy(primary_data)
    secondary_cfg = load_grouping_config(get_default_grouping_config_dict(secondary_config_id))
    normalize_stacktraces_for_grouping(secondary_data, secondary_cfg)
    secondary_data.setdefault("fingerprint", ["{{ default }}"])
    event = eventstore.backend.create_event(project_id=1, data=secondary_data)
    event.project = mock.Mock(id=1)
    hashes, _ = event.get_hashes_and_variants(secondary_cfg)
    return hashes


@pytest.mark.django_db
def test_secondary_grouping_hashes_match_fresh_winter_2023_hashes_posix() -> None:
    line = PythonMultiprocessingContextLineTest.POSIX_MULTIPROCESSING_CONTEXT_LINE

    fresh_winter_hashes = _hashes_for_fresh_run(line, WINTER_2023_GROUPING_CONFIG)
    secondary_hashes = _secondary_hashes(
        line, FALL_2025_GROUPING_CONFIG, WINTER_2023_GROUPING_CONFIG
    )

    # The secondary path must produce the same hashes a fresh WINTER_2023 run would, so a fresh
    # event can be linked to an existing group via the transition's secondary grouphash lookup.
    assert set(secondary_hashes) & set(fresh_winter_hashes) == set(fresh_winter_hashes)

    # And the secondary must NOT match the hash computed from a parameterized line (the buggy
    # behavior pre-fix, which caused events to fan out into new issues).
    parameterized_line = "from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=<int>, pipe_handle=<int>)"
    parameterized_hashes = _hashes_for_fresh_run(parameterized_line, WINTER_2023_GROUPING_CONFIG)
    assert set(secondary_hashes).isdisjoint(set(parameterized_hashes))
