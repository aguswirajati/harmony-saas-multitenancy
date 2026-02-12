"""
Audit Logs API Endpoints

Endpoints for viewing audit logs. Super admins see all logs system-wide;
tenant admins see only their own tenant's logs. Access is controlled via
the AUDIT_VIEW permission.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import Optional, List
from datetime import datetime, timedelta
from uuid import UUID
import json
import os
from pathlib import Path

from fastapi import Request
from app.core.database import get_db
from app.api.deps import require_permission, get_super_admin_user, get_current_tenant
from app.core.permissions import Permission
from app.models.tenant import Tenant
from app.config import settings
from app.models.user import User
from app.models.audit_log import AuditLog, AuditAction, AuditStatus
from app.services.audit_service import AuditService
from app.schemas.audit import (
    AuditLogResponse,
    AuditLogListResponse,
    AuditStatistics,
)

# Archive directory
ARCHIVE_DIR = Path("archives/audit")
ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

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
    Archive old audit logs before a given date.

    Super Admin only. Works in both dev and production mode.
    Default cutoff is 90 days ago.

    This will:
    1. Export matching logs to a JSON file in archives/audit/
    2. Delete the logs from the database
    3. Return info about the created archive file
    """
    cutoff = before_date or (datetime.utcnow() - timedelta(days=90))

    # Query logs to archive
    logs_to_archive = (
        db.query(AuditLog)
        .filter(AuditLog.created_at < cutoff)
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    count = len(logs_to_archive)

    if count == 0:
        return {
            "message": "No logs found to archive",
            "archived": 0,
            "before_date": cutoff.isoformat(),
            "file": None,
        }

    # Prepare data for JSON export
    archive_data = {
        "archived_at": datetime.utcnow().isoformat(),
        "archived_by": current_user.email,
        "before_date": cutoff.isoformat(),
        "total_records": count,
        "logs": [],
    }

    for log in logs_to_archive:
        archive_data["logs"].append({
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "tenant_id": str(log.tenant_id) if log.tenant_id else None,
            "action": log.action,
            "resource": log.resource,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "details": log.details,
            "status": log.status,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "request_id": log.request_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    # Generate filename with timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"audit_archive_{timestamp}.json"
    filepath = ARCHIVE_DIR / filename

    # Write to file
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(archive_data, f, indent=2, ensure_ascii=False)

    # Get file size
    file_size = os.path.getsize(filepath)

    # Delete archived logs from database
    db.query(AuditLog).filter(AuditLog.created_at < cutoff).delete(synchronize_session="fetch")
    db.commit()

    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action="system.audit_logs_archived",
        resource="audit_log",
        details={
            "records_archived": count,
            "before_date": cutoff.isoformat(),
            "archive_file": filename,
            "file_size_bytes": file_size,
        },
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return {
        "message": f"Successfully archived {count} audit logs",
        "archived": count,
        "before_date": cutoff.isoformat(),
        "file": {
            "name": filename,
            "size_bytes": file_size,
            "size_readable": _format_file_size(file_size),
        },
    }


def _format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


@router.get("/archives")
def list_archive_files(
    current_user: User = Depends(get_super_admin_user),
):
    """
    List all archived audit log files.

    Super Admin only.
    """
    archives = []

    if ARCHIVE_DIR.exists():
        for filepath in sorted(ARCHIVE_DIR.glob("*.json"), reverse=True):
            stat = filepath.stat()
            # Try to read metadata from file
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    total_records = data.get("total_records", 0)
                    archived_at = data.get("archived_at", None)
                    before_date = data.get("before_date", None)
            except Exception:
                total_records = 0
                archived_at = None
                before_date = None

            archives.append({
                "name": filepath.name,
                "size_bytes": stat.st_size,
                "size_readable": _format_file_size(stat.st_size),
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "total_records": total_records,
                "archived_at": archived_at,
                "before_date": before_date,
            })

    return {"archives": archives, "total": len(archives)}


@router.get("/archives/{filename}")
def download_archive_file(
    filename: str,
    current_user: User = Depends(get_super_admin_user),
):
    """
    Download an archived audit log file.

    Super Admin only.
    """
    # Validate filename to prevent directory traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename",
        )

    filepath = ARCHIVE_DIR / filename

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archive file not found",
        )

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/json",
    )


@router.delete("/archives/{filename}")
def delete_archive_file(
    filename: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Delete an archived audit log file.

    Super Admin only. DEV_MODE only.
    """
    if not settings.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Deleting archive files is only allowed in DEV_MODE",
        )

    # Validate filename
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename",
        )

    filepath = ARCHIVE_DIR / filename

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archive file not found",
        )

    os.remove(filepath)

    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action="system.archive_file_deleted",
        resource="audit_archive",
        details={"filename": filename},
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return {"message": f"Archive file '{filename}' deleted"}


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


# ============================================================================
# TENANT-SCOPED ARCHIVE ENDPOINTS
# ============================================================================

def _get_tenant_archive_dir(tenant_id: UUID) -> Path:
    """Get archive directory for a specific tenant."""
    tenant_dir = ARCHIVE_DIR / f"tenant_{tenant_id}"
    tenant_dir.mkdir(parents=True, exist_ok=True)
    return tenant_dir


@router.post("/tenant/archive")
def archive_tenant_audit_logs(
    request: Request,
    before_date: Optional[datetime] = Query(
        None, description="Archive logs older than this date (default: 90 days ago)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Archive old audit logs for current tenant.

    Tenant Admin only. Exports logs to JSON file, then removes from database.
    Default cutoff is 90 days ago.
    """
    cutoff = before_date or (datetime.utcnow() - timedelta(days=90))

    # Query logs to archive (tenant-scoped)
    logs_to_archive = (
        db.query(AuditLog)
        .filter(
            AuditLog.tenant_id == tenant.id,
            AuditLog.created_at < cutoff,
        )
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    count = len(logs_to_archive)

    if count == 0:
        return {
            "message": "No logs found to archive",
            "archived": 0,
            "before_date": cutoff.isoformat(),
            "file": None,
        }

    # Prepare data for JSON export
    archive_data = {
        "archived_at": datetime.utcnow().isoformat(),
        "archived_by": current_user.email,
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "before_date": cutoff.isoformat(),
        "total_records": count,
        "logs": [],
    }

    for log in logs_to_archive:
        archive_data["logs"].append({
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "resource": log.resource,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "details": log.details,
            "status": log.status,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "request_id": log.request_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    # Generate filename with timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"audit_archive_{timestamp}.json"
    tenant_archive_dir = _get_tenant_archive_dir(tenant.id)
    filepath = tenant_archive_dir / filename

    # Write to file
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(archive_data, f, indent=2, ensure_ascii=False)

    # Get file size
    file_size = os.path.getsize(filepath)

    # Delete archived logs from database (tenant-scoped)
    db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant.id,
        AuditLog.created_at < cutoff,
    ).delete(synchronize_session="fetch")
    db.commit()

    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action="system.audit_logs_archived",
        resource="audit_log",
        details={
            "records_archived": count,
            "before_date": cutoff.isoformat(),
            "archive_file": filename,
            "file_size_bytes": file_size,
        },
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return {
        "message": f"Successfully archived {count} audit logs",
        "archived": count,
        "before_date": cutoff.isoformat(),
        "file": {
            "name": filename,
            "size_bytes": file_size,
            "size_readable": _format_file_size(file_size),
        },
    }


@router.get("/tenant/archives")
def list_tenant_archive_files(
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    List archived audit log files for current tenant.

    Tenant Admin only.
    """
    archives = []
    tenant_archive_dir = _get_tenant_archive_dir(tenant.id)

    if tenant_archive_dir.exists():
        for filepath in sorted(tenant_archive_dir.glob("*.json"), reverse=True):
            stat = filepath.stat()
            # Try to read metadata from file
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    total_records = data.get("total_records", 0)
                    archived_at = data.get("archived_at", None)
                    before_date = data.get("before_date", None)
            except Exception:
                total_records = 0
                archived_at = None
                before_date = None

            archives.append({
                "name": filepath.name,
                "size_bytes": stat.st_size,
                "size_readable": _format_file_size(stat.st_size),
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "total_records": total_records,
                "archived_at": archived_at,
                "before_date": before_date,
            })

    return {"archives": archives, "total": len(archives)}


@router.get("/tenant/archives/{filename}")
def download_tenant_archive_file(
    filename: str,
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Download an archived audit log file for current tenant.

    Tenant Admin only.
    """
    # Validate filename to prevent directory traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename",
        )

    tenant_archive_dir = _get_tenant_archive_dir(tenant.id)
    filepath = tenant_archive_dir / filename

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archive file not found",
        )

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/json",
    )
