"""BranchService unit tests."""
import pytest
from fastapi import HTTPException

from app.services.branch_service import BranchService
from app.schemas.branch import BranchCreate, BranchUpdate


class TestBranchCRUD:

    def test_create_branch(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        # Increase branch limit to allow creation
        tenant.max_branches = 5
        db_session.flush()

        svc = BranchService(db_session)
        data = BranchCreate(name="Branch One", code="BR1")
        branch = svc.create_branch(data, tenant.id, admin)
        assert branch.name == "Branch One"
        assert branch.code == "BR1"
        assert branch.tenant_id == tenant.id

    def test_create_branch_duplicate_code_rejected(
        self, db_session, tenant_with_admin,
    ):
        tenant, hq, admin = tenant_with_admin
        tenant.max_branches = 5
        db_session.flush()

        svc = BranchService(db_session)
        svc.create_branch(BranchCreate(name="First", code="DUP"), tenant.id, admin)
        with pytest.raises(HTTPException) as exc_info:
            svc.create_branch(BranchCreate(name="Second", code="DUP"), tenant.id, admin)
        assert exc_info.value.status_code == 400

    def test_get_branch(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        svc = BranchService(db_session)
        found = svc.get_branch(hq.id, tenant.id)
        assert found.id == hq.id

    def test_get_branch_wrong_tenant_returns_404(
        self, db_session, two_tenants, create_branch,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants
        branch_b = create_branch(tenant_id=tenant_b.id, code="XB")
        svc = BranchService(db_session)
        with pytest.raises(HTTPException) as exc_info:
            svc.get_branch(branch_b.id, tenant_a.id)
        assert exc_info.value.status_code == 404

    def test_get_branches_list(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        svc = BranchService(db_session)
        branches, total = svc.get_branches(tenant.id)
        assert total >= 1  # At least HQ

    def test_update_branch(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        tenant.max_branches = 5
        db_session.flush()

        svc = BranchService(db_session)
        branch = svc.create_branch(
            BranchCreate(name="Old Name", code="UPD"),
            tenant.id, admin,
        )
        updated = svc.update_branch(
            branch.id,
            BranchUpdate(name="New Name"),
            tenant.id, admin,
        )
        assert updated.name == "New Name"

    def test_delete_branch_soft(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        tenant.max_branches = 5
        db_session.flush()

        svc = BranchService(db_session)
        branch = svc.create_branch(
            BranchCreate(name="Delete Me", code="DEL"),
            tenant.id, admin,
        )
        result = svc.delete_branch(branch.id, tenant.id, admin)
        assert result is True
        db_session.refresh(branch)
        assert branch.is_active is False


class TestHQDeletionProtection:

    def test_cannot_delete_hq_branch(self, db_session, tenant_with_admin):
        tenant, hq, admin = tenant_with_admin
        svc = BranchService(db_session)
        with pytest.raises(HTTPException) as exc_info:
            svc.delete_branch(hq.id, tenant.id, admin)
        assert exc_info.value.status_code == 400
        assert "headquarters" in exc_info.value.detail.lower() or "HQ" in exc_info.value.detail


class TestBranchTierLimits:

    def test_create_branch_exceeds_limit_raises_403(
        self, db_session, tenant_with_admin,
    ):
        tenant, hq, admin = tenant_with_admin
        # Free tier: max_branches=1, HQ already exists
        svc = BranchService(db_session)
        with pytest.raises(HTTPException) as exc_info:
            svc.create_branch(
                BranchCreate(name="Over Limit", code="OVR"),
                tenant.id, admin,
            )
        assert exc_info.value.status_code == 403
        assert "limit" in exc_info.value.detail.lower()


class TestBranchWithUsersProtection:

    def test_cannot_delete_branch_with_active_users(
        self, db_session, tenant_with_admin, create_branch, create_user,
    ):
        tenant, hq, admin = tenant_with_admin
        tenant.max_branches = 5
        db_session.flush()

        svc = BranchService(db_session)
        branch = svc.create_branch(
            BranchCreate(name="Busy Branch", code="BSY"),
            tenant.id, admin,
        )
        # Assign a user to this branch
        create_user(
            tenant_id=tenant.id,
            default_branch_id=branch.id,
            email="branchuser@test.com",
        )

        with pytest.raises(HTTPException) as exc_info:
            svc.delete_branch(branch.id, tenant.id, admin)
        assert exc_info.value.status_code == 400
        assert "user" in exc_info.value.detail.lower()
