"""
User Model - System and Tenant Scoped Users

User Architecture:
- System Users (tenant_id=NULL): Manage the SaaS platform
  - system_role='admin': Full platform control
  - system_role='operator': Limited platform access (support)

- Tenant Users (tenant_id=UUID): Customer business operations
  - tenant_role='owner': Primary account holder, billing authority (1 per tenant)
  - tenant_role='admin': Delegated admin, no billing access
  - tenant_role='member': Regular team member, business operations
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, JSON, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.base import BaseModel
from uuid import uuid4
import uuid
import enum


class SystemRole(str, enum.Enum):
    """Roles for system users (tenant_id=NULL)"""
    ADMIN = "admin"
    OPERATOR = "operator"


class TenantRole(str, enum.Enum):
    """Roles for tenant users (tenant_id=UUID)"""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class User(Base, BaseModel):
    __tablename__ = "users"

    # Scope identifier
    # NULL = System User, NOT NULL = Tenant User
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=True
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
    default_branch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("branches.id"),
        nullable=True
    )

    # ========================================
    # NEW: Scope-based role columns
    # ========================================

    # System scope (when tenant_id IS NULL)
    system_role = Column(
        Enum(SystemRole, name='system_role_enum', create_type=False,
             values_callable=lambda obj: [e.value for e in obj]),
        nullable=True
    )

    # Tenant scope (when tenant_id IS NOT NULL)
    tenant_role = Column(
        Enum(TenantRole, name='tenant_role_enum', create_type=False,
             values_callable=lambda obj: [e.value for e in obj]),
        nullable=True
    )

    # Business scope (for tenant members with business features, e.g., ERP)
    business_role = Column(String(50), nullable=True)

    # Legacy permissions (kept for backward compatibility, may be removed)
    permissions = Column(JSON, default=[])

    # Status
    is_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime(timezone=True))
    last_login_at = Column(DateTime(timezone=True))

    # Email verification and password reset tokens
    verification_token = Column(String(255), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Invitation
    invitation_token = Column(String(255), nullable=True)
    invitation_expires_at = Column(DateTime(timezone=True), nullable=True)
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Metadata (renamed from metadata to avoid SQLAlchemy conflict)
    meta_data = Column(JSON, default={})

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    default_branch = relationship("Branch", back_populates="users")
    branch_access = relationship("UserBranchAccess", back_populates="user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    notification_preferences = relationship("NotificationPreference", back_populates="user", cascade="all, delete-orphan")

    # ========================================
    # Helper properties
    # ========================================

    @property
    def is_system_user(self) -> bool:
        """Check if user is a system user (manages platform)"""
        return self.tenant_id is None

    @property
    def is_tenant_user(self) -> bool:
        """Check if user belongs to a tenant"""
        return self.tenant_id is not None

    @property
    def is_system_admin(self) -> bool:
        """Check if user is a system admin (full platform control)"""
        return self.is_system_user and self.system_role == SystemRole.ADMIN

    @property
    def is_system_operator(self) -> bool:
        """Check if user is a system operator (limited platform access)"""
        return self.is_system_user and self.system_role == SystemRole.OPERATOR

    @property
    def is_tenant_owner(self) -> bool:
        """Check if user is the tenant owner (billing authority)"""
        return self.is_tenant_user and self.tenant_role == TenantRole.OWNER

    @property
    def is_tenant_admin(self) -> bool:
        """Check if user is a tenant admin (delegated admin, no billing)"""
        return self.is_tenant_user and self.tenant_role == TenantRole.ADMIN

    @property
    def is_tenant_member(self) -> bool:
        """Check if user is a tenant member (business operations)"""
        return self.is_tenant_user and self.tenant_role == TenantRole.MEMBER

    @property
    def can_manage_billing(self) -> bool:
        """Check if user can manage tenant billing"""
        return self.is_tenant_owner

    @property
    def can_delete_account(self) -> bool:
        """Check if user can delete the tenant account"""
        return self.is_tenant_owner

    # ========================================
    # Backward compatibility properties
    # These map old role names to new structure
    # TODO: Remove after full migration
    # ========================================

    @property
    def role(self) -> str:
        """Backward compatibility: Get role string"""
        if self.is_system_user:
            # Return "super_admin" for system admins to maintain backward compatibility
            # with ROLE_PERMISSIONS mapping
            if self.system_role == SystemRole.ADMIN:
                return "super_admin"
            return f"system_{self.system_role.value}" if self.system_role else "super_admin"
        else:
            return self.tenant_role.value if self.tenant_role else "member"

    @property
    def is_super_admin(self) -> bool:
        """Backward compatibility: Check if super admin"""
        return self.is_system_admin


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
