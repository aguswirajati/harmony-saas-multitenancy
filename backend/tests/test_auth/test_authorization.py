"""Authorization / role-based access control tests."""
import pytest


class TestStaffCannotAccessAdminEndpoints:
    """Staff users should be blocked from admin-only endpoints."""

    def test_staff_cannot_create_user(
        self, client, tenant_with_admin, create_user, auth_headers,
    ):
        tenant, hq, admin = tenant_with_admin
        staff = create_user(
            tenant_id=tenant.id, role="staff",
            email="staff@test.com", default_branch_id=hq.id,
        )
        resp = client.post(
            "/api/v1/users",
            headers=auth_headers(staff),
            json={
                "email": "newuser@test.com",
                "password": "Test1234",
                "role": "staff",
            },
        )
        assert resp.status_code == 403

    def test_staff_cannot_delete_user(
        self, client, tenant_with_admin, create_user, auth_headers,
    ):
        tenant, hq, admin = tenant_with_admin
        staff = create_user(
            tenant_id=tenant.id, role="staff",
            email="staff2@test.com", default_branch_id=hq.id,
        )
        resp = client.delete(
            f"/api/v1/users/{admin.id}",
            headers=auth_headers(staff),
        )
        assert resp.status_code == 403

    def test_staff_cannot_create_branch(
        self, client, tenant_with_admin, create_user, auth_headers,
    ):
        tenant, hq, admin = tenant_with_admin
        staff = create_user(
            tenant_id=tenant.id, role="staff",
            email="staff3@test.com", default_branch_id=hq.id,
        )
        resp = client.post(
            "/api/v1/branches",
            headers=auth_headers(staff),
            json={"name": "New Branch", "code": "NB1"},
        )
        assert resp.status_code == 403


class TestTenantAdminCannotAccessSuperAdminEndpoints:
    """Tenant admins should be blocked from super admin endpoints."""

    def test_tenant_admin_cannot_access_admin_stats(
        self, client, tenant_with_admin, auth_headers,
    ):
        _, _, admin = tenant_with_admin
        resp = client.get(
            "/api/v1/admin/stats",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 403

    def test_tenant_admin_cannot_list_all_users(
        self, client, tenant_with_admin, auth_headers,
    ):
        _, _, admin = tenant_with_admin
        resp = client.get(
            "/api/v1/admin/users",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 403


class TestUnauthenticatedAccess:
    """Requests without a token should be rejected."""

    def test_no_token_returns_401_or_403(self, client):
        resp = client.get("/api/v1/users")
        assert resp.status_code in (401, 403)

    def test_invalid_token_returns_401_or_403(self, client):
        resp = client.get(
            "/api/v1/users",
            headers={"Authorization": "Bearer invalid.token.value"},
        )
        assert resp.status_code in (401, 403)

    def test_expired_token_returns_401_or_403(self, client, tenant_with_admin):
        from jose import jwt
        from app.config import get_settings

        _, _, admin = tenant_with_admin
        settings = get_settings()
        expired_token = jwt.encode(
            {"sub": str(admin.id), "role": "admin", "exp": 0},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        resp = client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert resp.status_code in (401, 403)
