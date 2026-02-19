"""
Tests for file API endpoints.
"""
import pytest
from fastapi import status


class TestPresignedUploadEndpoint:
    """Test pre-signed URL generation endpoint."""

    def test_get_presigned_url_success(self, client, tenant_with_admin, auth_headers):
        """Successfully get pre-signed upload URL."""
        tenant, _, admin = tenant_with_admin

        response = client.post(
            "/api/v1/files/upload/presign",
            headers=auth_headers(admin),
            json={
                "filename": "report.pdf",
                "content_type": "application/pdf",
                "size_bytes": 1024 * 1024,  # 1MB
                "category": "document",
            }
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "upload_url" in data
        assert "storage_key" in data
        assert "expires_at" in data
        assert data["storage_key"].startswith("documents/")

    def test_get_presigned_url_invalid_content_type(
        self, client, tenant_with_admin, auth_headers
    ):
        """Reject invalid content type for category."""
        tenant, _, admin = tenant_with_admin

        response = client.post(
            "/api/v1/files/upload/presign",
            headers=auth_headers(admin),
            json={
                "filename": "script.exe",
                "content_type": "application/x-executable",
                "size_bytes": 1024,
                "category": "tenant_logo",  # Logo must be image
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_presigned_url_unauthenticated(self, client):
        """Reject unauthenticated requests."""
        response = client.post(
            "/api/v1/files/upload/presign",
            json={
                "filename": "test.pdf",
                "content_type": "application/pdf",
                "size_bytes": 1024,
                "category": "document",
            }
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestFileListEndpoint:
    """Test file list endpoint."""

    def test_list_files_empty(self, client, tenant_with_admin, auth_headers):
        """List returns empty when no files."""
        tenant, _, admin = tenant_with_admin

        response = client.get(
            "/api/v1/files",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_list_files_with_data(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """List returns files for tenant."""
        tenant, _, admin = tenant_with_admin

        create_file(tenant_id=tenant.id, filename="file1.pdf")
        create_file(tenant_id=tenant.id, filename="file2.pdf")

        response = client.get(
            "/api/v1/files",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_list_files_with_category_filter(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """Filter files by category."""
        tenant, _, admin = tenant_with_admin

        create_file(tenant_id=tenant.id, filename="doc.pdf", category="document")
        create_file(
            tenant_id=tenant.id,
            filename="logo.png",
            category="tenant_logo",
            content_type="image/png"
        )

        response = client.get(
            "/api/v1/files?category=document",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["category"] == "document"

    def test_list_files_pagination(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """Test pagination parameters."""
        tenant, _, admin = tenant_with_admin

        for i in range(5):
            create_file(tenant_id=tenant.id, filename=f"file{i}.pdf")

        # First page
        response = client.get(
            "/api/v1/files?page=1&page_size=2",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["total_pages"] == 3


class TestFileDetailEndpoint:
    """Test single file operations."""

    def test_get_file_success(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """Get file details."""
        tenant, _, admin = tenant_with_admin

        file = create_file(
            tenant_id=tenant.id,
            filename="details.pdf",
            size_bytes=2048
        )

        response = client.get(
            f"/api/v1/files/{file.id}",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(file.id)
        assert data["filename"] == "details.pdf"
        assert data["size_bytes"] == 2048

    def test_get_file_not_found(self, client, tenant_with_admin, auth_headers):
        """404 for non-existent file."""
        tenant, _, admin = tenant_with_admin
        import uuid

        response = client.get(
            f"/api/v1/files/{uuid.uuid4()}",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestFileDeleteEndpoint:
    """Test file deletion."""

    def test_delete_file_success(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """Soft delete file."""
        tenant, _, admin = tenant_with_admin

        file = create_file(tenant_id=tenant.id, filename="deleteme.pdf")

        response = client.delete(
            f"/api/v1/files/{file.id}",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify file is not in active list
        list_response = client.get(
            "/api/v1/files",
            headers=auth_headers(admin)
        )
        assert list_response.json()["total"] == 0

    def test_delete_file_not_found(self, client, tenant_with_admin, auth_headers):
        """404 when deleting non-existent file."""
        tenant, _, admin = tenant_with_admin
        import uuid

        response = client.delete(
            f"/api/v1/files/{uuid.uuid4()}",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestStorageUsageEndpoint:
    """Test storage usage endpoint."""

    def test_get_storage_usage(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """Get storage usage statistics."""
        tenant, _, admin = tenant_with_admin
        tenant.storage_used_bytes = 512 * 1024 * 1024  # 512MB
        tenant.max_storage_gb = 1

        create_file(tenant_id=tenant.id, size_bytes=1024)

        response = client.get(
            "/api/v1/files/storage",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["tenant_id"] == str(tenant.id)
        assert data["storage_limit_gb"] == 1
        assert data["file_count"] == 1


class TestTenantLogoEndpoints:
    """Test tenant logo specific endpoints."""

    def test_get_tenant_logo_none(self, client, tenant_with_admin, auth_headers):
        """Returns null when no logo exists."""
        tenant, _, admin = tenant_with_admin

        response = client.get(
            "/api/v1/files/tenant/logo",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json() is None

    def test_get_tenant_logo_exists(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """Returns logo when exists."""
        tenant, _, admin = tenant_with_admin

        create_file(
            tenant_id=tenant.id,
            filename="logo.png",
            category="tenant_logo",
            content_type="image/png",
            resource_type="tenant",
            resource_id=tenant.id
        )

        response = client.get(
            "/api/v1/files/tenant/logo",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["filename"] == "logo.png"
        assert data["category"] == "tenant_logo"

    def test_delete_tenant_logo(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """Delete tenant logo."""
        tenant, _, admin = tenant_with_admin

        create_file(
            tenant_id=tenant.id,
            filename="logo.png",
            category="tenant_logo",
            content_type="image/png",
            resource_type="tenant",
            resource_id=tenant.id
        )

        response = client.delete(
            "/api/v1/files/tenant/logo",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT


class TestUserAvatarEndpoints:
    """Test user avatar specific endpoints."""

    def test_get_user_avatar_none(
        self, client, tenant_with_admin, auth_headers
    ):
        """Returns null when no avatar exists."""
        tenant, _, admin = tenant_with_admin

        response = client.get(
            f"/api/v1/files/users/{admin.id}/avatar",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json() is None

    def test_get_user_avatar_exists(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """Returns avatar when exists."""
        tenant, _, admin = tenant_with_admin

        create_file(
            tenant_id=tenant.id,
            filename="avatar.jpg",
            category="user_avatar",
            content_type="image/jpeg",
            resource_type="user",
            resource_id=admin.id
        )

        response = client.get(
            f"/api/v1/files/users/{admin.id}/avatar",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["filename"] == "avatar.jpg"
        assert data["category"] == "user_avatar"

    def test_member_can_get_own_avatar(
        self, client, tenant_with_admin, create_user, auth_headers, create_file
    ):
        """Member can access their own avatar."""
        tenant, hq, owner = tenant_with_admin

        member = create_user(
            tenant_id=tenant.id,
            tenant_role="member",
            default_branch_id=hq.id
        )

        create_file(
            tenant_id=tenant.id,
            filename="member_avatar.jpg",
            category="user_avatar",
            content_type="image/jpeg",
            resource_type="user",
            resource_id=member.id
        )

        response = client.get(
            f"/api/v1/files/users/{member.id}/avatar",
            headers=auth_headers(member)
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["filename"] == "member_avatar.jpg"

    def test_delete_own_avatar(
        self, client, tenant_with_admin, auth_headers, create_file
    ):
        """User can delete their own avatar."""
        tenant, _, admin = tenant_with_admin

        create_file(
            tenant_id=tenant.id,
            filename="avatar.jpg",
            category="user_avatar",
            content_type="image/jpeg",
            resource_type="user",
            resource_id=admin.id
        )

        response = client.delete(
            f"/api/v1/files/users/{admin.id}/avatar",
            headers=auth_headers(admin)
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT
