from sqlalchemy import Column, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

class BaseModel:
    """Base model with common fields for all tables"""

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit: who did it
    created_by_id = Column(UUID(as_uuid=True), nullable=True)
    updated_by_id = Column(UUID(as_uuid=True), nullable=True)
    deleted_by_id = Column(UUID(as_uuid=True), nullable=True)


class TenantScopedModel(BaseModel):
    """Base for all domain models that belong to a tenant.

    Provides:
    - tenant_id (required): Links to tenants table for data isolation
    - branch_id (optional): Links to branches table for branch-level scoping
    """
    __abstract__ = True

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    branch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
