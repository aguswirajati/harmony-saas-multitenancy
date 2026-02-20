from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import sys
import time
import platform
import os
import re

from app.core.database import get_db
from app.api.deps import get_super_admin_user
from app.models.user import User, TenantRole, SystemRole
from app.models.tenant import Tenant
from app.models.branch import Branch
from app.core.security import get_password_hash
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction, AuditStatus
from app.config import settings
from datetime import datetime
import uuid
from loguru import logger

router = APIRouter(prefix="/admin/tools", tags=["Admin - Tools"])

# ── In-memory runtime config (resets on server restart) ──────────────────────
_server_start_time = time.time()

_runtime_settings = {
    "dev_mode": settings.DEV_MODE,
    "log_level": "INFO",
    "rate_limit_enabled": settings.RATE_LIMIT_ENABLED,
}

# Sensitive env var patterns — values will be masked
_SENSITIVE_PATTERNS = re.compile(
    r"(SECRET|PASSWORD|KEY|TOKEN|DATABASE_URL)", re.IGNORECASE
)


# ── Pydantic models for the new endpoints ────────────────────────────────────
class RuntimeSettingsUpdate(BaseModel):
    dev_mode: Optional[bool] = None
    log_level: Optional[str] = None
    rate_limit_enabled: Optional[bool] = None


class RuntimeSettingsResponse(BaseModel):
    dev_mode: bool
    log_level: str
    rate_limit_enabled: bool


class LogEntry(BaseModel):
    timestamp: str
    level: str
    message: str


# ── Runtime Settings Endpoints ───────────────────────────────────────────────

@router.get("/settings", response_model=RuntimeSettingsResponse)
async def get_runtime_settings(
    current_user: User = Depends(get_super_admin_user),
):
    """Get current runtime settings (in-memory overrides)."""
    return RuntimeSettingsResponse(**_runtime_settings)


@router.post("/settings", response_model=RuntimeSettingsResponse)
async def update_runtime_settings(
    data: RuntimeSettingsUpdate,
    request: Request,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update runtime settings (Super Admin only).

    Changes are in-memory only — a server restart resets to env var values.
    """
    changes = {}

    if data.dev_mode is not None:
        _runtime_settings["dev_mode"] = data.dev_mode
        settings.DEV_MODE = data.dev_mode
        changes["dev_mode"] = data.dev_mode

    if data.rate_limit_enabled is not None:
        _runtime_settings["rate_limit_enabled"] = data.rate_limit_enabled
        settings.RATE_LIMIT_ENABLED = data.rate_limit_enabled
        changes["rate_limit_enabled"] = data.rate_limit_enabled

    if data.log_level is not None:
        level = data.log_level.upper()
        valid_levels = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")
        if level not in valid_levels:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid log level. Must be one of: {', '.join(valid_levels)}",
            )
        _runtime_settings["log_level"] = level
        # Reconfigure loguru
        logger.remove()
        logger.add(sys.stderr, level=level)
        logger.add(
            "logs/app.log",
            rotation="500 MB",
            retention="10 days",
            level=level,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        )
        changes["log_level"] = level

    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action="system.settings_updated",
        resource="system",
        details={"changes": changes},
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return RuntimeSettingsResponse(**_runtime_settings)


# ── System Info Endpoint ─────────────────────────────────────────────────────

@router.get("/system-info")
async def get_system_info(
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get system information including versions, connection statuses,
    migration version, uptime, and masked environment variables.
    """
    import fastapi as _fastapi

    # Database status
    db_status = "connected"
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"disconnected: {e}"

    # Redis status
    redis_status = "not_configured"
    try:
        from app.middleware.rate_limiter import rate_limiter
        if rate_limiter.redis_client:
            await rate_limiter.redis_client.ping()
            redis_status = "connected"
    except Exception as e:
        redis_status = f"disconnected: {e}"

    # Alembic migration version
    migration_version = "unknown"
    try:
        from sqlalchemy import text
        result = db.execute(text("SELECT version_num FROM alembic_version"))
        row = result.fetchone()
        if row:
            migration_version = row[0]
    except Exception:
        pass

    # Uptime
    uptime_seconds = int(time.time() - _server_start_time)
    hours, remainder = divmod(uptime_seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    uptime_str = f"{hours}h {minutes}m {secs}s"

    # Masked environment variables
    env_vars = {}
    for key, value in sorted(os.environ.items()):
        if _SENSITIVE_PATTERNS.search(key):
            env_vars[key] = "********"
        else:
            env_vars[key] = value

    return {
        "python_version": sys.version,
        "fastapi_version": _fastapi.__version__,
        "platform": platform.platform(),
        "database_status": db_status,
        "redis_status": redis_status,
        "migration_version": migration_version,
        "uptime": uptime_str,
        "uptime_seconds": uptime_seconds,
        "env_vars": env_vars,
    }


# ── Application Logs Endpoint ────────────────────────────────────────────────

@router.get("/logs", response_model=List[LogEntry])
async def get_application_logs(
    level: Optional[str] = Query(None, description="Filter by log level"),
    limit: int = Query(100, ge=1, le=1000, description="Max entries to return"),
    offset: int = Query(0, ge=0, description="Number of entries to skip"),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Read recent application log entries from logs/app.log.

    Returns parsed log entries with timestamp, level, and message.
    """
    log_path = "logs/app.log"
    entries: List[LogEntry] = []

    if not os.path.isfile(log_path):
        return entries

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception:
        return entries

    # Parse lines (format: "YYYY-MM-DD HH:mm:ss | LEVEL | message")
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue

        parts = line.split(" | ", 2)
        if len(parts) == 3:
            ts, lvl, msg = parts
            lvl = lvl.strip()
        else:
            # Unparseable line — treat as INFO
            ts = ""
            lvl = "INFO"
            msg = line

        if level and lvl.upper() != level.upper():
            continue

        entries.append(LogEntry(timestamp=ts, level=lvl, message=msg))

    # Apply offset + limit after filtering
    entries = entries[offset : offset + limit]
    return entries


# ── Existing Endpoints (seed-data, reset-database) ───────────────────────────

@router.post("/seed-data")
async def seed_dummy_data(
    request: Request,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    Seed database with dummy tenants, branches, and users (Super Admin only)

    Creates:
    - 3 demo tenants (free, basic, premium tiers)
    - Multiple branches for each tenant
    - Multiple users with different roles for each tenant
    """

    try:
        # Dummy data configuration
        tenants_data = [
            {
                "name": "Acme Corporation",
                "subdomain": "acme",
                "tier": "premium",
                "max_users": 100,
                "max_branches": 20,
                "max_storage_gb": 50
            },
            {
                "name": "TechStart Inc",
                "subdomain": "techstart",
                "tier": "basic",
                "max_users": 20,
                "max_branches": 5,
                "max_storage_gb": 10
            },
            {
                "name": "Demo Company",
                "subdomain": "demo",
                "tier": "free",
                "max_users": 5,
                "max_branches": 1,
                "max_storage_gb": 1
            }
        ]

        created_tenants = []
        created_users = []
        created_branches = []

        for tenant_data in tenants_data:
            # Check if tenant already exists
            existing_tenant = db.query(Tenant).filter(
                Tenant.subdomain == tenant_data["subdomain"]
            ).first()

            if existing_tenant:
                continue  # Skip if already exists

            # Create tenant
            tenant = Tenant(**tenant_data)
            db.add(tenant)
            db.flush()  # Get tenant ID
            created_tenants.append(tenant)

            # Create HQ branch
            hq_branch = Branch(
                tenant_id=tenant.id,
                name="Head Office",
                code="HQ",
                is_hq=True
            )
            db.add(hq_branch)
            db.flush()
            created_branches.append(hq_branch)

            # Create additional branches (except for free tier)
            if tenant.tier != "free":
                additional_branches = [
                    {"name": "New York Office", "code": "NY"},
                    {"name": "London Office", "code": "LON"},
                ]

                if tenant.tier == "premium":
                    additional_branches.extend([
                        {"name": "Tokyo Office", "code": "TKY"},
                        {"name": "Singapore Office", "code": "SG"},
                    ])

                for branch_data in additional_branches:
                    branch = Branch(
                        tenant_id=tenant.id,
                        **branch_data
                    )
                    db.add(branch)
                    db.flush()
                    created_branches.append(branch)

            # Create users with different roles
            users_to_create = [
                {
                    "email": f"owner@{tenant.subdomain}.com",
                    "password": "owner123",
                    "full_name": f"{tenant.name} Owner",
                    "first_name": f"{tenant.name}",
                    "last_name": "Owner",
                    "tenant_role": TenantRole.OWNER,
                    "branch": hq_branch
                },
                {
                    "email": f"admin@{tenant.subdomain}.com",
                    "password": "admin123",
                    "full_name": f"{tenant.name} Admin",
                    "first_name": f"{tenant.name}",
                    "last_name": "Admin",
                    "tenant_role": TenantRole.ADMIN,
                    "branch": hq_branch
                },
                {
                    "email": f"member@{tenant.subdomain}.com",
                    "password": "member123",
                    "full_name": f"{tenant.name} Member",
                    "first_name": f"{tenant.name}",
                    "last_name": "Member",
                    "tenant_role": TenantRole.MEMBER,
                    "branch": hq_branch
                },
            ]

            for user_data in users_to_create:
                branch = user_data.pop("branch")
                password = user_data.pop("password")

                user = User(
                    tenant_id=tenant.id,
                    default_branch_id=branch.id,
                    password_hash=get_password_hash(password),
                    is_verified=True,
                    email_verified_at=datetime.utcnow(),
                    **user_data
                )
                db.add(user)
                created_users.append(user)

        db.commit()

        # Log audit event for seeding data
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=None,
            action="system.seed_data",
            resource="system",
            details={
                "tenants_created": len(created_tenants),
                "branches_created": len(created_branches),
                "users_created": len(created_users),
                "tenant_names": [t.name for t in created_tenants]
            },
            status=AuditStatus.SUCCESS,
            request=request
        )

        return {
            "message": "Dummy data seeded successfully",
            "created": {
                "tenants": len(created_tenants),
                "branches": len(created_branches),
                "users": len(created_users)
            },
            "details": {
                "tenants": [{"name": t.name, "subdomain": t.subdomain, "tier": t.tier} for t in created_tenants],
                "sample_credentials": [
                    {"tenant": "acme", "email": "owner@acme.com", "password": "owner123", "role": "owner"},
                    {"tenant": "techstart", "email": "owner@techstart.com", "password": "owner123", "role": "owner"},
                    {"tenant": "demo", "email": "owner@demo.com", "password": "owner123", "role": "owner"}
                ]
            }
        }

    except Exception as e:
        db.rollback()
        # Log failed seed attempt
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=None,
            action="system.seed_data",
            resource="system",
            details={"error": str(e)},
            status=AuditStatus.ERROR,
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed data: {str(e)}"
        )


@router.post("/reset-database")
async def reset_database(
    request: Request,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    Reset database to clean state (Super Admin only)

    WARNING: This will delete ALL data except super admin users!
    - Deletes all tenants (cascade deletes branches, users)
    - Preserves super admin users

    Use this for testing or fresh installation.
    """

    try:
        # Order matters due to foreign key constraints!
        # 1. First delete tenant users (non-super-admin)
        deleted_users = db.query(User).filter(
            User.tenant_id.isnot(None)  # Only delete users with tenant_id
        ).delete(synchronize_session='fetch')

        # 2. Delete branches
        deleted_branches = db.query(Branch).delete(synchronize_session='fetch')

        # 3. Finally delete tenants
        deleted_tenants = db.query(Tenant).delete(synchronize_session='fetch')

        db.commit()

        # Count remaining system admins
        remaining_super_admins = db.query(User).filter(
            User.system_role.isnot(None)
        ).count()

        # Log audit event for database reset
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=None,
            action="system.reset_database",
            resource="system",
            details={
                "tenants_deleted": deleted_tenants,
                "branches_deleted": deleted_branches,
                "users_deleted": deleted_users,
                "super_admins_preserved": remaining_super_admins
            },
            status=AuditStatus.SUCCESS,
            request=request
        )

        return {
            "message": "Database reset successfully",
            "deleted": {
                "tenants": deleted_tenants,
                "branches": deleted_branches,
                "users": deleted_users
            },
            "preserved": {
                "super_admins": remaining_super_admins
            },
            "warning": "All tenant data has been permanently deleted"
        }

    except Exception as e:
        db.rollback()
        # Log failed reset attempt
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=None,
            action="system.reset_database",
            resource="system",
            details={"error": str(e)},
            status=AuditStatus.ERROR,
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset database: {str(e)}"
        )
