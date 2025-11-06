"""
Fixed User Model - Support for Super Admin

CRITICAL CHANGES:
1. Made tenant_id nullable (allows NULL for super admin)
2. Added is_super_admin field
3. Made default_branch_id nullable (super admin has no branch)
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.base import BaseModel
from uuid import uuid4
import uuid


class User(Base, BaseModel):
    __tablename__ = "users"

    # ========================================
    # FIX: Make tenant_id nullable for super admin
    # Super admin users have tenant_id=None
    # ========================================
    tenant_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("tenants.id"), 
        nullable=True  # ← Changed from nullable=False to nullable=True
    )

    # Auth
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100))
    password_hash = Column(String(255), nullable=False)

    # Profile
    first_name = Column(String(100))
    last_name = Column(String(100))
    full_name = Column(String(255))
    phone = Column(String(50))
    avatar_url = Column(String)

    # Branch
    # ========================================
    # FIX: Make default_branch_id nullable
    # Super admin has no default branch
    # ========================================
    default_branch_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("branches.id"),
        nullable=True  # Already nullable, but confirming
    )

    # Role & permissions
    role = Column(String(50), default='staff')
    permissions = Column(JSON, default=[])

    # ========================================
    # NEW: Add is_super_admin field
    # Identifies system-wide super admin users
    # ========================================
    is_super_admin = Column(Boolean, default=False, nullable=False)

    # Status
    is_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime(timezone=True))
    last_login_at = Column(DateTime(timezone=True))

    # Metadata (renamed from metadata to avoid SQLAlchemy conflict)
    meta_data = Column(JSON, default={})

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    default_branch = relationship("Branch", back_populates="users")
    branch_access = relationship("UserBranchAccess", back_populates="user")


class UserBranchAccess(Base):
    """
    Many-to-many relationship for users with access to multiple branches
    """
    __tablename__ = "user_branch_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)

    branch_role = Column(String(50))
    permissions = Column(JSON, default=[])

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="branch_access")
    branch = relationship("Branch")
