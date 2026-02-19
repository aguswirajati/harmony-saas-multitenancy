"""
Tests for file tenant isolation - SECURITY CRITICAL.
Ensures files cannot be accessed across tenant boundaries.
"""
import pytest
from fastapi import status


class TestFileIsolation:
    """Test that files are properly isolated between tenants."""

    def test_cannot_access_other_tenant_file_by_id(
        self, client, two_tenants, auth_headers, create_file
    ):
        """Cannot get file details from another tenant."""
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        # Create file in tenant A
        file_a = create_file(
            tenant_id=tenant_a.id,
            filename="secret.pdf",
            category="document"
        )

        # Tenant B tries to access tenant A's file
        response = client.get(
            f"/api/v1/files/{file_a.id}",
            headers=auth_headers(admin_b)
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_download_other_tenant_file(
        self, client, two_tenants, auth_headers, create_file
    ):
        """Cannot get download URL for another tenant's file."""
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        file_a = create_file(
            tenant_id=tenant_a.id,
            filename="confidential.pdf",
            category="document"
        )

        response = client.get(
            f"/api/v1/files/{file_a.id}/download",
            headers=auth_headers(admin_b)
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_delete_other_tenant_file(
        self, client, two_tenants, auth_headers, create_file
    ):
        """Cannot delete another tenant's file."""
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        file_a = create_file(
            tenant_id=tenant_a.id,
            filename="important.pdf",
            category="document"
        )

        response = client.delete(
            f"/api/v1/files/{file_a.id}",
            headers=auth_headers(admin_b)
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_file_list_only_shows_own_tenant(
        self, client, two_tenants, auth_headers, create_file
    ):
        """File list should only show files from user's tenant."""
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        # Create files in both tenants
        create_file(tenant_id=tenant_a.id, filename="file_a.pdf")
        create_file(tenant_id=tenant_a.id, filename="file_a2.pdf")
        create_file(tenant_id=tenant_b.id, filename="file_b.pdf")

        # Tenant A sees only their files
        response_a = client.get("/api/v1/files", headers=auth_headers(admin_a))
        assert response_a.status_code == status.HTTP_200_OK
        data_a = response_a.json()
        assert data_a["total"] == 2
        assert all(f["filename"].startswith("file_a") for f in data_a["items"])

        # Tenant B sees only their file
        response_b = client.get("/api/v1/files", headers=auth_headers(admin_b))
        assert response_b.status_code == status.HTTP_200_OK
        data_b = response_b.json()
        assert data_b["total"] == 1
        assert data_b["items"][0]["filename"] == "file_b.pdf"

    def test_cannot_access_other_tenant_logo(
        self, client, two_tenants, auth_headers, create_file
    ):
        """Cannot access tenant logo from another tenant."""
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        # Create logo for tenant A
        create_file(
            tenant_id=tenant_a.id,
            filename="logo_a.png",
            category="tenant_logo",
            content_type="image/png",
            resource_type="tenant",
            resource_id=tenant_a.id
        )

        # Tenant B gets their own logo endpoint (should return null, not A's logo)
        response = client.get(
            "/api/v1/files/tenant/logo",
            headers=auth_headers(admin_b)
        )

        assert response.status_code == status.HTTP_200_OK
        # Should be null since tenant B has no logo
        assert response.json() is None

    def test_cannot_access_other_tenant_user_avatar(
        self, client, two_tenants, auth_headers, create_file
    ):
        """Cannot access user avatar from another tenant."""
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        # Create avatar for admin A
        create_file(
            tenant_id=tenant_a.id,
            filename="avatar_a.jpg",
            category="user_avatar",
            content_type="image/jpeg",
            resource_type="user",
            resource_id=admin_a.id
        )

        # Tenant B tries to access admin A's avatar
        response = client.get(
            f"/api/v1/files/users/{admin_a.id}/avatar",
            headers=auth_headers(admin_b)
        )

        # Should return null (tenant B can't see tenant A user avatars)
        assert response.status_code == status.HTTP_200_OK
        assert response.json() is None


class TestSystemAdminFileAccess:
    """Test system admin file access with X-Tenant-ID header."""

    def test_system_admin_can_access_tenant_files(
        self, client, tenant_with_admin, super_admin, auth_headers, create_file
    ):
        """System admin can access tenant files via X-Tenant-ID header."""
        tenant, _, owner = tenant_with_admin

        file = create_file(
            tenant_id=tenant.id,
            filename="tenant_file.pdf",
            category="document"
        )

        headers = auth_headers(super_admin)
        headers["X-Tenant-ID"] = str(tenant.id)

        response = client.get(
            f"/api/v1/files/{file.id}",
            headers=headers
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["filename"] == "tenant_file.pdf"

    def test_system_admin_can_list_tenant_files(
        self, client, tenant_with_admin, super_admin, auth_headers, create_file
    ):
        """System admin can list tenant files via X-Tenant-ID header."""
        tenant, _, owner = tenant_with_admin

        create_file(tenant_id=tenant.id, filename="file1.pdf")
        create_file(tenant_id=tenant.id, filename="file2.pdf")

        headers = auth_headers(super_admin)
        headers["X-Tenant-ID"] = str(tenant.id)

        response = client.get(
            "/api/v1/files",
            headers=headers
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["total"] == 2


class TestMemberPermissions:
    """Test that member users have appropriate file permissions."""

    def test_member_can_view_files(
        self, client, tenant_with_admin, create_user, auth_headers, create_file
    ):
        """Member can view files in their tenant."""
        tenant, hq, owner = tenant_with_admin

        member = create_user(
            tenant_id=tenant.id,
            tenant_role="member",
            email="member@test.com",
            default_branch_id=hq.id
        )

        create_file(tenant_id=tenant.id, filename="viewable.pdf")

        response = client.get(
            "/api/v1/files",
            headers=auth_headers(member)
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["total"] == 1

    def test_member_cannot_delete_files(
        self, client, tenant_with_admin, create_user, auth_headers, create_file
    ):
        """Member cannot delete files (requires files.delete permission)."""
        tenant, hq, owner = tenant_with_admin

        member = create_user(
            tenant_id=tenant.id,
            tenant_role="member",
            email="member@test.com",
            default_branch_id=hq.id
        )

        file = create_file(tenant_id=tenant.id, filename="nodeleteme.pdf")

        response = client.delete(
            f"/api/v1/files/{file.id}",
            headers=auth_headers(member)
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
