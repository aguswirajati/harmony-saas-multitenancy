"""
Audit Logs API Endpoints

Endpoints for viewing audit logs. Super admins see all logs system-wide;
tenant admins see only their own tenant's logs. Access is controlled via
the AUDIT_VIEW permission.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import Optional, List
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import Request
from app.core.database import get_db
from app.api.deps import require_permission, get_super_admin_user
from app.core.permissions import Permission
from app.config import settings
from app.models.user import User
from app.models.audit_log import AuditLog, AuditAction, AuditStatus
from app.services.audit_service import AuditService
from app.schemas.audit import (
    AuditLogResponse,
    AuditLogListResponse,
    AuditStatistics,
)

router = APIRouter(prefix="/admin/audit-logs", tags=["Admin - Audit"])


def _apply_tenant_scope(query, current_user: User, tenant_id_param: Optional[UUID] = None):
    """
    Apply tenant scoping to an audit log query.

    - Super admins: no automatic scoping; may optionally filter by tenant_id param
    - Other roles: always scoped to current_user.tenant_id
    """
    if current_user.role == "super_admin":
        if tenant_id_param:
            query = query.filter(AuditLog.tenant_id == tenant_id_param)
    else:
        query = query.filter(AuditLog.tenant_id == current_user.tenant_id)
    return query


@router.get("/", response_model=AuditLogListResponse)
def get_audit_logs(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of records to return"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    resource: Optional[str] = Query(None, description="Filter by resource type"),
    status: Optional[str] = Query(None, description="Filter by status (success, failure, error)"),
    user_id: Optional[UUID] = Query(None, description="Filter by user ID"),
    tenant_id: Optional[UUID] = Query(None, description="Filter by tenant ID"),
    start_date: Optional[datetime] = Query(None, description="Filter logs after this date"),
    end_date: Optional[datetime] = Query(None, description="Filter logs before this date"),
    search: Optional[str] = Query(None, description="Search in request_id or IP address"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
):
    """
    List audit logs with filtering and pagination.

    Tenant admins see only their own tenant's logs.
    Super admins see all logs and may optionally filter by tenant_id.
    """
    # Build base query
    query = db.query(AuditLog).filter(AuditLog.is_active == True)

    # Apply tenant scoping
    query = _apply_tenant_scope(query, current_user, tenant_id)

    # Apply filters
    if action:
        query = query.filter(AuditLog.action == action)
    if resource:
        query = query.filter(AuditLog.resource == resource)
    if status:
        query = query.filter(AuditLog.status == status)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (AuditLog.request_id.ilike(search_filter)) |
            (AuditLog.ip_address.ilike(search_filter))
        )

    # Get total count
    total = query.count()

    # Get paginated results (ordered by most recent first)
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    # Convert to response format
    log_responses = [AuditLogResponse.from_audit_log(log) for log in logs]

    return AuditLogListResponse(
        logs=log_responses,
        total=total,
        limit=limit,
        offset=skip,
    )


@router.get("/statistics", response_model=AuditStatistics)
def get_audit_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
):
    """
    Get audit log statistics for dashboard display.

    Tenant admins see statistics scoped to their tenant only.
    Super admins see system-wide statistics.
    """
    # Get time boundaries
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)

    # Base filter
    def base_filter(q):
        q = q.filter(AuditLog.is_active == True)
        return _apply_tenant_scope(q, current_user)

    # Total logs
    total_logs = base_filter(
        db.query(func.count(AuditLog.id))
    ).scalar() or 0

    # Unique users
    total_users = base_filter(
        db.query(func.count(distinct(AuditLog.user_id))).filter(
            AuditLog.user_id.isnot(None)
        )
    ).scalar() or 0

    # Unique actions
    total_actions = base_filter(
        db.query(func.count(distinct(AuditLog.action)))
    ).scalar() or 0

    # Failed logins in last 24 hours
    failed_logins_24h = base_filter(
        db.query(func.count(AuditLog.id)).filter(
            AuditLog.action == AuditAction.LOGIN_FAILED,
            AuditLog.created_at >= last_24h,
        )
    ).scalar() or 0

    # Successful logins in last 24 hours
    successful_logins_24h = base_filter(
        db.query(func.count(AuditLog.id)).filter(
            AuditLog.action == AuditAction.LOGIN,
            AuditLog.created_at >= last_24h,
        )
    ).scalar() or 0

    # Actions by type (top 10)
    actions_by_type_query = base_filter(
        db.query(
            AuditLog.action,
            func.count(AuditLog.id).label('count')
        )
    ).group_by(AuditLog.action).order_by(func.count(AuditLog.id).desc()).limit(10).all()

    actions_by_type = {row.action: row.count for row in actions_by_type_query}

    # Actions by status
    actions_by_status_query = base_filter(
        db.query(
            AuditLog.status,
            func.count(AuditLog.id).label('count')
        )
    ).group_by(AuditLog.status).all()

    actions_by_status = {row.status: row.count for row in actions_by_status_query}

    return AuditStatistics(
        total_logs=total_logs,
        total_users=total_users,
        total_actions=total_actions,
        failed_logins_24h=failed_logins_24h,
        successful_logins_24h=successful_logins_24h,
        actions_by_type=actions_by_type,
        actions_by_status=actions_by_status,
    )


@router.get("/actions", response_model=List[str])
def get_audit_actions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
):
    """
    Get list of all unique action types for filter dropdown.

    Scoped to tenant for non-super-admin users.
    """
    query = db.query(distinct(AuditLog.action)).filter(AuditLog.is_active == True)
    query = _apply_tenant_scope(query, current_user)
    actions = query.order_by(AuditLog.action).all()

    return [action[0] for action in actions]


@router.get("/resources", response_model=List[str])
def get_audit_resources(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
):
    """
    Get list of all unique resource types for filter dropdown.

    Scoped to tenant for non-super-admin users.
    """
    query = db.query(distinct(AuditLog.resource)).filter(AuditLog.is_active == True)
    query = _apply_tenant_scope(query, current_user)
    resources = query.order_by(AuditLog.resource).all()

    return [resource[0] for resource in resources]


@router.delete("/")
def clear_audit_logs(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Clear all audit logs (DEV MODE only, Super Admin only).

    This is a destructive operation intended for development use only.
    Returns 403 if DEV_MODE is not enabled.
    """
    if not settings.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clearing audit logs is only allowed in DEV_MODE",
        )

    count = db.query(AuditLog).delete(synchronize_session="fetch")
    db.commit()

    # Log the clear action itself (meta)
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action="system.audit_logs_cleared",
        resource="audit_log",
        details={"records_deleted": count},
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return {"message": "Audit logs cleared", "deleted": count}


@router.post("/archive")
def archive_audit_logs(
    request: Request,
    before_date: Optional[datetime] = Query(
        None, description="Archive logs older than this date (default: 90 days ago)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Archive (delete) old audit logs before a given date.

    Super Admin only. Works in both dev and production mode.
    Default cutoff is 90 days ago.
    """
    cutoff = before_date or (datetime.utcnow() - timedelta(days=90))

    count = (
        db.query(AuditLog)
        .filter(AuditLog.created_at < cutoff)
        .delete(synchronize_session="fetch")
    )
    db.commit()

    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action="system.audit_logs_archived",
        resource="audit_log",
        details={"records_archived": count, "before_date": cutoff.isoformat()},
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return {"message": "Audit logs archived", "archived": count, "before_date": cutoff.isoformat()}


@router.get("/{log_id}", response_model=AuditLogResponse)
def get_audit_log(
    log_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
):
    """
    Get a single audit log entry by ID.

    Tenant admins can only access logs belonging to their tenant.
    """
    query = db.query(AuditLog).filter(
        AuditLog.id == log_id,
        AuditLog.is_active == True
    )
    query = _apply_tenant_scope(query, current_user)
    audit_log = query.first()

    if not audit_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found"
        )

    return AuditLogResponse.from_audit_log(audit_log)
