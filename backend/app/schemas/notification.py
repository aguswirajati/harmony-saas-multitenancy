"""
Notification Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class NotificationTypeEnum(str, Enum):
    """Notification types"""
    # System
    SYSTEM_ANNOUNCEMENT = "system.announcement"
    SYSTEM_MAINTENANCE = "system.maintenance"

    # Billing
    BILLING_UPGRADE_APPROVED = "billing.upgrade_approved"
    BILLING_UPGRADE_REJECTED = "billing.upgrade_rejected"
    BILLING_PAYMENT_RECEIVED = "billing.payment_received"
    BILLING_SUBSCRIPTION_EXPIRING = "billing.subscription_expiring"
    BILLING_SUBSCRIPTION_EXPIRED = "billing.subscription_expired"

    # User
    USER_INVITED = "user.invited"
    USER_JOINED = "user.joined"
    USER_ROLE_CHANGED = "user.role_changed"
    USER_REMOVED = "user.removed"

    # Tenant
    TENANT_SETTINGS_CHANGED = "tenant.settings_changed"
    TENANT_BRANCH_CREATED = "tenant.branch_created"
    TENANT_BRANCH_DELETED = "tenant.branch_deleted"

    # Usage
    USAGE_QUOTA_WARNING = "usage.quota_warning"
    USAGE_QUOTA_EXCEEDED = "usage.quota_exceeded"

    # Security
    SECURITY_LOGIN_NEW_DEVICE = "security.login_new_device"
    SECURITY_PASSWORD_CHANGED = "security.password_changed"


class NotificationPriorityEnum(str, Enum):
    """Priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# ============================================================================
# Notification Responses
# ============================================================================

class NotificationResponse(BaseModel):
    """Single notification response"""
    id: UUID
    type: str
    title: str
    message: str
    priority: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """List of notifications with pagination"""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    total_pages: int


class NotificationCountResponse(BaseModel):
    """Unread notification count"""
    unread_count: int


# ============================================================================
# Notification Actions
# ============================================================================

class MarkReadRequest(BaseModel):
    """Mark notifications as read"""
    notification_ids: List[UUID] = Field(..., min_length=1, max_length=100)


class MarkAllReadRequest(BaseModel):
    """Mark all notifications as read (optional type filter)"""
    notification_type: Optional[str] = None


# ============================================================================
# Notification Creation (Internal Use)
# ============================================================================

class NotificationCreate(BaseModel):
    """Create a notification (internal service use)"""
    user_id: UUID
    tenant_id: Optional[UUID] = None
    type: str
    title: str
    message: str
    priority: str = NotificationPriorityEnum.NORMAL.value
    data: Optional[Dict[str, Any]] = None


class BulkNotificationCreate(BaseModel):
    """Send notification to multiple users"""
    user_ids: List[UUID]
    tenant_id: Optional[UUID] = None
    type: str
    title: str
    message: str
    priority: str = NotificationPriorityEnum.NORMAL.value
    data: Optional[Dict[str, Any]] = None


# ============================================================================
# Notification Preferences
# ============================================================================

class NotificationPreferenceResponse(BaseModel):
    """User's notification preference for a type"""
    notification_type: str
    in_app_enabled: bool
    email_enabled: bool
    email_digest: bool

    class Config:
        from_attributes = True


class NotificationPreferencesResponse(BaseModel):
    """All notification preferences for a user"""
    preferences: List[NotificationPreferenceResponse]


class NotificationPreferenceUpdate(BaseModel):
    """Update notification preference"""
    notification_type: str
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    email_digest: Optional[bool] = None


class BulkPreferenceUpdate(BaseModel):
    """Update multiple preferences at once"""
    preferences: List[NotificationPreferenceUpdate]


# ============================================================================
# Admin Notifications
# ============================================================================

class AdminNotificationCreate(BaseModel):
    """Admin creates a system notification"""
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    priority: NotificationPriorityEnum = NotificationPriorityEnum.NORMAL
    target: str = Field(..., description="Target: 'all', 'all_tenants', 'tenant:<id>', 'user:<id>'")
    data: Optional[Dict[str, Any]] = None


class AdminNotificationResponse(BaseModel):
    """Response after admin creates notification"""
    notifications_sent: int
    target: str
