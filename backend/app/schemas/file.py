"""
File schemas for upload, storage, and retrieval operations.
"""
from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal


# ============================================================================
# FILE CATEGORY LITERALS
# ============================================================================

FileCategory = Literal["tenant_logo", "user_avatar", "document", "attachment", "payment_proof"]


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class FileUploadRequest(BaseModel):
    """Request to get a pre-signed upload URL"""
    filename: str = Field(..., min_length=1, max_length=255, description="Original filename")
    content_type: str = Field(..., description="MIME type of the file")
    size_bytes: int = Field(..., gt=0, description="File size in bytes")
    category: FileCategory = Field(..., description="File category")
    resource_type: Optional[str] = Field(None, max_length=50, description="Linked resource type")
    resource_id: Optional[UUID] = Field(None, description="Linked resource ID")
    is_public: bool = Field(default=False, description="Whether file is publicly accessible")

    @field_validator('content_type')
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if not v or '/' not in v:
            raise ValueError('Invalid content type format')
        return v.lower()

    @field_validator('filename')
    @classmethod
    def validate_filename(cls, v: str) -> str:
        # Basic filename sanitization
        dangerous_chars = ['..', '/', '\\', '\x00']
        for char in dangerous_chars:
            if char in v:
                raise ValueError(f'Invalid character in filename: {char!r}')
        return v


class FileUploadConfirm(BaseModel):
    """Confirm upload completion and finalize file record"""
    storage_key: str = Field(..., description="S3 storage key from presigned URL")
    checksum: Optional[str] = Field(None, max_length=64, description="SHA-256 checksum")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")


class FileUpdateRequest(BaseModel):
    """Update file metadata"""
    filename: Optional[str] = Field(None, min_length=1, max_length=255)
    metadata: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class PresignedUploadResponse(BaseModel):
    """Response with pre-signed upload URL and metadata"""
    upload_url: str = Field(..., description="Pre-signed URL for direct S3 upload")
    storage_key: str = Field(..., description="S3 object key to use")
    expires_at: datetime = Field(..., description="URL expiration time")
    max_size_bytes: int = Field(..., description="Maximum allowed file size")
    fields: Optional[Dict[str, str]] = Field(None, description="Form fields for multipart upload")


class FileResponse(BaseModel):
    """File metadata response"""
    id: UUID
    filename: str
    storage_key: str
    content_type: str
    size_bytes: int
    category: str
    resource_type: Optional[str] = None
    resource_id: Optional[UUID] = None
    checksum: Optional[str] = None
    metadata: Dict[str, Any] = {}
    is_public: bool = False

    tenant_id: UUID
    branch_id: Optional[UUID] = None
    uploaded_by_id: Optional[UUID] = None

    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Computed
    size_mb: float = 0.0
    is_image: bool = False

    class Config:
        from_attributes = True


class FileDownloadResponse(BaseModel):
    """Response with download URL"""
    download_url: str = Field(..., description="Pre-signed download URL")
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(..., description="MIME type")
    size_bytes: int = Field(..., description="File size")
    expires_at: datetime = Field(..., description="URL expiration time")


class FileListResponse(BaseModel):
    """Paginated list of files"""
    items: List[FileResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# SPECIALIZED UPLOAD SCHEMAS
# ============================================================================

class TenantLogoUpload(BaseModel):
    """Request for tenant logo upload"""
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., description="Must be an image type")
    size_bytes: int = Field(..., gt=0)

    @field_validator('content_type')
    @classmethod
    def validate_image_type(cls, v: str) -> str:
        if not v.startswith('image/'):
            raise ValueError('Content type must be an image type (image/*)')
        return v.lower()


class UserAvatarUpload(BaseModel):
    """Request for user avatar upload"""
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., description="Must be an image type")
    size_bytes: int = Field(..., gt=0)

    @field_validator('content_type')
    @classmethod
    def validate_image_type(cls, v: str) -> str:
        if not v.startswith('image/'):
            raise ValueError('Content type must be an image type (image/*)')
        return v.lower()


# ============================================================================
# STORAGE QUOTA SCHEMAS
# ============================================================================

class StorageUsageResponse(BaseModel):
    """Current storage usage for a tenant"""
    tenant_id: UUID
    storage_used_bytes: int
    storage_used_mb: float
    storage_used_gb: float
    storage_limit_gb: int
    storage_available_gb: float
    usage_percent: float
    is_limit_reached: bool = False
    file_count: int = 0

    class Config:
        json_schema_extra = {
            "example": {
                "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
                "storage_used_bytes": 104857600,
                "storage_used_mb": 100.0,
                "storage_used_gb": 0.1,
                "storage_limit_gb": 1,
                "storage_available_gb": 0.9,
                "usage_percent": 10.0,
                "is_limit_reached": False,
                "file_count": 25
            }
        }
