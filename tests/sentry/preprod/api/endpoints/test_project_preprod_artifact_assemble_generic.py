from unittest.mock import MagicMock, patch

import orjson
from django.test import override_settings

from sentry.models.files.fileblob import FileBlob
from sentry.preprod import PreprodArtifactApiAssembleGenericEvent
from sentry.preprod.models import PreprodArtifact
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    delete_assemble_status,
    get_assemble_status,
    set_assemble_status,
)
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_analytics_events_recorded


@override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
class ProjectPreprodArtifactAssembleGenericEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.preprod_artifact = self.create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.UPLOADED
        )

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{artifact_id}/assemble-generic/"

    def _make_request(self, data, artifact_id=None, authenticated=True):
        url = self._get_url(artifact_id)
        json_data: bytes = orjson.dumps(data) if isinstance(data, dict) else data

        if authenticated:
            signature = generate_service_request_signature(
                url, json_data, ["test-secret-key"], "Launchpad"
            )
            return self.client.post(
                url,
                data=json_data,
                content_type="application/json",
                HTTP_AUTHORIZATION=f"rpcsignature {signature}",
            )
        else:
            return self.client.post(url, data=json_data, content_type="application/json")

    def _create_blobs(self, count=2):
        return [
            FileBlob.from_file_with_organization(
                self.create_file(name=f"chunk{i}", type="application/octet-stream").getfile(),
                self.organization,
            )
            for i in range(count)
        ]

    def _assert_task_called_with(self, mock_task, checksum, chunks, artifact_id=None):
        """Helper to assert task was called with expected parameters"""
        call_kwargs = mock_task.call_args[1]["kwargs"]
        assert call_kwargs["org_id"] == self.organization.id
        assert call_kwargs["project_id"] == self.project.id
        assert call_kwargs["checksum"] == checksum
        assert call_kwargs["chunks"] == chunks
        assert call_kwargs["artifact_id"] == str(artifact_id or self.preprod_artifact.id)

    @patch("sentry.analytics.record")
    def test_assemble_size_analysis_success(self, mock_analytics: MagicMock) -> None:
        blobs = self._create_blobs()
        checksum = "a" * 40
        data = {
            "checksum": checksum,
            "chunks": [b.checksum for b in blobs],
            "assemble_type": "size_analysis",
        }

        with patch(
            "sentry.preprod.api.endpoints.project_preprod_artifact_assemble_generic.assemble_preprod_artifact_size_analysis.apply_async"
        ) as mock_task:
            response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == ChunkFileState.CREATED
        assert resp_data["missingChunks"] == []

        assert_analytics_events_recorded(
            mock_analytics,
            [
                PreprodArtifactApiAssembleGenericEvent(
                    organization_id=self.organization.id,
                    project_id=self.project.id,
                )
            ],
        )
        self._assert_task_called_with(mock_task, checksum, [b.checksum for b in blobs])

    @patch("sentry.analytics.record")
    def test_assemble_installable_app_success(self, mock_analytics: MagicMock) -> None:
        blobs = self._create_blobs()
        checksum = "a" * 40
        data = {
            "checksum": checksum,
            "chunks": [b.checksum for b in blobs],
            "assemble_type": "installable_app",
        }

        with patch(
            "sentry.preprod.api.endpoints.project_preprod_artifact_assemble_generic.assemble_preprod_artifact_installable_app.apply_async"
        ) as mock_task:
            response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == ChunkFileState.CREATED
        assert resp_data["missingChunks"] == []

        assert_analytics_events_recorded(
            mock_analytics,
            [
                PreprodArtifactApiAssembleGenericEvent(
                    organization_id=self.organization.id,
                    project_id=self.project.id,
                )
            ],
        )
        self._assert_task_called_with(mock_task, checksum, [b.checksum for b in blobs])

    def test_unsupported_assemble_type(self) -> None:
        data = {
            "checksum": "b" * 40,
            "chunks": ["c" * 40],
            "assemble_type": "unsupported_type",
        }

        response = self._make_request(data)
        assert response.status_code == 400
        assert "assemble_type" in response.json()["error"]

    def test_missing_chunks_and_empty_chunks(self) -> None:
        # Test missing chunks
        response = self._make_request(
            {
                "checksum": "c" * 40,
                "chunks": ["d" * 40, "e" * 40],
                "assemble_type": "size_analysis",
            }
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == ChunkFileState.NOT_FOUND
        assert len(resp_data["missingChunks"]) == 2

        # Test empty chunks
        response = self._make_request(
            {
                "checksum": "f" * 40,
                "chunks": [],
                "assemble_type": "size_analysis",
            }
        )
        assert response.status_code == 200
        assert response.json()["state"] == ChunkFileState.NOT_FOUND

    def test_existing_status(self) -> None:
        blob = self._create_blobs(1)[0]
        checksum = "e" * 40

        # The cache is scoped per-artifact, so seeding the worker-written
        # status for *this* artifact's scope must short-circuit the endpoint
        # (i.e. endpoint and worker share the same cache key).
        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            self.project.id,
            checksum,
            ChunkFileState.ASSEMBLING,
            detail="Processing",
            scope_extra=str(self.preprod_artifact.id),
        )

        response = self._make_request(
            {
                "checksum": checksum,
                "chunks": [blob.checksum],
                "assemble_type": "size_analysis",
            }
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == ChunkFileState.ASSEMBLING
        assert resp_data["detail"] == "Processing"

        delete_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            self.project.id,
            checksum,
            scope_extra=str(self.preprod_artifact.id),
        )

    def test_existing_ok_status_same_artifact_poll(self) -> None:
        """A same-artifact poll within the TTL observes the worker-written OK.

        Pairs with ``AssemblePreprodArtifact*Test`` in ``test_tasks.py`` to
        prove endpoint/worker cache-key coherence: the test seeds ``OK`` on the
        per-artifact scope (exactly the key the worker writes), then polls the
        endpoint for the *same* artifact and asserts it short-circuits to OK
        instead of re-dispatching.
        """
        blob = self._create_blobs(1)[0]
        checksum = "f1" * 20

        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            self.project.id,
            checksum,
            ChunkFileState.OK,
            detail=None,
            scope_extra=str(self.preprod_artifact.id),
        )

        with patch(
            "sentry.preprod.api.endpoints.project_preprod_artifact_assemble_generic.assemble_preprod_artifact_size_analysis.apply_async"
        ) as mock_task:
            response = self._make_request(
                {
                    "checksum": checksum,
                    "chunks": [blob.checksum],
                    "assemble_type": "size_analysis",
                }
            )

        assert response.status_code == 200
        assert response.json()["state"] == ChunkFileState.OK
        # The cached OK is terminal: the task must NOT be re-dispatched.
        assert mock_task.call_count == 0

        delete_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            self.project.id,
            checksum,
            scope_extra=str(self.preprod_artifact.id),
        )

    def _assert_sibling_artifact_not_short_circuited(
        self,
        *,
        assemble_type: str,
        task_name: str,
        task_path: str,
        checksum: str,
    ) -> None:
        """Regression helper: an OK cached for artifact A must NOT short-circuit
        artifact B even when both share the same project + checksum.

        Before the fix the cache was keyed only by ``(task, project.id,
        checksum)`` with no ``artifact_id`` dimension, so a sibling artifact's
        OK was returned for artifact B and its Celery task was never
        dispatched, leaving B permanently stuck (no installable app file /
        size analysis stuck PENDING).

        This test seeds the OK on the *historical* project+checksum key (the
        exact key the pre-fix worker wrote to and the pre-fix endpoint read
        from), then requests assembly for a *sibling* artifact B with the same
        checksum. Under the buggy code the endpoint reads this key and returns
        A's OK without dispatching B's task; under the fix the endpoint reads
        B's per-artifact key (which is empty) and dispatches B's task.
        """
        artifact_b = self.create_preprod_artifact(state=PreprodArtifact.ArtifactState.UPLOADED)
        blob = self._create_blobs(1)[0]
        request_data = {
            "checksum": checksum,
            "chunks": [blob.checksum],
            "assemble_type": assemble_type,
        }

        # Simulate artifact A's assembly having completed under the PRE-FIX
        # code path: the worker wrote OK to the project+checksum key with NO
        # artifact_id dimension (the buggy scope). This is exactly the cache
        # entry that used to short-circuit a sibling artifact sharing the same
        # checksum.
        set_assemble_status(task_name, self.project.id, checksum, ChunkFileState.OK)

        with patch(task_path) as mock_task:
            response = self._make_request(request_data, artifact_id=artifact_b.id)

        # The endpoint must NOT return artifact A's cached OK for artifact B...
        assert response.status_code == 200
        assert response.json()["state"] == ChunkFileState.CREATED
        # ...and it MUST dispatch B's own task (not short-circuit it).
        assert mock_task.call_count == 1
        call_kwargs = mock_task.call_args[1]["kwargs"]
        assert call_kwargs["artifact_id"] == str(artifact_b.id)
        assert call_kwargs["checksum"] == checksum
        assert call_kwargs["project_id"] == self.project.id

        # A's cached OK on the historical project+checksum key must remain
        # untouched: B's request must operate on a separate (per-artifact) key.
        state, _ = get_assemble_status(task_name, self.project.id, checksum)
        assert state == ChunkFileState.OK

        # Cleanup both the historical key (A's OK) and the per-artifact key the
        # endpoint created for B (CREATED, written just before dispatch).
        delete_assemble_status(task_name, self.project.id, checksum)
        delete_assemble_status(task_name, self.project.id, checksum, scope_extra=str(artifact_b.id))

    def test_cross_artifact_size_analysis_same_checksum_dispatches_for_sibling(
        self,
    ) -> None:
        self._assert_sibling_artifact_not_short_circuited(
            assemble_type="size_analysis",
            task_name=AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            task_path=(
                "sentry.preprod.api.endpoints.project_preprod_artifact_assemble_generic."
                "assemble_preprod_artifact_size_analysis.apply_async"
            ),
            checksum="ab" * 20,
        )

    def test_cross_artifact_installable_app_same_checksum_dispatches_for_sibling(
        self,
    ) -> None:
        self._assert_sibling_artifact_not_short_circuited(
            assemble_type="installable_app",
            task_name=AssembleTask.PREPROD_ARTIFACT_INSTALLABLE_APP,
            task_path=(
                "sentry.preprod.api.endpoints.project_preprod_artifact_assemble_generic."
                "assemble_preprod_artifact_installable_app.apply_async"
            ),
            checksum="cd" * 20,
        )

    def test_validation_errors(self) -> None:
        test_cases = [
            (b"invalid json", "Invalid json body"),
            ({"chunks": ["a" * 40], "assemble_type": "size_analysis"}, "checksum"),
            ({"checksum": "a" * 40, "assemble_type": "size_analysis"}, "chunks"),
            ({"checksum": "a" * 40, "chunks": ["b" * 40]}, "assemble_type"),
            (
                {"checksum": "invalid", "chunks": ["c" * 40], "assemble_type": "size_analysis"},
                "checksum",
            ),
            (
                {"checksum": "d" * 40, "chunks": ["invalid"], "assemble_type": "size_analysis"},
                "chunks",
            ),
            (
                {"checksum": "e" * 40, "chunks": ["f" * 40], "assemble_type": "invalid_type"},
                "assemble_type",
            ),
            (
                {
                    "checksum": "1" * 40,
                    "chunks": ["2" * 40],
                    "assemble_type": "size_analysis",
                    "extra": "field",
                },
                "Additional properties",
            ),
        ]

        for data, expected_error_contains in test_cases:
            with self.subTest(data=data):
                response = self._make_request(data)
                assert response.status_code == 400
                assert expected_error_contains in response.json()["error"]

    def test_unauthorized(self) -> None:
        response = self._make_request(
            {
                "checksum": "0" * 40,
                "chunks": ["1" * 40],
                "assemble_type": "size_analysis",
            },
            authenticated=False,
        )
        assert response.status_code == 401

    def test_artifact_id_passed_to_task(self) -> None:
        """Test that arbitrary artifact_id values are accepted and passed to the task."""
        blob = self._create_blobs(1)[0]
        checksum = "9" * 40
        data = {
            "checksum": checksum,
            "chunks": [blob.checksum],
            "assemble_type": "size_analysis",
        }

        with patch(
            "sentry.preprod.api.endpoints.project_preprod_artifact_assemble_generic.assemble_preprod_artifact_size_analysis.apply_async"
        ) as mock_task:
            response = self._make_request(data, artifact_id=99999)

        assert response.status_code == 200
        self._assert_task_called_with(mock_task, checksum, [blob.checksum], artifact_id=99999)
