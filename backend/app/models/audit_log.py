from sqlalchemy import Column, String, DateTime, UUID, Text, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.models.base import BaseModel
import uuid


class AuditLog(Base, BaseModel):
    """
    Audit log model for tracking all critical actions in the system.

    This table tracks:
    - User authentication events (login, logout, password changes)
    - Tenant management (create, update, delete, activate, deactivate)
    - User management (create, update, delete, role changes)
    - Branch management (create, update, delete)
    - Settings changes
    - Any other critical business operations

    Purpose:
    - Compliance and regulatory requirements
    - Security investigation and forensics
    - User activity monitoring
    - Debugging and troubleshooting
    - Analytics and reporting
    """

    __tablename__ = "audit_logs"

    # Core audit fields
    user_id = Column(
        UUID(as_uuid=True),
        nullable=True,  # Nullable for system actions or unauthenticated events
        index=True,
        comment="ID of the user who performed the action (null for system actions)"
    )

    tenant_id = Column(
        UUID(as_uuid=True),
        nullable=True,  # Nullable for super admin actions or tenant-independent events
        index=True,
        comment="ID of the tenant context where action occurred"
    )

    # Action details
    action = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Action performed (e.g., 'login', 'user.create', 'tenant.update')"
    )

    resource = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Resource type affected (e.g., 'user', 'tenant', 'branch', 'settings')"
    )

    resource_id = Column(
        UUID(as_uuid=True),
        nullable=True,  # Nullable for actions that don't target specific resource
        index=True,
        comment="ID of the specific resource affected"
    )

    # Additional context
    details = Column(
        JSON,
        nullable=True,
        comment="Additional action details (before/after values, error info, etc.)"
    )

    status = Column(
        String(20),
        nullable=False,
        default="success",
        comment="Action outcome: 'success', 'failure', 'error'"
    )

    # Request metadata
    ip_address = Column(
        String(45),  # IPv6 max length
        nullable=True,
        index=True,
        comment="Client IP address"
    )

    user_agent = Column(
        Text,
        nullable=True,
        comment="Client user agent string"
    )

    request_id = Column(
        String(36),  # UUID length
        nullable=True,
        index=True,
        comment="Request ID for correlation with application logs"
    )

    # Timestamp (inherited from BaseModel: created_at, updated_at)
    # We'll use created_at as the action timestamp

    # Indexes for common queries
    __table_args__ = (
        Index('ix_audit_logs_user_created', 'user_id', 'created_at'),
        Index('ix_audit_logs_tenant_created', 'tenant_id', 'created_at'),
        Index('ix_audit_logs_action_created', 'action', 'created_at'),
        Index('ix_audit_logs_resource_created', 'resource', 'created_at'),
        Index('ix_audit_logs_status_created', 'status', 'created_at'),
    )

    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, resource={self.resource}, user_id={self.user_id}, status={self.status})>"

    @property
    def action_timestamp(self) -> datetime:
        """Convenience property for the action timestamp"""
        return self.created_at

    def to_dict(self):
        """Convert audit log to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "tenant_id": str(self.tenant_id) if self.tenant_id else None,
            "action": self.action,
            "resource": self.resource,
            "resource_id": str(self.resource_id) if self.resource_id else None,
            "details": self.details,
            "status": self.status,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "request_id": self.request_id,
            "timestamp": self.created_at.isoformat() if self.created_at else None,
        }


# Action type constants for consistency
class AuditAction:
    """Standardized audit action names"""

    # Authentication
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    LOGIN_FAILED = "auth.login_failed"
    PASSWORD_RESET_REQUEST = "auth.password_reset_request"
    PASSWORD_RESET = "auth.password_reset"
    PASSWORD_CHANGED = "auth.password_changed"
    EMAIL_VERIFIED = "auth.email_verified"
    TOKEN_REFRESHED = "auth.token_refreshed"

    # Tenant management
    TENANT_CREATED = "tenant.created"
    TENANT_UPDATED = "tenant.updated"
    TENANT_DELETED = "tenant.deleted"
    TENANT_ACTIVATED = "tenant.activated"
    TENANT_DEACTIVATED = "tenant.deactivated"
    TENANT_SUBSCRIPTION_CHANGED = "tenant.subscription_changed"

    # User management
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_ACTIVATED = "user.activated"
    USER_DEACTIVATED = "user.deactivated"
    USER_ROLE_CHANGED = "user.role_changed"
    USER_INVITED = "user.invited"

    # Branch management
    BRANCH_CREATED = "branch.created"
    BRANCH_UPDATED = "branch.updated"
    BRANCH_DELETED = "branch.deleted"
    BRANCH_ACTIVATED = "branch.activated"
    BRANCH_DEACTIVATED = "branch.deactivated"

    # Settings
    SETTINGS_UPDATED = "settings.updated"

    # File management
    FILE_UPLOADED = "file.uploaded"
    FILE_DELETED = "file.deleted"
    FILE_UPDATED = "file.updated"
    TENANT_LOGO_UPLOADED = "tenant.logo_uploaded"
    TENANT_LOGO_DELETED = "tenant.logo_deleted"
    USER_AVATAR_UPLOADED = "user.avatar_uploaded"
    USER_AVATAR_DELETED = "user.avatar_deleted"

    # System
    SYSTEM_ERROR = "system.error"

    # Subscription Tiers
    TIER_CREATED = "tier.created"
    TIER_UPDATED = "tier.updated"
    TIER_DELETED = "tier.deleted"

    # Payment Methods
    PAYMENT_METHOD_CREATED = "payment_method.created"
    PAYMENT_METHOD_UPDATED = "payment_method.updated"
    PAYMENT_METHOD_DELETED = "payment_method.deleted"

    # Upgrade Requests
    UPGRADE_REQUESTED = "upgrade.requested"
    UPGRADE_UPDATED = "upgrade.updated"
    UPGRADE_PROOF_UPLOADED = "upgrade.proof_uploaded"
    UPGRADE_APPROVED = "upgrade.approved"
    UPGRADE_REJECTED = "upgrade.rejected"
    UPGRADE_CANCELLED = "upgrade.cancelled"

    # Billing Transactions (Command Center)
    BILLING_TRANSACTION_APPROVED = "billing.transaction_approved"
    BILLING_TRANSACTION_REJECTED = "billing.transaction_rejected"
    COUPON_APPLIED = "billing.coupon_applied"
    DISCOUNT_APPLIED = "billing.discount_applied"
    BONUS_DAYS_ADDED = "billing.bonus_days_added"
    MANUAL_TRANSACTION_CREATED = "billing.manual_transaction_created"


# Status constants
class AuditStatus:
    """Audit log status values"""
    SUCCESS = "success"
    FAILURE = "failure"
    ERROR = "error"
