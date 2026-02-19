"""UserService unit tests."""
import pytest
import uuid
from fastapi import HTTPException

from app.services.user_service import UserService
from app.schemas.user import UserCreate, UserUpdate, UserChangePassword


class TestUserCRUD:

    def test_create_user(self, db_session, tenant_with_admin):
        tenant, hq, owner = tenant_with_admin
        svc = UserService(db_session)
        data = UserCreate(
            email="newuser@test.com",
            password="Test1234",
            tenant_role="member",
            first_name="New",
            last_name="User",
            default_branch_id=hq.id,
        )
        user = svc.create_user(data, tenant.id, owner)
        assert user.email == "newuser@test.com"
        assert user.tenant_role.value == "member"
        assert user.tenant_id == tenant.id

    def test_create_user_duplicate_email_rejected(
        self, db_session, tenant_with_admin,
    ):
        tenant, hq, owner = tenant_with_admin
        svc = UserService(db_session)
        data = UserCreate(
            email=owner.email,  # Already exists
            password="Test1234",
            tenant_role="member",
        )
        with pytest.raises(HTTPException) as exc_info:
            svc.create_user(data, tenant.id, owner)
        assert exc_info.value.status_code == 400

    def test_get_user(self, db_session, tenant_with_admin, create_user):
        tenant, hq, admin = tenant_with_admin
        user = create_user(tenant_id=tenant.id, email="getme@test.com")
        svc = UserService(db_session)
        found = svc.get_user(user.id, tenant.id)
        assert found.id == user.id

    def test_get_user_wrong_tenant_returns_404(
        self, db_session, two_tenants, create_user,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants
        user_b = create_user(tenant_id=tenant_b.id)
        svc = UserService(db_session)
        with pytest.raises(HTTPException) as exc_info:
            svc.get_user(user_b.id, tenant_a.id)
        assert exc_info.value.status_code == 404

    def test_get_users_list(self, db_session, tenant_with_admin, create_user):
        tenant, hq, admin = tenant_with_admin
        for i in range(3):
            create_user(tenant_id=tenant.id)
        svc = UserService(db_session)
        users, total = svc.get_users(tenant.id)
        assert total >= 4  # 3 + admin

    def test_update_user(self, db_session, tenant_with_admin, create_user):
        tenant, hq, admin = tenant_with_admin
        user = create_user(tenant_id=tenant.id, email="updateme@test.com")
        svc = UserService(db_session)
        updated = svc.update_user(
            user.id,
            UserUpdate(first_name="Updated"),
            tenant.id,
            admin,
        )
        assert updated.first_name == "Updated"

    def test_delete_user_soft(self, db_session, tenant_with_admin, create_user):
        tenant, hq, admin = tenant_with_admin
        user = create_user(tenant_id=tenant.id, email="deleteme@test.com")
        svc = UserService(db_session)
        result = svc.delete_user(user.id, tenant.id, admin)
        assert result is True
        db_session.refresh(user)
        assert user.is_active is False
        assert user.deleted_at is not None

    def test_cannot_delete_self(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        svc = UserService(db_session)
        with pytest.raises(HTTPException) as exc_info:
            svc.delete_user(admin.id, tenant.id, admin)
        assert exc_info.value.status_code == 400


class TestUserTierLimits:

    def test_create_user_exceeds_limit_raises_403(
        self, db_session, create_tenant, create_branch, create_user,
    ):
        tenant = create_tenant(max_users=2)
        hq = create_branch(tenant_id=tenant.id, is_hq=True)
        owner = create_user(
            tenant_id=tenant.id, tenant_role="owner",
            email="limowner@test.com", default_branch_id=hq.id,
        )
        # Create one more to hit the limit (owner is already 1)
        create_user(tenant_id=tenant.id, email="second@test.com")

        svc = UserService(db_session)
        data = UserCreate(
            email="overflow@test.com",
            password="Test1234",
            tenant_role="member",
        )
        with pytest.raises(HTTPException) as exc_info:
            svc.create_user(data, tenant.id, owner)
        assert exc_info.value.status_code == 403
        assert "limit" in exc_info.value.detail.lower()


class TestPasswordChange:

    def test_change_password_success(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        svc = UserService(db_session)
        result = svc.change_password(
            admin.id,
            UserChangePassword(
                current_password="Test1234",
                new_password="NewPass123",
            ),
            tenant.id,
        )
        assert result is True

    def test_change_password_wrong_current(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        svc = UserService(db_session)
        with pytest.raises(HTTPException) as exc_info:
            svc.change_password(
                admin.id,
                UserChangePassword(
                    current_password="WrongPassword1",
                    new_password="NewPass123",
                ),
                tenant.id,
            )
        assert exc_info.value.status_code == 400
