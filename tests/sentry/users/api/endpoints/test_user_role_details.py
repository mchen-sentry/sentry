from unittest.mock import patch

import sentry.hybridcloud.rpc.caching as caching_module
from sentry.hybridcloud.models.outbox import ControlOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell
from sentry.users.models.userrole import UserRole, UserRoleUser

_TEST_CELLS = (
    Cell("na", 1, "http://eu.testserver"),
    Cell("eu", 2, "http://na.testserver"),
)


def _count_user_update_outboxes(user_id: int) -> int:
    return ControlOutbox.objects.filter(
        category=OutboxCategory.USER_UPDATE, shard_identifier=user_id
    ).count()


@control_silo_test
class UserUserRolesTest(APITestCase):
    endpoint = "sentry-api-0-user-userrole-details"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "users.admin")

    def test_fails_without_superuser(self) -> None:
        self.user = self.create_user(is_superuser=False)
        self.login_as(self.user)

        UserRole.objects.create(name="test-role")
        resp = self.get_response("me", "test-role")
        assert resp.status_code == 403

        self.user.update(is_superuser=True)
        resp = self.get_response("me", "test-role")
        assert resp.status_code == 403

    def test_fails_without_users_admin_permission(self) -> None:
        self.user = self.create_user(is_superuser=True)
        self.login_as(self.user, superuser=True)
        resp = self.get_response("me", "test-role")
        assert resp.status_code == 403


@control_silo_test
class UserUserRolesDetailsTest(UserUserRolesTest):
    def test_lookup_self(self) -> None:
        role = UserRole.objects.create(name="support", permissions=["broadcasts.admin"])
        role.users.add(self.user)
        role2 = UserRole.objects.create(name="admin", permissions=["users.admin"])
        role2.users.add(self.user)
        resp = self.get_response("me", "support")
        assert resp.status_code == 200
        assert resp.data["name"] == "support"


@control_silo_test
class UserUserRolesCreateTest(UserUserRolesTest):
    method = "POST"

    def test_adds_role(self) -> None:
        UserRole.objects.create(name="support", permissions=["broadcasts.admin"])
        UserRole.objects.create(name="admin", permissions=["users.admin"])
        resp = self.get_response("me", "support")
        assert resp.status_code == 201
        assert UserRole.objects.filter(users=self.user, name="support").exists()
        assert not UserRole.objects.filter(users=self.user, name="admin").exists()

    def test_invalid_role(self) -> None:
        UserRole.objects.create(name="other", permissions=["users.edit"])
        resp = self.get_response("me", "blah")
        assert resp.status_code == 404

    def test_existing_role(self) -> None:
        role = UserRole.objects.create(name="support", permissions=["broadcasts.admin"])
        role.users.add(self.user)
        resp = self.get_response("me", "support")
        assert resp.status_code == 410


@control_silo_test
class UserUserRolesDeleteTest(UserUserRolesTest):
    method = "DELETE"

    def test_removes_role(self) -> None:
        role = UserRole.objects.create(name="support", permissions=["broadcasts.admin"])
        role.users.add(self.user)
        role2 = UserRole.objects.create(name="admin", permissions=["users.admin"])
        role2.users.add(self.user)
        resp = self.get_response("me", "support")
        assert resp.status_code == 204
        assert not UserRole.objects.filter(users=self.user, name="support").exists()
        assert UserRole.objects.filter(users=self.user, name="admin").exists()

    def test_removes_role_enqueues_user_update_outbox(self) -> None:
        # Regression: the DELETE endpoint must produce a USER_UPDATE control
        # outbox for the affected user so cell silos invalidate the cached
        # RpcUser (roles/permissions). The previous `role.users.remove(user)`
        # form was a bulk M2M delete that bypassed per-instance outbox creation.
        role = UserRole.objects.create(name="support", permissions=["broadcasts.admin"])
        with outbox_runner():
            role.users.add(self.user)
        before = _count_user_update_outboxes(self.user.id)
        resp = self.get_response("me", "support")
        assert resp.status_code == 204
        assert _count_user_update_outboxes(self.user.id) > before

    def test_concurrent_removal_returns_404(self) -> None:
        # If the membership is removed between the role lookup and the
        # UserRoleUser fetch (e.g. by a concurrent DELETE), the endpoint must
        # surface the missing membership as 404 rather than masking the race
        # with a 204 / spurious audit entry.
        role = UserRole.objects.create(name="support", permissions=["broadcasts.admin"])
        role.users.add(self.user)
        with patch.object(UserRoleUser.objects, "get", side_effect=UserRoleUser.DoesNotExist):
            resp = self.get_response("me", "support")
        assert resp.status_code == 404
        # The endpoint bailed out without mutating the membership row.
        assert UserRole.objects.filter(users=self.user, name="support").exists()

    def test_invalid_role(self) -> None:
        UserRole.objects.create(name="other", permissions=["users.edit"])
        resp = self.get_response("me", "blah")
        assert resp.status_code == 404

    def test_nonexistant_role(self) -> None:
        UserRole.objects.create(name="support", permissions=["broadcasts.admin"])
        resp = self.get_response("me", "support")
        assert resp.status_code == 404


@control_silo_test(cells=_TEST_CELLS)
class UserUserRolesDeleteOutboxCellTest(UserUserRolesTest):
    method = "DELETE"

    def setUp(self) -> None:
        super().setUp()
        # Make the user a member of an organization in the "na" cell so the
        # cell cache-invalidation path runs at drain time for that cell.
        self.organization = self.create_organization(cell=_TEST_CELLS[0])
        self.create_member(user=self.user, organization=self.organization)

    def test_delete_enqueues_outbox_for_each_cell(self) -> None:
        # UserRoleUser.outboxes_for_update fans out a USER_UPDATE control outbox
        # to every configured cell, so the DELETE endpoint must enqueue one
        # outbox per cell for the affected user.
        role = UserRole.objects.create(name="admin", permissions=["users.admin"])
        with outbox_runner():
            UserRoleUser.objects.create(user=self.user, role=role)
        before = _count_user_update_outboxes(self.user.id)
        resp = self.get_response("me", "admin")
        assert resp.status_code == 204
        assert _count_user_update_outboxes(self.user.id) - before == len(_TEST_CELLS)

    def test_delete_purges_cell_cache(self) -> None:
        # Regression (impact): after the DELETE endpoint drains, the
        # USER_UPDATE outbox triggers User.handle_async_replication which
        # clears the cell cache keys for the affected user. The prior
        # `role.users.remove(user)` form produced no outbox, so a cell silo
        # kept serving a stale RpcUser with the removed role's permissions.
        role = UserRole.objects.create(name="admin", permissions=["users.admin"])
        with outbox_runner():
            UserRoleUser.objects.create(user=self.user, role=role)

        with patch.object(caching_module, "cell_caching_service") as mock_caching_service:
            with outbox_runner():
                resp = self.get_response("me", "admin")
            assert resp.status_code == 204
            mock_caching_service.clear_key.assert_any_call(
                key=f"user_service.get_user:{self.user.id}",
                cell_name=_TEST_CELLS[0].name,
            )
            mock_caching_service.clear_key.assert_any_call(
                key=f"user_service.get_many_by_id:{self.user.id}",
                cell_name=_TEST_CELLS[0].name,
            )

    def test_queryset_delete_does_not_enqueue_outbox(self) -> None:
        # Guard against the tempting-but-incorrect fix: `objects.filter(...)
        # .delete()` is also a bulk QuerySet delete and bypasses per-instance
        # outbox production regardless of the manager. Only the per-instance
        # `Model.delete()` override reaches `outboxes_for_update`.
        role = UserRole.objects.create(name="admin", permissions=["users.admin"])
        with outbox_runner():
            UserRoleUser.objects.create(user=self.user, role=role)
        before = _count_user_update_outboxes(self.user.id)
        UserRoleUser.objects.filter(user=self.user, role=role).delete()
        assert _count_user_update_outboxes(self.user.id) == before
