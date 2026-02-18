"""
Usage Metering API Endpoints
Tenant-side and admin endpoints for usage tracking and quotas.
"""
from datetime import date, timedelta
from typing import Optional, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_user, get_tenant_context, get_super_admin_user
from app.models.user import User
from app.models.tenant import Tenant
from app.services.usage_service import UsageService
from app.schemas.usage import (
    UsageQuotaResponse,
    UsageQuotaUpdate,
    UsageQuotaListResponse,
    UsageAlertResponse,
    UsageAlertListResponse,
    TenantUsageSummary,
    UsageTrends,
    TenantUsageOverview,
    AdminUsageOverviewResponse,
    UsageIncrementRequest,
    UsageIncrementResponse,
    UsageResetRequest,
    MetricTypeEnum,
)


# ============================================================================
# TENANT ROUTER - For logged-in tenant users
# ============================================================================

tenant_router = APIRouter(
    prefix="/usage",
    tags=["usage"],
)


@tenant_router.get("/summary", response_model=TenantUsageSummary)
async def get_usage_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """
    Get usage summary for the current tenant.

    Returns all usage metrics with current values, limits, and percentages.
    """
    return UsageService.get_usage_summary(db, tenant.id)


@tenant_router.get("/quotas", response_model=UsageQuotaListResponse)
async def get_tenant_quotas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """Get all usage quotas for the current tenant."""
    quotas = UsageService.get_tenant_quotas(db, tenant.id)

    # Convert to response format with computed properties
    items = []
    for quota in quotas:
        items.append(UsageQuotaResponse(
            id=quota.id,
            tenant_id=quota.tenant_id,
            metric_type=quota.metric_type,
            limit_value=quota.limit_value,
            current_value=quota.current_value,
            period_start=quota.period_start,
            reset_date=quota.reset_date,
            alert_threshold=quota.alert_threshold,
            usage_percentage=quota.usage_percentage,
            is_unlimited=quota.is_unlimited,
            is_exceeded=quota.is_exceeded,
            is_near_limit=quota.is_near_limit,
            remaining=quota.remaining,
            created_at=quota.created_at,
            updated_at=quota.updated_at,
        ))

    return UsageQuotaListResponse(items=items, total=len(items))


@tenant_router.get("/trends/{metric_type}", response_model=UsageTrends)
async def get_usage_trends(
    metric_type: MetricTypeEnum,
    start_date: Optional[date] = Query(None, description="Start date (defaults to 30 days ago)"),
    end_date: Optional[date] = Query(None, description="End date (defaults to today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """Get historical usage trends for a specific metric."""
    if end_date is None:
        end_date = date.today()
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    return UsageService.get_usage_trends(db, tenant.id, metric_type, start_date, end_date)


@tenant_router.get("/alerts", response_model=UsageAlertListResponse)
async def get_tenant_alerts(
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledged status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """Get usage alerts for the current tenant."""
    alerts, total = UsageService.get_alerts(
        db, tenant_id=tenant.id, acknowledged=acknowledged, skip=skip, limit=limit
    )

    items = [UsageAlertResponse(
        id=alert.id,
        tenant_id=alert.tenant_id,
        metric_type=alert.metric_type,
        alert_type=alert.alert_type,
        usage_percentage=alert.usage_percentage,
        current_value=alert.current_value,
        limit_value=alert.limit_value,
        message=alert.message,
        acknowledged_at=alert.acknowledged_at,
        created_at=alert.created_at,
    ) for alert in alerts]

    return UsageAlertListResponse(items=items, total=total)


@tenant_router.post("/alerts/{alert_id}/acknowledge", response_model=UsageAlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """Acknowledge a usage alert."""
    alert = UsageService.acknowledge_alert(db, alert_id, tenant_id=tenant.id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return UsageAlertResponse(
        id=alert.id,
        tenant_id=alert.tenant_id,
        metric_type=alert.metric_type,
        alert_type=alert.alert_type,
        usage_percentage=alert.usage_percentage,
        current_value=alert.current_value,
        limit_value=alert.limit_value,
        message=alert.message,
        acknowledged_at=alert.acknowledged_at,
        created_at=alert.created_at,
    )


# ============================================================================
# ADMIN ROUTER - For super admins
# ============================================================================

admin_router = APIRouter(
    prefix="/admin/usage",
    tags=["admin-usage"],
    dependencies=[Depends(get_super_admin_user)],
)


@admin_router.get("/overview", response_model=AdminUsageOverviewResponse)
async def get_admin_usage_overview(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    has_warning: Optional[bool] = Query(None, description="Filter tenants with warnings"),
    has_exceeded: Optional[bool] = Query(None, description="Filter tenants that exceeded limits"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get usage overview for all tenants.

    Returns a summary of usage across all tenants with filtering options.
    """
    items, total, warnings, exceeded = UsageService.get_admin_usage_overview(
        db, skip=skip, limit=limit, has_warning=has_warning, has_exceeded=has_exceeded
    )

    return AdminUsageOverviewResponse(
        items=items,
        total=total,
        tenants_with_warnings=warnings,
        tenants_exceeded=exceeded,
    )


@admin_router.get("/tenant/{tenant_id}/summary", response_model=TenantUsageSummary)
async def get_tenant_usage_summary(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Get detailed usage summary for a specific tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return UsageService.get_usage_summary(db, tenant_id)


@admin_router.get("/tenant/{tenant_id}/trends/{metric_type}", response_model=UsageTrends)
async def get_tenant_usage_trends(
    tenant_id: UUID,
    metric_type: MetricTypeEnum,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Get historical usage trends for a specific tenant and metric."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if end_date is None:
        end_date = date.today()
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    return UsageService.get_usage_trends(db, tenant_id, metric_type, start_date, end_date)


@admin_router.put("/tenant/{tenant_id}/quota/{metric_type}", response_model=UsageQuotaResponse)
async def update_tenant_quota(
    tenant_id: UUID,
    metric_type: MetricTypeEnum,
    data: UsageQuotaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Update quota limit for a specific tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if data.limit_value is not None:
        quota = UsageService.update_quota_limit(
            db, tenant_id, metric_type, data.limit_value, data.alert_threshold
        )
    else:
        quota = UsageService.get_or_create_quota(db, tenant_id, metric_type)

    return UsageQuotaResponse(
        id=quota.id,
        tenant_id=quota.tenant_id,
        metric_type=quota.metric_type,
        limit_value=quota.limit_value,
        current_value=quota.current_value,
        period_start=quota.period_start,
        reset_date=quota.reset_date,
        alert_threshold=quota.alert_threshold,
        usage_percentage=quota.usage_percentage,
        is_unlimited=quota.is_unlimited,
        is_exceeded=quota.is_exceeded,
        is_near_limit=quota.is_near_limit,
        remaining=quota.remaining,
        created_at=quota.created_at,
        updated_at=quota.updated_at,
    )


@admin_router.post("/tenant/{tenant_id}/reset/{metric_type}", response_model=UsageQuotaResponse)
async def reset_tenant_usage(
    tenant_id: UUID,
    metric_type: MetricTypeEnum,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Reset usage counter for a specific metric."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    quota = UsageService.reset_usage(db, tenant_id, metric_type)

    return UsageQuotaResponse(
        id=quota.id,
        tenant_id=quota.tenant_id,
        metric_type=quota.metric_type,
        limit_value=quota.limit_value,
        current_value=quota.current_value,
        period_start=quota.period_start,
        reset_date=quota.reset_date,
        alert_threshold=quota.alert_threshold,
        usage_percentage=quota.usage_percentage,
        is_unlimited=quota.is_unlimited,
        is_exceeded=quota.is_exceeded,
        is_near_limit=quota.is_near_limit,
        remaining=quota.remaining,
        created_at=quota.created_at,
        updated_at=quota.updated_at,
    )


@admin_router.post("/tenant/{tenant_id}/reset-all")
async def reset_all_tenant_usage(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Reset all usage counters for a tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    quotas = UsageService.reset_all_quotas(db, tenant_id)

    return {"message": f"Reset {len(quotas)} usage counters for tenant", "count": len(quotas)}


@admin_router.post("/tenant/{tenant_id}/sync-tier")
async def sync_tenant_quotas_with_tier(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Sync quota limits with tenant's current subscription tier."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    quotas = UsageService.sync_tenant_quotas_with_tier(db, tenant_id, tenant.tier)

    return {"message": f"Synced {len(quotas)} quotas with tier '{tenant.tier}'", "tier": tenant.tier}


@admin_router.get("/alerts", response_model=UsageAlertListResponse)
async def get_all_alerts(
    tenant_id: Optional[UUID] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Get all usage alerts across tenants."""
    alerts, total = UsageService.get_alerts(
        db, tenant_id=tenant_id, acknowledged=acknowledged, skip=skip, limit=limit
    )

    items = [UsageAlertResponse(
        id=alert.id,
        tenant_id=alert.tenant_id,
        metric_type=alert.metric_type,
        alert_type=alert.alert_type,
        usage_percentage=alert.usage_percentage,
        current_value=alert.current_value,
        limit_value=alert.limit_value,
        message=alert.message,
        acknowledged_at=alert.acknowledged_at,
        created_at=alert.created_at,
    ) for alert in alerts]

    return UsageAlertListResponse(items=items, total=total)


@admin_router.post("/process-resets")
async def process_monthly_resets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Manually trigger monthly quota resets.

    This is normally called by a cron job, but can be triggered manually.
    """
    count = UsageService.process_monthly_reset(db)
    return {"message": f"Processed {count} quota resets", "count": count}


# ============================================================================
# INTERNAL API - For tracking usage from middleware/services
# ============================================================================

internal_router = APIRouter(
    prefix="/internal/usage",
    tags=["internal-usage"],
)


@internal_router.post("/increment", response_model=UsageIncrementResponse)
async def increment_usage(
    data: UsageIncrementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """
    Increment usage counter.

    Called internally by middleware or services to track usage.
    """
    return UsageService.increment_usage(db, tenant.id, data.metric_type, data.amount)
