"""
Notification API Endpoints
User notification management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
import math

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.models.notification import NotificationType
from app.services.notification_service import NotificationService
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationCountResponse,
    MarkReadRequest,
    MarkAllReadRequest,
    NotificationPreferenceResponse,
    NotificationPreferencesResponse,
    NotificationPreferenceUpdate,
    BulkPreferenceUpdate,
)

router = APIRouter()


# ============================================================================
# NOTIFICATION LISTING
# ============================================================================

@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    notification_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List notifications for the current user.
    Supports pagination and filtering by read status and type.
    """
    service = NotificationService(db)

    notifications, total = service.list_notifications(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        unread_only=unread_only,
        notification_type=notification_type,
    )

    unread_count = service.get_unread_count(current_user.id)

    return NotificationListResponse(
        notifications=[
            NotificationResponse.model_validate(n) for n in notifications
        ],
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.get("/count", response_model=NotificationCountResponse)
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get the count of unread notifications"""
    service = NotificationService(db)
    count = service.get_unread_count(current_user.id)
    return NotificationCountResponse(unread_count=count)


@router.get("/types")
async def get_notification_types():
    """Get all available notification types"""
    types = []
    for nt in NotificationType:
        category = nt.value.split(".")[0]
        types.append({
            "type": nt.value,
            "category": category,
            "name": nt.name.replace("_", " ").title(),
        })
    return {"types": types}


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a specific notification"""
    service = NotificationService(db)
    notification = service.get_notification(notification_id, current_user.id)

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    return NotificationResponse.model_validate(notification)


# ============================================================================
# MARK AS READ
# ============================================================================

@router.post("/mark-read")
async def mark_notifications_read(
    data: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Mark specific notifications as read"""
    service = NotificationService(db)
    count = service.mark_as_read(data.notification_ids, current_user.id)
    return {"marked_read": count}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    data: Optional[MarkAllReadRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Mark all notifications as read (optionally filtered by type)"""
    service = NotificationService(db)
    notification_type = data.notification_type if data else None
    count = service.mark_all_as_read(current_user.id, notification_type)
    return {"marked_read": count}


# ============================================================================
# DELETE NOTIFICATIONS
# ============================================================================

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a specific notification"""
    service = NotificationService(db)
    deleted = service.delete_notification(notification_id, current_user.id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"deleted": True}


@router.delete("/")
async def delete_all_read_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete all read notifications"""
    service = NotificationService(db)
    count = service.delete_all_read(current_user.id)
    return {"deleted": count}


# ============================================================================
# NOTIFICATION PREFERENCES
# ============================================================================

@router.get("/preferences/all", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get all notification preferences for the current user"""
    service = NotificationService(db)
    preferences = service.get_all_preferences(current_user.id)

    return NotificationPreferencesResponse(
        preferences=[
            NotificationPreferenceResponse.model_validate(p) for p in preferences
        ]
    )


@router.put("/preferences")
async def update_notification_preference(
    data: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update a notification preference"""
    service = NotificationService(db)
    pref = service.update_preference(
        user_id=current_user.id,
        notification_type=data.notification_type,
        in_app_enabled=data.in_app_enabled,
        email_enabled=data.email_enabled,
        email_digest=data.email_digest,
    )
    return NotificationPreferenceResponse.model_validate(pref)


@router.put("/preferences/bulk")
async def update_notification_preferences_bulk(
    data: BulkPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update multiple notification preferences at once"""
    service = NotificationService(db)
    updated = []

    for pref_update in data.preferences:
        pref = service.update_preference(
            user_id=current_user.id,
            notification_type=pref_update.notification_type,
            in_app_enabled=pref_update.in_app_enabled,
            email_enabled=pref_update.email_enabled,
            email_digest=pref_update.email_digest,
        )
        updated.append(NotificationPreferenceResponse.model_validate(pref))

    return NotificationPreferencesResponse(preferences=updated)


@router.delete("/preferences/reset")
async def reset_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Reset all notification preferences to defaults"""
    service = NotificationService(db)
    count = service.reset_preferences(current_user.id)
    return {"reset": count}
