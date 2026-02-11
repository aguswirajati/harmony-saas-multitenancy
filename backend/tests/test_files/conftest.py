"""
Fixtures specific to file storage tests.
"""
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.file import File, FileCategory


@pytest.fixture()
def mock_s3_client():
    """Mock S3 client for tests that don't need real S3."""
    mock_client = AsyncMock()

    # Mock common S3 operations
    mock_client.head_bucket = AsyncMock(return_value={})
    mock_client.create_bucket = AsyncMock(return_value={})
    mock_client.generate_presigned_url = AsyncMock(
        return_value="https://mock-s3.example.com/presigned-url"
    )
    mock_client.put_object = AsyncMock(return_value={})
    mock_client.delete_object = AsyncMock(return_value={})

    # Context manager support
    mock_context = AsyncMock()
    mock_context.__aenter__ = AsyncMock(return_value=mock_client)
    mock_context.__aexit__ = AsyncMock(return_value=None)

    return mock_client, mock_context


@pytest.fixture(autouse=True)
def mock_s3_for_all_tests(mock_s3_client):
    """Automatically mock S3 client for all file tests."""
    _, mock_context = mock_s3_client

    with patch(
        "app.services.file_storage_service.FileStorageService.get_s3_client",
        return_value=mock_context
    ):
        yield


@pytest.fixture()
def create_file(db_session):
    """Factory fixture to create a file record."""
    def _create(
        tenant_id: uuid.UUID,
        filename: str = "test-file.txt",
        storage_key: str | None = None,
        content_type: str = "text/plain",
        size_bytes: int = 1024,
        category: str = "document",
        resource_type: str | None = None,
        resource_id: uuid.UUID | None = None,
        uploaded_by_id: uuid.UUID | None = None,
        is_public: bool = False,
        is_active: bool = True,
    ) -> File:
        file = File(
            tenant_id=tenant_id,
            filename=filename,
            storage_key=storage_key or f"documents/{tenant_id}/{uuid.uuid4()}.txt",
            content_type=content_type,
            size_bytes=size_bytes,
            category=category,
            resource_type=resource_type,
            resource_id=resource_id,
            uploaded_by_id=uploaded_by_id,
            is_public=is_public,
            is_active=is_active,
            file_metadata={},
        )
        db_session.add(file)
        db_session.flush()
        return file
    return _create
