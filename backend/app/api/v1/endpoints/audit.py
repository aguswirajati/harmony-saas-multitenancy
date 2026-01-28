"""
Audit Logs API Endpoints

Super admin endpoints for viewing and managing audit logs.
All endpoints require super admin authentication.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import Optional, List
from datetime import datetime, timedelta
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_super_admin_user
from app.models.user import User
from app.models.audit_log import AuditLog, AuditAction, AuditStatus
from app.services.audit_service import AuditService
from app.schemas.audit import (
    AuditLogResponse,
    AuditLogListResponse,
    AuditStatistics,
)

router = APIRouter(prefix="/admin/audit-logs", tags=["Admin - Audit"])


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
    current_user: User = Depends(get_super_admin_user),
):
    """
    List all audit logs with filtering and pagination.

    Filters:
    - action: Filter by action type (e.g., 'auth.login', 'user.created')
    - resource: Filter by resource type (e.g., 'user', 'tenant', 'branch')
    - status: Filter by outcome (success, failure, error)
    - user_id: Filter by specific user
    - tenant_id: Filter by specific tenant
    - start_date/end_date: Filter by date range
    - search: Search in request_id or IP address
    """
    # Build base query
    query = db.query(AuditLog).filter(AuditLog.is_active == True)

    # Apply filters
    if action:
        query = query.filter(AuditLog.action == action)
    if resource:
        query = query.filter(AuditLog.resource == resource)
    if status:
        query = query.filter(AuditLog.status == status)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if tenant_id:
        query = query.filter(AuditLog.tenant_id == tenant_id)
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
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get audit log statistics for dashboard display.

    Returns:
    - Total number of logs
    - Unique users
    - Unique actions
    - Failed logins in last 24 hours
    - Successful logins in last 24 hours
    - Actions by type
    - Actions by status
    """
    # Get time boundaries
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)

    # Total logs
    total_logs = db.query(func.count(AuditLog.id)).filter(
        AuditLog.is_active == True
    ).scalar() or 0

    # Unique users
    total_users = db.query(func.count(distinct(AuditLog.user_id))).filter(
        AuditLog.is_active == True,
        AuditLog.user_id.isnot(None)
    ).scalar() or 0

    # Unique actions
    total_actions = db.query(func.count(distinct(AuditLog.action))).filter(
        AuditLog.is_active == True
    ).scalar() or 0

    # Failed logins in last 24 hours
    failed_logins_24h = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == AuditAction.LOGIN_FAILED,
        AuditLog.created_at >= last_24h,
        AuditLog.is_active == True
    ).scalar() or 0

    # Successful logins in last 24 hours
    successful_logins_24h = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == AuditAction.LOGIN,
        AuditLog.created_at >= last_24h,
        AuditLog.is_active == True
    ).scalar() or 0

    # Actions by type (top 10)
    actions_by_type_query = db.query(
        AuditLog.action,
        func.count(AuditLog.id).label('count')
    ).filter(
        AuditLog.is_active == True
    ).group_by(AuditLog.action).order_by(func.count(AuditLog.id).desc()).limit(10).all()

    actions_by_type = {row.action: row.count for row in actions_by_type_query}

    # Actions by status
    actions_by_status_query = db.query(
        AuditLog.status,
        func.count(AuditLog.id).label('count')
    ).filter(
        AuditLog.is_active == True
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
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get list of all unique action types for filter dropdown.

    Returns list of action strings that have been used in audit logs.
    """
    actions = db.query(distinct(AuditLog.action)).filter(
        AuditLog.is_active == True
    ).order_by(AuditLog.action).all()

    return [action[0] for action in actions]


@router.get("/resources", response_model=List[str])
def get_audit_resources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get list of all unique resource types for filter dropdown.

    Returns list of resource strings that have been used in audit logs.
    """
    resources = db.query(distinct(AuditLog.resource)).filter(
        AuditLog.is_active == True
    ).order_by(AuditLog.resource).all()

    return [resource[0] for resource in resources]


@router.get("/{log_id}", response_model=AuditLogResponse)
def get_audit_log(
    log_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get a single audit log entry by ID.

    Returns full details of the audit log including all metadata.
    """
    audit_log = db.query(AuditLog).filter(
        AuditLog.id == log_id,
        AuditLog.is_active == True
    ).first()

    if not audit_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found"
        )

    return AuditLogResponse.from_audit_log(audit_log)
