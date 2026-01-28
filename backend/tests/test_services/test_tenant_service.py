"""TenantService unit tests."""
import pytest
import uuid
from datetime import datetime

from app.services.tenant_service import TenantService
from app.schemas.tenant import (
    TenantCreate, TenantUpdate, TenantSubscriptionUpdate,
    TenantStatusUpdate,
)
from app.core.exceptions import (
    TenantNotFoundException, SubdomainTakenException, TenantExistsException,
)


class TestTenantCRUD:

    def test_create_tenant(self, db_session):
        svc = TenantService(db_session)
        data = TenantCreate(
            name="New Tenant",
            subdomain="new-tenant",
            tier="free",
            max_users=5,
            max_branches=1,
            max_storage_gb=1,
            admin_email="newadmin@test.com",
            admin_password="SecurePass1",
            admin_first_name="Admin",
            admin_last_name="User",
        )
        tenant = svc.create_tenant(data)
        assert tenant.name == "New Tenant"
        assert tenant.subdomain == "new-tenant"
        assert tenant.tier == "free"
        assert tenant.is_active is True

    def test_create_tenant_duplicate_subdomain_raises(
        self, db_session, create_tenant,
    ):
        existing = create_tenant(subdomain="taken-sub")
        svc = TenantService(db_session)
        data = TenantCreate(
            name="Dup",
            subdomain="taken-sub",
            tier="free",
            max_users=5,
            max_branches=1,
            max_storage_gb=1,
            admin_email="dup@test.com",
            admin_password="SecurePass1",
            admin_first_name="Dup",
            admin_last_name="Admin",
        )
        with pytest.raises(SubdomainTakenException):
            svc.create_tenant(data)

    def test_create_tenant_duplicate_email_raises(
        self, db_session, create_tenant, create_user,
    ):
        t = create_tenant()
        create_user(tenant_id=t.id, email="taken@test.com")
        svc = TenantService(db_session)
        data = TenantCreate(
            name="Dup Email",
            subdomain="dup-email-sub",
            tier="free",
            max_users=5,
            max_branches=1,
            max_storage_gb=1,
            admin_email="taken@test.com",
            admin_password="SecurePass1",
            admin_first_name="Dup",
            admin_last_name="Email",
        )
        with pytest.raises(TenantExistsException):
            svc.create_tenant(data)

    def test_get_tenant_by_id(self, db_session, create_tenant):
        tenant = create_tenant(name="Find Me")
        svc = TenantService(db_session)
        found = svc.get_tenant_by_id(tenant.id)
        assert found.id == tenant.id
        assert found.name == "Find Me"

    def test_get_tenant_by_id_not_found(self, db_session):
        svc = TenantService(db_session)
        with pytest.raises(TenantNotFoundException):
            svc.get_tenant_by_id(uuid.uuid4())

    def test_get_tenant_by_subdomain(self, db_session, create_tenant):
        tenant = create_tenant(subdomain="findme-sub")
        svc = TenantService(db_session)
        found = svc.get_tenant_by_subdomain("findme-sub")
        assert found is not None
        assert found.id == tenant.id

    def test_update_tenant(self, db_session, create_tenant):
        tenant = create_tenant(name="Old Name")
        svc = TenantService(db_session)
        updated = svc.update_tenant(tenant.id, TenantUpdate(name="New Name"))
        assert updated.name == "New Name"

    def test_soft_delete_tenant(self, db_session, create_tenant):
        tenant = create_tenant()
        svc = TenantService(db_session)
        result = svc.delete_tenant(tenant.id)
        assert result is True
        db_session.refresh(tenant)
        assert tenant.is_active is False
        assert tenant.deleted_at is not None


class TestTenantSubscription:

    def test_update_subscription(self, db_session, create_tenant):
        tenant = create_tenant(tier="free")
        svc = TenantService(db_session)
        data = TenantSubscriptionUpdate(
            tier="premium",
            subscription_status="active",
            max_users=100,
            max_branches=20,
            max_storage_gb=50,
        )
        updated = svc.update_subscription(tenant.id, data)
        assert updated.tier == "premium"
        assert updated.max_users == 100
        assert updated.max_branches == 20

    def test_update_status_deactivate(self, db_session, create_tenant):
        tenant = create_tenant()
        svc = TenantService(db_session)
        svc.update_status(tenant.id, TenantStatusUpdate(
            is_active=False, reason="Non-payment",
        ))
        db_session.refresh(tenant)
        assert tenant.is_active is False


class TestTenantLimits:

    def test_check_user_limit_under(self, db_session, create_tenant):
        tenant = create_tenant(max_users=5)
        svc = TenantService(db_session)
        assert svc.check_user_limit(tenant.id) is True

    def test_check_user_limit_reached(
        self, db_session, create_tenant, create_user,
    ):
        tenant = create_tenant(max_users=1)
        create_user(tenant_id=tenant.id)
        svc = TenantService(db_session)
        assert svc.check_user_limit(tenant.id) is False

    def test_check_user_limit_unlimited(
        self, db_session, create_tenant, create_user,
    ):
        tenant = create_tenant(max_users=-1)  # Enterprise / unlimited
        for i in range(10):
            create_user(tenant_id=tenant.id)
        svc = TenantService(db_session)
        assert svc.check_user_limit(tenant.id) is True

    def test_check_branch_limit_under(self, db_session, create_tenant):
        tenant = create_tenant(max_branches=5)
        svc = TenantService(db_session)
        assert svc.check_branch_limit(tenant.id) is True

    def test_check_branch_limit_reached(
        self, db_session, create_tenant, create_branch,
    ):
        tenant = create_tenant(max_branches=1)
        create_branch(tenant_id=tenant.id, is_hq=True)
        svc = TenantService(db_session)
        assert svc.check_branch_limit(tenant.id) is False


class TestSystemStats:

    def test_get_system_stats(self, db_session, create_tenant):
        create_tenant(tier="free")
        create_tenant(tier="basic")
        svc = TenantService(db_session)
        stats = svc.get_system_stats()
        assert stats.total_tenants >= 2
        assert stats.free_tier_count >= 1
        assert stats.basic_tier_count >= 1
