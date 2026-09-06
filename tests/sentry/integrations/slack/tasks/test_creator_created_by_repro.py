from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
import responses

from sentry.integrations.slack.tasks import find_channel_id_for_rule
from sentry.integrations.slack.utils.rule_status import RedisRuleStatus
from sentry.models.rule import Rule
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.workflow_engine.models import AlertRuleWorkflow
from tests.sentry.integrations.slack.utils.test_mock_slack_response import mock_slack_response


class FindChannelIdCreatedByReproTest(TestCase):
    def setUp(self):
        self.integration = install_slack(self.organization)
        self.uuid = uuid4().hex

    @pytest.fixture(autouse=True)
    def _mocks(self):
        with mock_slack_response(
            "chat_scheduleMessage",
            body={"ok": True, "channel": "chan-id", "scheduled_message_id": "Q1"},
        ):
            with mock_slack_response("chat_deleteScheduledMessage", body={"ok": True}):
                yield

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    def test_workflow_created_by_is_user_for_slack_path(self, _: MagicMock) -> None:
        data = {
            "name": "New Rule",
            "environment": None,
            "project_id": self.project.id,
            "action_match": "all",
            "filter_match": "all",
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
            ],
            "actions": [
                {
                    "channel": "#my-channel",
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "tags": "",
                    "workspace": self.integration.id,
                }
            ],
            "frequency": 5,
            "uuid": self.uuid,
            "user_id": self.user.id,
        }
        with self.tasks():
            find_channel_id_for_rule(**data)

        rule = Rule.objects.get(project_id=self.project.id)
        assert rule.created_by_id == self.user.id
        arw = AlertRuleWorkflow.objects.get(rule_id=rule.id)
        assert arw.workflow.created_by_id == self.user.id
