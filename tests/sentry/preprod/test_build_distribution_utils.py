from sentry.preprod.build_distribution_utils import (
    find_latest_installable_artifact,
    is_installable_artifact,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactMobileAppInfo,
    PreprodBuildConfiguration,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class IsInstallableArtifactTest(TestCase):
    def _create_artifact(
        self,
        artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        installable_app_file_id=1,
        build_number="456",
        extras=None,
    ) -> PreprodArtifact:
        build_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="Release"
        )
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=artifact_type,
            app_id="com.example.app",
            build_configuration=build_config,
            installable_app_file_id=installable_app_file_id,
            extras=extras,
        )
        PreprodArtifactMobileAppInfo.objects.create(
            preprod_artifact=artifact,
            app_name="TestApp",
            build_version="1.0.0",
            build_number=build_number,
        )
        return PreprodArtifact.objects.select_related("mobile_app_info").get(id=artifact.id)

    def test_xcarchive_with_valid_signature_is_installable(self) -> None:
        artifact = self._create_artifact(extras={"is_code_signature_valid": True})
        assert is_installable_artifact(artifact) is True

    def test_xcarchive_without_valid_signature_is_not_installable(self) -> None:
        artifact = self._create_artifact(extras={"is_code_signature_valid": False})
        assert is_installable_artifact(artifact) is False

    def test_xcarchive_with_app_store_codesigning_is_not_installable(self) -> None:
        artifact = self._create_artifact(
            extras={"is_code_signature_valid": True, "codesigning_type": "app-store"}
        )
        assert is_installable_artifact(artifact) is False

    def test_xcarchive_without_installable_app_file_is_not_installable(self) -> None:
        artifact = self._create_artifact(
            installable_app_file_id=None, extras={"is_code_signature_valid": True}
        )
        assert is_installable_artifact(artifact) is False

    def test_aab_is_installable(self) -> None:
        artifact = self._create_artifact(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            extras=None,
        )
        assert is_installable_artifact(artifact) is True


@cell_silo_test
class FindLatestInstallableArtifactTest(TestCase):
    """Regression coverage for find_latest_installable_artifact's installability rules.

    find_latest_installable_artifact builds its own ORM filter rather than delegating to
    is_installable_artifact, so it must mirror every installability rule by hand. These
    tests lock that mirroring (in particular the app-store exclusion) so the two do not drift.
    """

    def _create_artifact(
        self,
        build_version: str,
        build_number: int,
        extras: dict | None = None,
        artifact_type: int = PreprodArtifact.ArtifactType.XCARCHIVE,
    ) -> PreprodArtifact:
        return self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=artifact_type,
            app_id="com.example.app",
            installable_app_file_id=build_number,
            build_configuration=None,
            extras=extras,
            build_version=build_version,
            build_number=build_number,
            app_name="TestApp",
        )

    def test_app_store_build_is_not_returned_as_latest(self) -> None:
        # The app-store build is the higher version, but is_installable_artifact rejects
        # app-store-signed builds as not installable. find_latest_installable_artifact must
        # skip it and return the (lower-version) development build instead.
        app_store = self._create_artifact(
            "2.0.0",
            200,
            {"is_code_signature_valid": True, "codesigning_type": "app-store"},
        )
        dev = self._create_artifact(
            "1.0.0",
            100,
            {"is_code_signature_valid": True, "codesigning_type": "development"},
        )
        assert is_installable_artifact(app_store) is False
        assert is_installable_artifact(dev) is True

        latest = find_latest_installable_artifact(
            project=self.project,
            app_id="com.example.app",
            platform="apple",
            codesigning_type=None,
        )

        assert latest is not None
        assert latest.id == dev.id
        assert is_installable_artifact(latest) is True

    def test_build_without_codesigning_type_is_still_installable(self) -> None:
        # Builds that predate the codesigning_type field (missing JSON key) are still
        # installable per is_installable_artifact; the app-store exclusion must not drop them.
        no_codesigning = self._create_artifact("1.0.0", 100, {"is_code_signature_valid": True})
        assert is_installable_artifact(no_codesigning) is True

        latest = find_latest_installable_artifact(
            project=self.project,
            app_id="com.example.app",
            platform="apple",
            codesigning_type=None,
        )

        assert latest is not None
        assert latest.id == no_codesigning.id
        assert is_installable_artifact(latest) is True
