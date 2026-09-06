from sentry.integrations.api.endpoints.organization_integrations_index import (
    normalize_feature_name,
)
from sentry.integrations.base import IntegrationFeatures
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationIntegrationsListTest(APITestCase):
    endpoint = "sentry-api-0-organization-integrations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="example",
            name="Example",
            external_id="example:1",
        )
        self.msteams_integration = self.create_integration(
            organization=self.organization,
            provider="msteams",
            name="MS Teams",
            external_id="msteams:1",
        )
        self.opsgenie = self.create_integration(
            organization=self.organization,
            provider="opsgenie",
            name="Opsgenie",
            external_id="opsgenie:1",
        )
        self.slack_integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Slack",
            external_id="slack:1",
        )

    def test_simple(self) -> None:
        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 4
        assert response.data[0]["id"] == str(self.integration.id)
        assert "configOrganization" in response.data[0]

    def test_no_config(self) -> None:
        response = self.get_success_response(self.organization.slug, qs_params={"includeConfig": 0})

        assert "configOrganization" not in response.data[0]

    def test_feature_filters(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"features": "issue-basic"}
        )
        assert [item["id"] for item in response.data] == [str(self.integration.id)]

    def test_feature_filters_accepts_underscored_form(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"features": "issue_basic"}
        )
        assert [item["id"] for item in response.data] == [str(self.integration.id)]

    def test_feature_filter_supports_multiple_values_with_or_semantics(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"features": ["issue-basic", "alert-rule"]},
        )
        assert [item["id"] for item in response.data] == [
            str(self.integration.id),
            str(self.msteams_integration.id),
            str(self.slack_integration.id),
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"features": ["alert-rule", "codeowners"]},
        )
        assert [item["id"] for item in response.data] == [
            str(self.msteams_integration.id),
            str(self.slack_integration.id),
        ]

    def test_feature_filter_no_match_returns_empty(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"features": "codeowners"}
        )
        assert response.data == []

    def test_provider_key(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"providerKey": "example"}
        )
        assert response.data[0]["id"] == str(self.integration.id)
        response = self.get_success_response(
            self.organization.slug, qs_params={"provider_key": "example"}
        )
        assert response.data[0]["id"] == str(self.integration.id)
        response = self.get_success_response(
            self.organization.slug, qs_params={"provider_key": "vercel"}
        )
        assert response.data == []

    def test_integration_type(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"integrationType": "messaging"}
        )
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(self.msteams_integration.id)
        assert response.data[1]["id"] == str(self.slack_integration.id)
        response = self.get_success_response(
            self.organization.slug, qs_params={"integrationType": "on_call_scheduling"}
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.opsgenie.id)
        response = self.get_error_response(
            self.organization.slug, qs_params={"integrationType": "third_party"}
        )
        assert response.data == {"detail": "Invalid integration type"}
        assert response.status_code == 400

    def test_provider_key_and_integration_type(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"providerKey": "slack", "integrationType": "messaging"},
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.slack_integration.id)
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"providerKey": "vercel", "integrationType": "messaging"},
        )
        assert response.data == []
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"providerKey": "slack", "integrationType": "third_party"},
        )
        assert response.data == {"detail": "Invalid integration type"}
        assert response.status_code == 400


class TestFeatureNormalization:
    def test_normalize_feature_name_treats_hyphens_and_underscores_as_equivalent(self) -> None:
        assert normalize_feature_name("alert-rule") == "alert_rule"
        assert normalize_feature_name("alert_rule") == "alert_rule"
        assert normalize_feature_name("enterprise-incident-management") == (
            "enterprise_incident_management"
        )

    def test_every_documented_value_normalizes_to_enum_identifier_form(self) -> None:
        for feature in IntegrationFeatures:
            assert normalize_feature_name(feature.value) == feature.name.lower()
