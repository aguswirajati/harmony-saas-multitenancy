"""
Tests for FileStorageService.
"""
import pytest
import uuid

from app.services.file_storage_service import FileStorageService
from app.models.file import FileCategory
from app.schemas.file import FileUploadRequest, FileUploadConfirm
from app.core.exceptions import LimitExceededException


class TestFileValidation:
    """Test file validation logic."""

    def test_validate_valid_image(self, db_session):
        """Valid image file should pass validation."""
        service = FileStorageService(db_session)

        is_valid, error = service.validate_file(
            filename="test.jpg",
            content_type="image/jpeg",
            size_bytes=1024 * 1024,  # 1MB
            category=FileCategory.USER_AVATAR
        )

        assert is_valid is True
        assert error is None

    def test_validate_image_too_large(self, db_session):
        """Image exceeding size limit should fail."""
        service = FileStorageService(db_session)

        is_valid, error = service.validate_file(
            filename="large.jpg",
            content_type="image/jpeg",
            size_bytes=10 * 1024 * 1024,  # 10MB (avatar limit is 2MB)
            category=FileCategory.USER_AVATAR
        )

        assert is_valid is False
        assert "exceeds maximum size" in error

    def test_validate_wrong_content_type(self, db_session):
        """Wrong content type for category should fail."""
        service = FileStorageService(db_session)

        is_valid, error = service.validate_file(
            filename="document.pdf",
            content_type="application/pdf",
            size_bytes=1024,
            category=FileCategory.TENANT_LOGO  # Logos must be images
        )

        assert is_valid is False
        assert "not allowed" in error

    def test_validate_document(self, db_session):
        """Valid document should pass."""
        service = FileStorageService(db_session)

        is_valid, error = service.validate_file(
            filename="report.pdf",
            content_type="application/pdf",
            size_bytes=5 * 1024 * 1024,  # 5MB
            category="document"
        )

        assert is_valid is True
        assert error is None

    def test_validate_unknown_category(self, db_session):
        """Unknown category should fail."""
        service = FileStorageService(db_session)

        is_valid, error = service.validate_file(
            filename="test.txt",
            content_type="text/plain",
            size_bytes=1024,
            category="unknown_category"
        )

        assert is_valid is False
        assert "Unknown category" in error


class TestStorageQuota:
    """Test storage quota enforcement."""

    def test_check_quota_has_space(self, db_session, create_tenant):
        """Tenant with available space should pass quota check."""
        tenant = create_tenant()
        tenant.max_storage_gb = 10
        tenant.storage_used_bytes = 1 * 1024 * 1024 * 1024  # 1GB used
        db_session.flush()

        service = FileStorageService(db_session)
        has_quota, error = service.check_storage_quota(
            tenant.id,
            additional_bytes=1024 * 1024  # 1MB
        )

        assert has_quota is True
        assert error is None

    def test_check_quota_exceeded(self, db_session, create_tenant):
        """Tenant at quota limit should fail."""
        tenant = create_tenant()
        tenant.max_storage_gb = 1
        tenant.storage_used_bytes = 1 * 1024 * 1024 * 1024  # Already at 1GB
        db_session.flush()

        service = FileStorageService(db_session)
        has_quota, error = service.check_storage_quota(
            tenant.id,
            additional_bytes=1024 * 1024  # 1MB more
        )

        assert has_quota is False
        assert "quota exceeded" in error.lower()

    def test_check_quota_unlimited(self, db_session, create_tenant):
        """Tenant with unlimited storage (-1) should always pass."""
        tenant = create_tenant()
        tenant.max_storage_gb = -1  # Unlimited
        tenant.storage_used_bytes = 100 * 1024 * 1024 * 1024  # 100GB
        db_session.flush()

        service = FileStorageService(db_session)
        has_quota, error = service.check_storage_quota(
            tenant.id,
            additional_bytes=10 * 1024 * 1024 * 1024  # 10GB more
        )

        assert has_quota is True
        assert error is None


class TestFileRecordCRUD:
    """Test file record CRUD operations."""

    def test_create_file_record(self, db_session, tenant_with_admin):
        """Creating a file record should update storage usage."""
        tenant, _, admin = tenant_with_admin
        initial_storage = tenant.storage_used_bytes

        service = FileStorageService(db_session)

        request = FileUploadRequest(
            filename="test.pdf",
            content_type="application/pdf",
            size_bytes=1024 * 1024,  # 1MB
            category="document",
        )
        confirm = FileUploadConfirm(storage_key="documents/test.pdf")

        file = service.create_file_record(
            tenant_id=tenant.id,
            user_id=admin.id,
            request=request,
            storage_key="documents/test.pdf",
            confirm=confirm
        )

        assert file.id is not None
        assert file.filename == "test.pdf"
        assert file.tenant_id == tenant.id
        assert file.uploaded_by_id == admin.id

        # Check storage updated
        db_session.refresh(tenant)
        assert tenant.storage_used_bytes == initial_storage + 1024 * 1024

    def test_get_file_with_tenant_isolation(self, db_session, two_tenants, create_file):
        """Cannot access file from different tenant."""
        tenant_a, admin_a, tenant_b, admin_b = two_tenants

        file_a = create_file(
            tenant_id=tenant_a.id,
            filename="file_a.txt",
            uploaded_by_id=admin_a.id
        )

        service = FileStorageService(db_session)

        # Tenant A can access
        found = service.get_file(file_a.id, tenant_a.id)
        assert found is not None
        assert found.id == file_a.id

        # Tenant B cannot access
        not_found = service.get_file(file_a.id, tenant_b.id)
        assert not_found is None

    def test_list_files_with_filters(self, db_session, tenant_with_admin, create_file):
        """List files with category filter."""
        tenant, _, admin = tenant_with_admin

        # Create files of different categories
        create_file(tenant.id, filename="doc1.pdf", category="document")
        create_file(tenant.id, filename="doc2.pdf", category="document")
        create_file(
            tenant.id,
            filename="avatar.jpg",
            category=FileCategory.USER_AVATAR,
            content_type="image/jpeg"
        )

        service = FileStorageService(db_session)

        # List all
        files, total = service.list_files(tenant.id)
        assert total == 3

        # List documents only
        docs, doc_total = service.list_files(tenant.id, category="document")
        assert doc_total == 2

        # List avatars only
        avatars, avatar_total = service.list_files(tenant.id, category=FileCategory.USER_AVATAR)
        assert avatar_total == 1

    def test_soft_delete_file(self, db_session, tenant_with_admin, create_file):
        """Soft delete should mark file inactive and update storage."""
        tenant, _, admin = tenant_with_admin

        file = create_file(
            tenant_id=tenant.id,
            filename="to_delete.txt",
            size_bytes=1000,
            uploaded_by_id=admin.id
        )

        # Update tenant storage
        tenant.storage_used_bytes = 1000
        db_session.flush()

        service = FileStorageService(db_session)

        # Import to run async
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            service.delete_file(file.id, tenant.id, admin.id, hard_delete=False)
        )

        assert result is True

        # File should be inactive
        db_session.refresh(file)
        assert file.is_active is False
        assert file.deleted_at is not None
        assert file.deleted_by_id == admin.id

        # Storage should be decremented
        db_session.refresh(tenant)
        assert tenant.storage_used_bytes == 0


class TestResourceFiles:
    """Test resource-specific file operations."""

    def test_get_tenant_logo(self, db_session, tenant_with_admin, create_file):
        """Get tenant logo file."""
        tenant, _, admin = tenant_with_admin

        # Create logo file
        logo = create_file(
            tenant_id=tenant.id,
            filename="logo.png",
            category=FileCategory.TENANT_LOGO,
            content_type="image/png",
            resource_type="tenant",
            resource_id=tenant.id,
        )

        service = FileStorageService(db_session)
        found_logo = service.get_tenant_logo(tenant.id)

        assert found_logo is not None
        assert found_logo.id == logo.id

    def test_get_user_avatar(self, db_session, tenant_with_admin, create_file):
        """Get user avatar file."""
        tenant, _, admin = tenant_with_admin

        # Create avatar file
        avatar = create_file(
            tenant_id=tenant.id,
            filename="avatar.jpg",
            category=FileCategory.USER_AVATAR,
            content_type="image/jpeg",
            resource_type="user",
            resource_id=admin.id,
        )

        service = FileStorageService(db_session)
        found_avatar = service.get_user_avatar(tenant.id, admin.id)

        assert found_avatar is not None
        assert found_avatar.id == avatar.id


class TestStorageUsage:
    """Test storage usage tracking."""

    def test_get_storage_usage(self, db_session, tenant_with_admin, create_file):
        """Get storage usage statistics."""
        tenant, _, admin = tenant_with_admin
        tenant.max_storage_gb = 10
        tenant.storage_used_bytes = 5 * 1024 * 1024 * 1024  # 5GB
        db_session.flush()

        # Create some files
        create_file(tenant.id, size_bytes=1024)
        create_file(tenant.id, size_bytes=2048)

        service = FileStorageService(db_session)
        usage = service.get_storage_usage(tenant.id)

        assert usage.tenant_id == tenant.id
        assert usage.storage_limit_gb == 10
        assert usage.storage_used_gb > 0
        assert usage.file_count == 2
        assert 0 <= usage.usage_percent <= 100

    def test_recalculate_storage_usage(self, db_session, tenant_with_admin, create_file):
        """Recalculate storage should sum active files."""
        tenant, _, admin = tenant_with_admin
        tenant.storage_used_bytes = 0  # Start at 0
        db_session.flush()

        # Create files with known sizes
        create_file(tenant.id, size_bytes=1000, is_active=True)
        create_file(tenant.id, size_bytes=2000, is_active=True)
        create_file(tenant.id, size_bytes=5000, is_active=False)  # Inactive

        service = FileStorageService(db_session)
        recalc = service.recalculate_storage_usage(tenant.id)

        # Should only count active files
        assert recalc == 3000

        db_session.refresh(tenant)
        assert tenant.storage_used_bytes == 3000
