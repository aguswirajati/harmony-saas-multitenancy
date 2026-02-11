"""
File model for S3-compatible file storage with tenant isolation.
Supports tenant logos, user avatars, and document attachments.
"""
from sqlalchemy import Column, String, BigInteger, Boolean, JSON, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TenantScopedModel


class FileCategory:
    """File category constants"""
    TENANT_LOGO = "tenant_logo"
    USER_AVATAR = "user_avatar"
    DOCUMENT = "document"
    ATTACHMENT = "attachment"


class File(Base, TenantScopedModel):
    """
    File model for storing file metadata with S3 storage.
    Actual files are stored in S3; this tracks metadata and enables tenant isolation.
    """
    __tablename__ = "files"

    # File info
    filename = Column(String(255), nullable=False, comment="Original filename")
    storage_key = Column(String(512), nullable=False, unique=True, index=True,
                        comment="S3 object key/path")
    content_type = Column(String(100), nullable=False, comment="MIME type")
    size_bytes = Column(BigInteger, nullable=False, comment="File size in bytes")

    # Categorization
    category = Column(String(50), nullable=False, index=True,
                     comment="File category: tenant_logo, user_avatar, document, attachment")

    # Resource linkage (polymorphic association)
    resource_type = Column(String(50), nullable=True, index=True,
                          comment="Linked resource type: tenant, user, branch, etc.")
    resource_id = Column(UUID(as_uuid=True), nullable=True, index=True,
                        comment="Linked resource ID")

    # Integrity & metadata
    checksum = Column(String(64), nullable=True, comment="SHA-256 checksum")
    file_metadata = Column(JSON, default=dict, comment="Additional file metadata (dimensions, etc.)")

    # Access control
    is_public = Column(Boolean, default=False, nullable=False,
                      comment="If true, file can be accessed without auth")

    # Uploader tracking
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                           nullable=True, index=True)

    # Relationships
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])

    # Composite indexes for common queries
    __table_args__ = (
        Index("ix_files_tenant_category", "tenant_id", "category"),
        Index("ix_files_resource", "resource_type", "resource_id"),
        Index("ix_files_tenant_created", "tenant_id", "created_at"),
    )

    def __repr__(self):
        return f"<File {self.filename} ({self.category})>"

    @property
    def size_mb(self) -> float:
        """Return file size in megabytes"""
        return round(self.size_bytes / (1024 * 1024), 2)

    @property
    def is_image(self) -> bool:
        """Check if file is an image based on content type"""
        return self.content_type.startswith("image/")
