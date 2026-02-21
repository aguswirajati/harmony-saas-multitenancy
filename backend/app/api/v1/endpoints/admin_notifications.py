"""
Admin Notification API Endpoints
System-wide notification management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import re

from app.api.deps import get_db, get_system_admin_user
from app.models.user import User
from app.models.notification import NotificationType, NotificationPriority
from app.services.notification_service import NotificationService
from app.schemas.notification import (
    AdminNotificationCreate,
    AdminNotificationResponse,
)

router = APIRouter()


@router.post("/send", response_model=AdminNotificationResponse)
async def send_notification(
    data: AdminNotificationCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_system_admin_user),
):
    """
    Send a system notification.

    Target formats:
    - "all" - Send to all users
    - "all_tenants" - Send to all tenant users (excluding system users)
    - "tenant:<tenant_id>" - Send to all users in a specific tenant
    - "user:<user_id>" - Send to a specific user
    """
    service = NotificationService(db)
    target = data.target.lower().strip()

    notification_type = NotificationType.SYSTEM_ANNOUNCEMENT.value
    count = 0

    if target == "all":
        count = service.send_to_all_users(
            notification_type=notification_type,
            title=data.title,
            message=data.message,
            priority=data.priority.value,
            data=data.data,
        )
    elif target == "all_tenants":
        # Send to all users who belong to a tenant
        from app.models.user import User as UserModel
        user_ids = db.query(UserModel.id).filter(
            UserModel.tenant_id.isnot(None),
            UserModel.is_active == True,
        ).all()

        count = service.create_bulk_notifications(
            user_ids=[uid[0] for uid in user_ids],
            notification_type=notification_type,
            title=data.title,
            message=data.message,
            priority=data.priority.value,
            data=data.data,
        )
    elif target.startswith("tenant:"):
        tenant_id_str = target.replace("tenant:", "").strip()
        try:
            tenant_id = UUID(tenant_id_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid tenant ID format")

        count = service.send_to_tenant_users(
            tenant_id=tenant_id,
            notification_type=notification_type,
            title=data.title,
            message=data.message,
            priority=data.priority.value,
            data=data.data,
        )
    elif target.startswith("user:"):
        user_id_str = target.replace("user:", "").strip()
        try:
            user_id = UUID(user_id_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user ID format")

        notification = service.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=data.title,
            message=data.message,
            priority=data.priority.value,
            data=data.data,
            check_preferences=False,  # Admin notifications bypass preferences
        )
        count = 1 if notification else 0
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid target format. Use 'all', 'all_tenants', 'tenant:<id>', or 'user:<id>'"
        )

    return AdminNotificationResponse(
        notifications_sent=count,
        target=data.target,
    )


@router.get("/stats")
async def get_notification_stats(
    tenant_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_system_admin_user),
):
    """Get notification statistics (optionally for a specific tenant)"""
    service = NotificationService(db)

    # If tenant_id provided, get stats for users in that tenant
    if tenant_id:
        from app.models.user import User as UserModel
        from app.models.notification import Notification
        from sqlalchemy import func

        # Get all user IDs in tenant
        user_ids = db.query(UserModel.id).filter(
            UserModel.tenant_id == tenant_id,
        ).all()
        user_id_list = [uid[0] for uid in user_ids]

        total = db.query(func.count(Notification.id)).filter(
            Notification.user_id.in_(user_id_list),
            Notification.is_active == True,
        ).scalar() or 0

        unread = db.query(func.count(Notification.id)).filter(
            Notification.user_id.in_(user_id_list),
            Notification.is_active == True,
            Notification.is_read == False,
        ).scalar() or 0

        return {
            "tenant_id": str(tenant_id),
            "total": total,
            "unread": unread,
            "read": total - unread,
        }

    # Global stats
    from app.models.notification import Notification
    from sqlalchemy import func

    total = db.query(func.count(Notification.id)).filter(
        Notification.is_active == True,
    ).scalar() or 0

    unread = db.query(func.count(Notification.id)).filter(
        Notification.is_active == True,
        Notification.is_read == False,
    ).scalar() or 0

    # Type breakdown
    type_counts = db.query(
        Notification.type,
        func.count(Notification.id),
    ).filter(
        Notification.is_active == True,
    ).group_by(Notification.type).all()

    return {
        "total": total,
        "unread": unread,
        "read": total - unread,
        "by_type": {t: c for t, c in type_counts},
    }


@router.get("/types")
async def get_notification_types_admin(
    admin: User = Depends(get_system_admin_user),
):
    """Get all notification types with categories (admin view)"""
    types_by_category = {}

    for nt in NotificationType:
        category = nt.value.split(".")[0].title()
        if category not in types_by_category:
            types_by_category[category] = []

        types_by_category[category].append({
            "type": nt.value,
            "name": nt.name.replace("_", " ").title(),
        })

    return {
        "categories": types_by_category,
        "priorities": [p.value for p in NotificationPriority],
    }
