"""
Notification Service
Business logic for notification management
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
import logging

from app.models.notification import (
    Notification,
    NotificationPreference,
    NotificationType,
    NotificationPriority,
    NotificationChannel,
)
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    BulkNotificationCreate,
    NotificationPreferenceUpdate,
)

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for notification management"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # NOTIFICATION CRUD
    # ========================================================================

    def create_notification(
        self,
        user_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        priority: str = NotificationPriority.NORMAL.value,
        tenant_id: Optional[UUID] = None,
        data: Optional[Dict[str, Any]] = None,
        check_preferences: bool = True,
    ) -> Optional[Notification]:
        """
        Create a single notification for a user.
        Returns None if user has disabled this notification type.
        """
        # Check user preferences
        if check_preferences:
            pref = self._get_preference(user_id, notification_type)
            if pref and not pref.in_app_enabled:
                logger.debug(f"Notification {notification_type} disabled for user {user_id}")
                return None

        notification = Notification(
            user_id=user_id,
            tenant_id=tenant_id,
            type=notification_type,
            title=title,
            message=message,
            priority=priority,
            data=data or {},
            channels_sent=[NotificationChannel.IN_APP.value],
        )

        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)

        logger.info(f"Created notification {notification.id} for user {user_id}: {notification_type}")
        return notification

    def create_bulk_notifications(
        self,
        user_ids: List[UUID],
        notification_type: str,
        title: str,
        message: str,
        priority: str = NotificationPriority.NORMAL.value,
        tenant_id: Optional[UUID] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        Create notifications for multiple users.
        Returns the number of notifications created.
        """
        created_count = 0
        for user_id in user_ids:
            notification = self.create_notification(
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                priority=priority,
                tenant_id=tenant_id,
                data=data,
            )
            if notification:
                created_count += 1

        return created_count

    def get_notification(self, notification_id: UUID, user_id: UUID) -> Optional[Notification]:
        """Get a specific notification (user must own it)"""
        return self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
            Notification.is_active == True,
        ).first()

    def list_notifications(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
        notification_type: Optional[str] = None,
    ) -> Tuple[List[Notification], int]:
        """
        List notifications for a user with pagination.
        Returns (notifications, total_count).
        """
        query = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_active == True,
        )

        if unread_only:
            query = query.filter(Notification.is_read == False)

        if notification_type:
            query = query.filter(Notification.type == notification_type)

        # Get total count
        total = query.count()

        # Get paginated results
        notifications = query.order_by(Notification.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return notifications, total

    def get_unread_count(self, user_id: UUID) -> int:
        """Get count of unread notifications for a user"""
        return self.db.query(func.count(Notification.id)).filter(
            Notification.user_id == user_id,
            Notification.is_active == True,
            Notification.is_read == False,
        ).scalar() or 0

    # ========================================================================
    # MARK AS READ
    # ========================================================================

    def mark_as_read(self, notification_ids: List[UUID], user_id: UUID) -> int:
        """Mark specific notifications as read. Returns count updated."""
        result = self.db.query(Notification).filter(
            Notification.id.in_(notification_ids),
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).update(
            {
                Notification.is_read: True,
                Notification.read_at: datetime.utcnow(),
            },
            synchronize_session=False,
        )
        self.db.commit()
        return result

    def mark_all_as_read(
        self,
        user_id: UUID,
        notification_type: Optional[str] = None,
    ) -> int:
        """Mark all notifications as read. Returns count updated."""
        query = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )

        if notification_type:
            query = query.filter(Notification.type == notification_type)

        result = query.update(
            {
                Notification.is_read: True,
                Notification.read_at: datetime.utcnow(),
            },
            synchronize_session=False,
        )
        self.db.commit()
        return result

    # ========================================================================
    # DELETE NOTIFICATIONS
    # ========================================================================

    def delete_notification(self, notification_id: UUID, user_id: UUID) -> bool:
        """Soft delete a notification"""
        notification = self.get_notification(notification_id, user_id)
        if not notification:
            return False

        notification.is_active = False
        notification.deleted_at = datetime.utcnow()
        self.db.commit()
        return True

    def delete_all_read(self, user_id: UUID) -> int:
        """Delete all read notifications for a user"""
        result = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == True,
            Notification.is_active == True,
        ).update(
            {
                Notification.is_active: False,
                Notification.deleted_at: datetime.utcnow(),
            },
            synchronize_session=False,
        )
        self.db.commit()
        return result

    # ========================================================================
    # NOTIFICATION PREFERENCES
    # ========================================================================

    def _get_preference(
        self,
        user_id: UUID,
        notification_type: str,
    ) -> Optional[NotificationPreference]:
        """Get user preference for a notification type"""
        # First try exact match
        pref = self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.notification_type == notification_type,
            NotificationPreference.is_active == True,
        ).first()

        if pref:
            return pref

        # Fall back to wildcard preference
        return self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.notification_type == "*",
            NotificationPreference.is_active == True,
        ).first()

    def get_all_preferences(self, user_id: UUID) -> List[NotificationPreference]:
        """Get all notification preferences for a user"""
        return self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.is_active == True,
        ).all()

    def update_preference(
        self,
        user_id: UUID,
        notification_type: str,
        in_app_enabled: Optional[bool] = None,
        email_enabled: Optional[bool] = None,
        email_digest: Optional[bool] = None,
    ) -> NotificationPreference:
        """Update or create a notification preference"""
        pref = self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.notification_type == notification_type,
        ).first()

        if not pref:
            # Create new preference
            pref = NotificationPreference(
                user_id=user_id,
                notification_type=notification_type,
                in_app_enabled=in_app_enabled if in_app_enabled is not None else True,
                email_enabled=email_enabled if email_enabled is not None else True,
                email_digest=email_digest if email_digest is not None else False,
            )
            self.db.add(pref)
        else:
            # Update existing
            if in_app_enabled is not None:
                pref.in_app_enabled = in_app_enabled
            if email_enabled is not None:
                pref.email_enabled = email_enabled
            if email_digest is not None:
                pref.email_digest = email_digest

        self.db.commit()
        self.db.refresh(pref)
        return pref

    def reset_preferences(self, user_id: UUID) -> int:
        """Reset all preferences to default (delete custom preferences)"""
        result = self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
        ).delete(synchronize_session=False)
        self.db.commit()
        return result

    # ========================================================================
    # CONVENIENCE METHODS FOR COMMON NOTIFICATIONS
    # ========================================================================

    def notify_upgrade_approved(
        self,
        user_id: UUID,
        tenant_id: UUID,
        tier_name: str,
        transaction_id: UUID,
    ) -> Optional[Notification]:
        """Notify user that their upgrade was approved"""
        return self.create_notification(
            user_id=user_id,
            tenant_id=tenant_id,
            notification_type=NotificationType.BILLING_UPGRADE_APPROVED.value,
            title="Upgrade Approved",
            message=f"Your subscription upgrade to {tier_name} has been approved!",
            priority=NotificationPriority.HIGH.value,
            data={
                "transaction_id": str(transaction_id),
                "tier_name": tier_name,
                "action_url": "/settings?tab=subscription",
            },
        )

    def notify_upgrade_rejected(
        self,
        user_id: UUID,
        tenant_id: UUID,
        reason: str,
    ) -> Optional[Notification]:
        """Notify user that their upgrade was rejected"""
        return self.create_notification(
            user_id=user_id,
            tenant_id=tenant_id,
            notification_type=NotificationType.BILLING_UPGRADE_REJECTED.value,
            title="Upgrade Request Rejected",
            message=f"Your upgrade request was rejected: {reason}",
            priority=NotificationPriority.HIGH.value,
            data={
                "reason": reason,
                "action_url": "/upgrade",
            },
        )

    def notify_user_invited(
        self,
        user_id: UUID,
        tenant_id: UUID,
        inviter_name: str,
        tenant_name: str,
    ) -> Optional[Notification]:
        """Notify user they've been invited to a tenant"""
        return self.create_notification(
            user_id=user_id,
            tenant_id=tenant_id,
            notification_type=NotificationType.USER_INVITED.value,
            title="Team Invitation",
            message=f"{inviter_name} has invited you to join {tenant_name}.",
            priority=NotificationPriority.NORMAL.value,
            data={
                "inviter_name": inviter_name,
                "tenant_name": tenant_name,
            },
        )

    def notify_user_joined(
        self,
        admin_user_ids: List[UUID],
        tenant_id: UUID,
        new_user_name: str,
        new_user_email: str,
    ) -> int:
        """Notify tenant admins that a new user joined"""
        return self.create_bulk_notifications(
            user_ids=admin_user_ids,
            tenant_id=tenant_id,
            notification_type=NotificationType.USER_JOINED.value,
            title="New Team Member",
            message=f"{new_user_name} ({new_user_email}) has joined your team.",
            priority=NotificationPriority.NORMAL.value,
            data={
                "user_name": new_user_name,
                "user_email": new_user_email,
                "action_url": "/users",
            },
        )

    def notify_quota_warning(
        self,
        user_id: UUID,
        tenant_id: UUID,
        metric: str,
        percent_used: int,
    ) -> Optional[Notification]:
        """Notify user about quota usage warning"""
        return self.create_notification(
            user_id=user_id,
            tenant_id=tenant_id,
            notification_type=NotificationType.USAGE_QUOTA_WARNING.value,
            title="Usage Warning",
            message=f"Your {metric} usage has reached {percent_used}% of your quota.",
            priority=NotificationPriority.HIGH.value,
            data={
                "metric": metric,
                "percent_used": percent_used,
                "action_url": "/usage",
            },
        )

    def notify_system_announcement(
        self,
        user_ids: List[UUID],
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Send system announcement to multiple users"""
        return self.create_bulk_notifications(
            user_ids=user_ids,
            notification_type=NotificationType.SYSTEM_ANNOUNCEMENT.value,
            title=title,
            message=message,
            priority=NotificationPriority.NORMAL.value,
            data=data,
        )

    # ========================================================================
    # ADMIN OPERATIONS
    # ========================================================================

    def send_to_all_users(
        self,
        notification_type: str,
        title: str,
        message: str,
        priority: str = NotificationPriority.NORMAL.value,
        data: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Send notification to all active users (admin only)"""
        user_ids = self.db.query(User.id).filter(
            User.is_active == True,
        ).all()

        return self.create_bulk_notifications(
            user_ids=[uid[0] for uid in user_ids],
            notification_type=notification_type,
            title=title,
            message=message,
            priority=priority,
            data=data,
        )

    def send_to_tenant_users(
        self,
        tenant_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        priority: str = NotificationPriority.NORMAL.value,
        data: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Send notification to all users in a tenant"""
        user_ids = self.db.query(User.id).filter(
            User.tenant_id == tenant_id,
            User.is_active == True,
        ).all()

        return self.create_bulk_notifications(
            user_ids=[uid[0] for uid in user_ids],
            tenant_id=tenant_id,
            notification_type=notification_type,
            title=title,
            message=message,
            priority=priority,
            data=data,
        )

    def get_notification_stats(self, user_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Get notification statistics"""
        query = self.db.query(Notification).filter(Notification.is_active == True)

        if user_id:
            query = query.filter(Notification.user_id == user_id)

        total = query.count()
        unread = query.filter(Notification.is_read == False).count()

        # Type breakdown
        type_counts = self.db.query(
            Notification.type,
            func.count(Notification.id),
        ).filter(
            Notification.is_active == True,
        )
        if user_id:
            type_counts = type_counts.filter(Notification.user_id == user_id)
        type_counts = type_counts.group_by(Notification.type).all()

        return {
            "total": total,
            "unread": unread,
            "read": total - unread,
            "by_type": {t: c for t, c in type_counts},
        }
