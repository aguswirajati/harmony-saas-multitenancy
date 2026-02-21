"""
Notification Models
Stores user notifications and preferences
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime, Enum as SQLEnum, ForeignKey, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

from app.core.database import Base
from app.models.base import BaseModel


class NotificationType(str, enum.Enum):
    """Types of notifications"""
    # System notifications (from platform)
    SYSTEM_ANNOUNCEMENT = "system.announcement"
    SYSTEM_MAINTENANCE = "system.maintenance"

    # Billing/Subscription notifications
    BILLING_UPGRADE_APPROVED = "billing.upgrade_approved"
    BILLING_UPGRADE_REJECTED = "billing.upgrade_rejected"
    BILLING_PAYMENT_RECEIVED = "billing.payment_received"
    BILLING_SUBSCRIPTION_EXPIRING = "billing.subscription_expiring"
    BILLING_SUBSCRIPTION_EXPIRED = "billing.subscription_expired"

    # User notifications
    USER_INVITED = "user.invited"
    USER_JOINED = "user.joined"
    USER_ROLE_CHANGED = "user.role_changed"
    USER_REMOVED = "user.removed"

    # Tenant notifications
    TENANT_SETTINGS_CHANGED = "tenant.settings_changed"
    TENANT_BRANCH_CREATED = "tenant.branch_created"
    TENANT_BRANCH_DELETED = "tenant.branch_deleted"

    # Usage/Quota notifications
    USAGE_QUOTA_WARNING = "usage.quota_warning"
    USAGE_QUOTA_EXCEEDED = "usage.quota_exceeded"

    # Security notifications
    SECURITY_LOGIN_NEW_DEVICE = "security.login_new_device"
    SECURITY_PASSWORD_CHANGED = "security.password_changed"


class NotificationPriority(str, enum.Enum):
    """Priority levels for notifications"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationChannel(str, enum.Enum):
    """Delivery channels for notifications"""
    IN_APP = "in_app"
    EMAIL = "email"
    # Future: push, sms, webhook


class Notification(Base, BaseModel):
    """
    Individual notification record.
    Each notification is sent to a specific user.
    """
    __tablename__ = "notifications"

    # Target user
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Optional tenant context (for tenant-scoped notifications)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)

    # Notification content
    type = Column(String(50), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(20), default=NotificationPriority.NORMAL.value, nullable=False)

    # Additional data (JSON) - for action URLs, related entity IDs, etc.
    data = Column(JSON, nullable=True)

    # Status
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)

    # Delivery tracking
    channels_sent = Column(JSON, default=list)  # ["in_app", "email"]
    email_sent_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
    tenant = relationship("Tenant", back_populates="notifications")

    # Indexes for common queries
    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", "is_read", "created_at"),
        Index("ix_notifications_tenant_created", "tenant_id", "created_at"),
        Index("ix_notifications_type_created", "type", "created_at"),
    )

    def mark_as_read(self):
        """Mark notification as read"""
        self.is_read = True
        self.read_at = datetime.utcnow()


class NotificationPreference(Base, BaseModel):
    """
    User preferences for notification delivery.
    Controls which notifications are enabled and through which channels.
    """
    __tablename__ = "notification_preferences"

    # Target user
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Notification type (use '*' for global default)
    notification_type = Column(String(50), nullable=False)

    # Channel preferences
    in_app_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=True, nullable=False)

    # Email digest preferences
    email_digest = Column(Boolean, default=False, nullable=False)  # Batch emails instead of immediate

    # Relationships
    user = relationship("User", back_populates="notification_preferences")

    __table_args__ = (
        Index("ix_notification_prefs_user_type", "user_id", "notification_type", unique=True),
    )
