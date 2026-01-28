from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from app.core.database import get_db
from app.api.deps import get_super_admin_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.branch import Branch
from app.models.audit_log import AuditLog, AuditAction

router = APIRouter(prefix="/admin/stats", tags=["Admin - Stats"])


@router.get("")
async def get_system_statistics(
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get system-wide statistics (Super Admin only)

    Returns:
    - Total counts for tenants, users, branches
    - Recent activity metrics
    - Growth trends
    - System health indicators
    """

    # Basic counts
    total_tenants = db.query(Tenant).filter(Tenant.is_active == True).count()
    total_users = db.query(User).filter(User.is_active == True).count()
    total_branches = db.query(Branch).filter(Branch.is_active == True).count()

    # Users by role
    users_by_role = db.query(
        User.role,
        func.count(User.id).label('count')
    ).filter(
        User.is_active == True
    ).group_by(User.role).all()

    role_breakdown = {role: count for role, count in users_by_role}

    # Tenants by tier
    tenants_by_tier = db.query(
        Tenant.tier,
        func.count(Tenant.id).label('count')
    ).filter(
        Tenant.is_active == True
    ).group_by(Tenant.tier).all()

    tier_breakdown = {tier: count for tier, count in tenants_by_tier}

    # Recent registrations (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    new_tenants_30d = db.query(Tenant).filter(
        Tenant.created_at >= thirty_days_ago,
        Tenant.is_active == True
    ).count()

    new_users_30d = db.query(User).filter(
        User.created_at >= thirty_days_ago,
        User.is_active == True
    ).count()

    # Growth metrics (last 7 days vs previous 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    fourteen_days_ago = datetime.utcnow() - timedelta(days=14)

    tenants_last_7d = db.query(Tenant).filter(
        Tenant.created_at >= seven_days_ago,
        Tenant.is_active == True
    ).count()

    tenants_prev_7d = db.query(Tenant).filter(
        and_(
            Tenant.created_at >= fourteen_days_ago,
            Tenant.created_at < seven_days_ago,
            Tenant.is_active == True
        )
    ).count()

    users_last_7d = db.query(User).filter(
        User.created_at >= seven_days_ago,
        User.is_active == True
    ).count()

    users_prev_7d = db.query(User).filter(
        and_(
            User.created_at >= fourteen_days_ago,
            User.created_at < seven_days_ago,
            User.is_active == True
        )
    ).count()

    # Calculate growth percentages
    tenant_growth = 0
    if tenants_prev_7d > 0:
        tenant_growth = ((tenants_last_7d - tenants_prev_7d) / tenants_prev_7d) * 100

    user_growth = 0
    if users_prev_7d > 0:
        user_growth = ((users_last_7d - users_prev_7d) / users_prev_7d) * 100

    # Recent activity (last 24 hours)
    twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)

    recent_logins = db.query(AuditLog).filter(
        AuditLog.action == AuditAction.LOGIN,
        AuditLog.created_at >= twenty_four_hours_ago
    ).count()

    recent_actions = db.query(AuditLog).filter(
        AuditLog.created_at >= twenty_four_hours_ago
    ).count()

    # Verified vs unverified users
    verified_users = db.query(User).filter(
        User.is_verified == True,
        User.is_active == True
    ).count()

    unverified_users = db.query(User).filter(
        User.is_verified == False,
        User.is_active == True
    ).count()

    # Active vs inactive tenants
    inactive_tenants = db.query(Tenant).filter(Tenant.is_active == False).count()

    return {
        "overview": {
            "total_tenants": total_tenants,
            "total_users": total_users,
            "total_branches": total_branches,
            "verified_users": verified_users,
            "unverified_users": unverified_users,
            "inactive_tenants": inactive_tenants
        },
        "users_by_role": role_breakdown,
        "tenants_by_tier": tier_breakdown,
        "recent_activity": {
            "new_tenants_30d": new_tenants_30d,
            "new_users_30d": new_users_30d,
            "logins_24h": recent_logins,
            "total_actions_24h": recent_actions
        },
        "growth": {
            "tenants_last_7d": tenants_last_7d,
            "tenants_prev_7d": tenants_prev_7d,
            "tenant_growth_percentage": round(tenant_growth, 2),
            "users_last_7d": users_last_7d,
            "users_prev_7d": users_prev_7d,
            "user_growth_percentage": round(user_growth, 2)
        }
    }
