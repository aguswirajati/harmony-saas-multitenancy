"""
Tenant isolation tests — SECURITY CRITICAL.

Verifies that data belonging to one tenant is never accessible by another tenant,
and that super admins can cross tenant boundaries via the X-Tenant-ID header.
"""
import uuid
import pytest


class TestUserIsolation:
    """Tenant A's admin must not see/modify Tenant B's users."""

    def test_list_users_only_shows_own_tenant(
        self, client, two_tenants, auth_headers, create_user,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        # Create a user in tenant B
        create_user(tenant_id=tenant_b.id, email="secret-b@test.com")

        # Admin A lists users — must NOT include tenant B's user
        resp = client.get("/api/v1/users", headers=auth_headers(admin_a))
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.json()["users"]]
        assert "secret-b@test.com" not in emails

    def test_get_user_from_other_tenant_returns_404(
        self, client, two_tenants, auth_headers, create_user,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants
        user_b = create_user(tenant_id=tenant_b.id, email="userb@test.com")

        resp = client.get(f"/api/v1/users/{user_b.id}", headers=auth_headers(admin_a))
        assert resp.status_code == 404

    def test_update_user_from_other_tenant_returns_404(
        self, client, two_tenants, auth_headers, create_user,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants
        user_b = create_user(tenant_id=tenant_b.id, email="userb2@test.com")

        resp = client.put(
            f"/api/v1/users/{user_b.id}",
            headers=auth_headers(admin_a),
            json={"first_name": "Hacked"},
        )
        assert resp.status_code == 404

    def test_delete_user_from_other_tenant_returns_404(
        self, client, two_tenants, auth_headers, create_user,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants
        user_b = create_user(tenant_id=tenant_b.id, email="userb3@test.com")

        resp = client.delete(
            f"/api/v1/users/{user_b.id}",
            headers=auth_headers(admin_a),
        )
        assert resp.status_code == 404


class TestBranchIsolation:
    """Tenant A's admin must not see/modify Tenant B's branches."""

    def test_list_branches_only_shows_own_tenant(
        self, client, two_tenants, auth_headers, create_branch,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        create_branch(tenant_id=tenant_b.id, name="Secret Branch B", code="SBB")

        resp = client.get("/api/v1/branches", headers=auth_headers(admin_a))
        assert resp.status_code == 200
        names = [b["name"] for b in resp.json()["branches"]]
        assert "Secret Branch B" not in names

    def test_get_branch_from_other_tenant_returns_404(
        self, client, two_tenants, auth_headers, create_branch,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants
        branch_b = create_branch(tenant_id=tenant_b.id, name="Branch B", code="BB1")

        resp = client.get(
            f"/api/v1/branches/{branch_b.id}",
            headers=auth_headers(admin_a),
        )
        assert resp.status_code == 404

    def test_update_branch_from_other_tenant_returns_404(
        self, client, two_tenants, auth_headers, create_branch,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants
        branch_b = create_branch(tenant_id=tenant_b.id, name="Branch B2", code="BB2")

        resp = client.put(
            f"/api/v1/branches/{branch_b.id}",
            headers=auth_headers(admin_a),
            json={"name": "Hacked Branch"},
        )
        assert resp.status_code == 404

    def test_delete_branch_from_other_tenant_returns_404(
        self, client, two_tenants, auth_headers, create_branch,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants
        branch_b = create_branch(tenant_id=tenant_b.id, name="Branch B3", code="BB3")

        resp = client.delete(
            f"/api/v1/branches/{branch_b.id}",
            headers=auth_headers(admin_a),
        )
        assert resp.status_code == 404


class TestSuperAdminCrossTenantAccess:
    """Super admin can access tenant data via admin endpoints."""

    def test_super_admin_can_list_all_users(
        self, client, super_admin, tenant_with_admin, auth_headers,
    ):
        tenant, hq, admin = tenant_with_admin
        headers = auth_headers(super_admin)

        resp = client.get("/api/v1/admin/users", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    def test_super_admin_can_filter_users_by_tenant(
        self, client, super_admin, tenant_with_admin, auth_headers,
    ):
        tenant, hq, admin = tenant_with_admin
        headers = auth_headers(super_admin)

        resp = client.get(
            f"/api/v1/admin/users?tenant_id={tenant.id}",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        # All returned users should belong to the specified tenant
        for user in data["users"]:
            if user.get("tenant_subdomain"):
                assert user["tenant_subdomain"] == tenant.subdomain


class TestRegularUserHeaderIgnored:
    """Regular user's X-Tenant-ID header must be ignored — they use their own tenant."""

    def test_regular_user_x_tenant_id_header_ignored(
        self, client, two_tenants, auth_headers, create_user,
    ):
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        # Create a user in tenant B that admin A should NOT see
        create_user(tenant_id=tenant_b.id, email="invisible@test.com")

        # Admin A tries to set X-Tenant-ID to tenant B
        headers = auth_headers(admin_a)
        headers["X-Tenant-ID"] = str(tenant_b.id)

        resp = client.get("/api/v1/users", headers=headers)
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.json()["users"]]
        # Should only see their own tenant's users, not tenant B's
        assert "invisible@test.com" not in emails
