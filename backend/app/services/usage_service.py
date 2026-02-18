"""
Usage Metering Service
Business logic for tracking API calls, storage, and other usage metrics.
"""
from datetime import datetime, date, timezone, timedelta
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from app.models.usage import UsageRecord, UsageQuota, UsageAlert, MetricType
from app.models.tenant import Tenant
from app.models.subscription_tier import SubscriptionTier
from app.schemas.usage import (
    UsageQuotaResponse,
    UsageMetricSummary,
    TenantUsageSummary,
    UsageTrendPoint,
    UsageTrends,
    TenantUsageOverview,
    UsageIncrementResponse,
    METRIC_DISPLAY_NAMES,
    METRIC_UNITS,
)


class UsageService:
    """Service for usage metering and quota management"""

    # Default quotas by tier (metric_type -> limit)
    # -1 means unlimited
    DEFAULT_QUOTAS = {
        "free": {
            MetricType.API_CALLS: 1000,
            MetricType.STORAGE_BYTES: 1 * 1024 * 1024 * 1024,  # 1 GB
            MetricType.ACTIVE_USERS: 5,
            MetricType.BRANCHES: 1,
        },
        "basic": {
            MetricType.API_CALLS: 10000,
            MetricType.STORAGE_BYTES: 10 * 1024 * 1024 * 1024,  # 10 GB
            MetricType.ACTIVE_USERS: 20,
            MetricType.BRANCHES: 5,
        },
        "premium": {
            MetricType.API_CALLS: 100000,
            MetricType.STORAGE_BYTES: 50 * 1024 * 1024 * 1024,  # 50 GB
            MetricType.ACTIVE_USERS: 100,
            MetricType.BRANCHES: 20,
        },
        "enterprise": {
            MetricType.API_CALLS: -1,  # Unlimited
            MetricType.STORAGE_BYTES: 200 * 1024 * 1024 * 1024,  # 200 GB
            MetricType.ACTIVE_USERS: -1,  # Unlimited
            MetricType.BRANCHES: -1,  # Unlimited
        },
    }

    @staticmethod
    def get_or_create_quota(
        db: Session,
        tenant_id: UUID,
        metric_type: str,
        limit_value: Optional[int] = None
    ) -> UsageQuota:
        """Get existing quota or create a new one"""
        quota = db.query(UsageQuota).filter(
            UsageQuota.tenant_id == tenant_id,
            UsageQuota.metric_type == metric_type,
            UsageQuota.is_active == True,
        ).first()

        if quota:
            return quota

        # Get tenant's tier to determine default limit
        if limit_value is None:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            tier = tenant.tier if tenant else "free"
            tier_quotas = UsageService.DEFAULT_QUOTAS.get(tier, UsageService.DEFAULT_QUOTAS["free"])
            limit_value = tier_quotas.get(metric_type, 0)

        # Create new quota
        quota = UsageQuota(
            tenant_id=tenant_id,
            metric_type=metric_type,
            limit_value=limit_value,
            current_value=0,
            period_start=date.today(),
            reset_date=UsageService._get_next_reset_date(),
            alert_threshold=80,
        )
        db.add(quota)
        db.commit()
        db.refresh(quota)
        return quota

    @staticmethod
    def _get_next_reset_date() -> date:
        """Calculate next month's reset date"""
        today = date.today()
        if today.month == 12:
            return date(today.year + 1, 1, 1)
        else:
            return date(today.year, today.month + 1, 1)

    @staticmethod
    def increment_usage(
        db: Session,
        tenant_id: UUID,
        metric_type: str,
        amount: int = 1
    ) -> UsageIncrementResponse:
        """
        Increment usage counter for a tenant.

        Returns the new usage state including whether limits are exceeded.
        """
        quota = UsageService.get_or_create_quota(db, tenant_id, metric_type)

        previous_value = quota.current_value
        quota.current_value += amount
        quota.updated_at = datetime.now(timezone.utc)

        # Also record in usage_records for historical tracking
        UsageService._record_daily_usage(db, tenant_id, metric_type, amount)

        # Check if we need to send an alert
        if quota.is_near_limit and quota.can_send_alert():
            UsageService._create_alert(db, quota)
            quota.mark_alert_sent()

        db.commit()
        db.refresh(quota)

        return UsageIncrementResponse(
            metric_type=metric_type,
            previous_value=previous_value,
            new_value=quota.current_value,
            limit_value=quota.limit_value,
            usage_percentage=quota.usage_percentage,
            is_exceeded=quota.is_exceeded,
            is_near_limit=quota.is_near_limit,
            remaining=quota.remaining,
        )

    @staticmethod
    def _record_daily_usage(
        db: Session,
        tenant_id: UUID,
        metric_type: str,
        amount: int
    ) -> None:
        """Record usage in daily aggregation table using upsert"""
        today = date.today()

        # Use PostgreSQL upsert (INSERT ... ON CONFLICT)
        stmt = insert(UsageRecord).values(
            tenant_id=tenant_id,
            metric_type=metric_type,
            value=amount,
            recorded_date=today,
            created_at=datetime.now(timezone.utc),
        ).on_conflict_do_update(
            constraint='uix_usage_record_tenant_metric_date',
            set_={
                'value': UsageRecord.value + amount,
                'updated_at': datetime.now(timezone.utc),
            }
        )
        db.execute(stmt)

    @staticmethod
    def _create_alert(db: Session, quota: UsageQuota) -> UsageAlert:
        """Create a usage alert"""
        if quota.is_exceeded:
            alert_type = "limit_exceeded"
            message = f"You have exceeded your {METRIC_DISPLAY_NAMES.get(quota.metric_type, quota.metric_type)} limit."
        elif quota.usage_percentage >= 100:
            alert_type = "limit_reached"
            message = f"You have reached your {METRIC_DISPLAY_NAMES.get(quota.metric_type, quota.metric_type)} limit."
        else:
            alert_type = "threshold_warning"
            message = f"You have used {quota.usage_percentage:.0f}% of your {METRIC_DISPLAY_NAMES.get(quota.metric_type, quota.metric_type)} quota."

        alert = UsageAlert(
            tenant_id=quota.tenant_id,
            metric_type=quota.metric_type,
            alert_type=alert_type,
            usage_percentage=int(quota.usage_percentage),
            current_value=quota.current_value,
            limit_value=quota.limit_value,
            message=message,
        )
        db.add(alert)
        return alert

    @staticmethod
    def set_usage(
        db: Session,
        tenant_id: UUID,
        metric_type: str,
        value: int
    ) -> UsageQuota:
        """Set absolute usage value (for metrics like storage, active users)"""
        quota = UsageService.get_or_create_quota(db, tenant_id, metric_type)
        quota.current_value = value
        quota.updated_at = datetime.now(timezone.utc)

        # Check for alerts
        if quota.is_near_limit and quota.can_send_alert():
            UsageService._create_alert(db, quota)
            quota.mark_alert_sent()

        db.commit()
        db.refresh(quota)
        return quota

    @staticmethod
    def reset_usage(
        db: Session,
        tenant_id: UUID,
        metric_type: str
    ) -> UsageQuota:
        """Reset usage counter to zero"""
        quota = UsageService.get_or_create_quota(db, tenant_id, metric_type)
        quota.current_value = 0
        quota.period_start = date.today()
        quota.reset_date = UsageService._get_next_reset_date()
        quota.alert_sent_at = None
        quota.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(quota)
        return quota

    @staticmethod
    def reset_all_quotas(
        db: Session,
        tenant_id: UUID
    ) -> List[UsageQuota]:
        """Reset all usage quotas for a tenant"""
        quotas = db.query(UsageQuota).filter(
            UsageQuota.tenant_id == tenant_id,
            UsageQuota.is_active == True,
        ).all()

        for quota in quotas:
            quota.current_value = 0
            quota.period_start = date.today()
            quota.reset_date = UsageService._get_next_reset_date()
            quota.alert_sent_at = None
            quota.updated_at = datetime.now(timezone.utc)

        db.commit()
        return quotas

    @staticmethod
    def update_quota_limit(
        db: Session,
        tenant_id: UUID,
        metric_type: str,
        limit_value: int,
        alert_threshold: Optional[int] = None
    ) -> UsageQuota:
        """Update quota limit for a tenant"""
        quota = UsageService.get_or_create_quota(db, tenant_id, metric_type)
        quota.limit_value = limit_value
        if alert_threshold is not None:
            quota.alert_threshold = alert_threshold
        quota.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(quota)
        return quota

    @staticmethod
    def get_tenant_quotas(
        db: Session,
        tenant_id: UUID
    ) -> List[UsageQuota]:
        """Get all quotas for a tenant"""
        return db.query(UsageQuota).filter(
            UsageQuota.tenant_id == tenant_id,
            UsageQuota.is_active == True,
        ).all()

    @staticmethod
    def get_usage_summary(
        db: Session,
        tenant_id: UUID
    ) -> TenantUsageSummary:
        """Get complete usage summary for a tenant"""
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        quotas = UsageService.get_tenant_quotas(db, tenant_id)

        # Ensure quotas exist for all metric types
        metric_types = [MetricType.API_CALLS, MetricType.STORAGE_BYTES, MetricType.ACTIVE_USERS, MetricType.BRANCHES]
        existing_metrics = {q.metric_type for q in quotas}

        for metric_type in metric_types:
            if metric_type not in existing_metrics:
                quota = UsageService.get_or_create_quota(db, tenant_id, metric_type)
                quotas.append(quota)

        # Build metric summaries
        metrics = []
        for quota in quotas:
            metrics.append(UsageMetricSummary(
                metric_type=quota.metric_type,
                metric_display_name=METRIC_DISPLAY_NAMES.get(quota.metric_type, quota.metric_type),
                current_value=quota.current_value,
                limit_value=quota.limit_value,
                usage_percentage=quota.usage_percentage,
                is_unlimited=quota.is_unlimited,
                is_exceeded=quota.is_exceeded,
                is_near_limit=quota.is_near_limit,
                remaining=quota.remaining,
                unit=METRIC_UNITS.get(quota.metric_type, "units"),
            ))

        # Count unacknowledged alerts
        unacknowledged = db.query(UsageAlert).filter(
            UsageAlert.tenant_id == tenant_id,
            UsageAlert.acknowledged_at == None,
            UsageAlert.is_active == True,
        ).count()

        return TenantUsageSummary(
            tenant_id=tenant_id,
            tenant_name=tenant.name if tenant else None,
            period_start=quotas[0].period_start if quotas else date.today(),
            metrics=metrics,
            has_alerts=unacknowledged > 0,
            unacknowledged_alerts=unacknowledged,
        )

    @staticmethod
    def get_usage_trends(
        db: Session,
        tenant_id: UUID,
        metric_type: str,
        start_date: date,
        end_date: date
    ) -> UsageTrends:
        """Get historical usage trends for a metric"""
        records = db.query(UsageRecord).filter(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.metric_type == metric_type,
            UsageRecord.recorded_date >= start_date,
            UsageRecord.recorded_date <= end_date,
            UsageRecord.is_active == True,
        ).order_by(UsageRecord.recorded_date).all()

        # Build data points, filling gaps with zero
        data_points = []
        record_map = {r.recorded_date: r.value for r in records}

        current = start_date
        total = 0
        while current <= end_date:
            value = record_map.get(current, 0)
            total += value
            data_points.append(UsageTrendPoint(date=current, value=value))
            current += timedelta(days=1)

        avg = total / len(data_points) if data_points else 0

        return UsageTrends(
            metric_type=metric_type,
            start_date=start_date,
            end_date=end_date,
            data_points=data_points,
            total=total,
            average=avg,
        )

    @staticmethod
    def get_admin_usage_overview(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        has_warning: Optional[bool] = None,
        has_exceeded: Optional[bool] = None
    ) -> Tuple[List[TenantUsageOverview], int, int, int]:
        """Get usage overview for all tenants (admin view)"""
        # Get all active tenants
        tenants_query = db.query(Tenant).filter(Tenant.is_active == True)

        total_tenants = tenants_query.count()
        tenants = tenants_query.offset(skip).limit(limit).all()

        overviews = []
        total_warnings = 0
        total_exceeded = 0

        for tenant in tenants:
            quotas = {q.metric_type: q for q in UsageService.get_tenant_quotas(db, tenant.id)}

            # Get or create quotas for all metrics
            api_quota = quotas.get(MetricType.API_CALLS) or UsageService.get_or_create_quota(db, tenant.id, MetricType.API_CALLS)
            storage_quota = quotas.get(MetricType.STORAGE_BYTES) or UsageService.get_or_create_quota(db, tenant.id, MetricType.STORAGE_BYTES)
            users_quota = quotas.get(MetricType.ACTIVE_USERS) or UsageService.get_or_create_quota(db, tenant.id, MetricType.ACTIVE_USERS)
            branches_quota = quotas.get(MetricType.BRANCHES) or UsageService.get_or_create_quota(db, tenant.id, MetricType.BRANCHES)

            has_exceeded_flag = any([
                api_quota.is_exceeded,
                storage_quota.is_exceeded,
                users_quota.is_exceeded,
                branches_quota.is_exceeded,
            ])
            has_warning_flag = any([
                api_quota.is_near_limit,
                storage_quota.is_near_limit,
                users_quota.is_near_limit,
                branches_quota.is_near_limit,
            ])

            if has_exceeded_flag:
                total_exceeded += 1
            if has_warning_flag and not has_exceeded_flag:
                total_warnings += 1

            # Apply filters
            if has_warning is True and not has_warning_flag:
                continue
            if has_exceeded is True and not has_exceeded_flag:
                continue

            overviews.append(TenantUsageOverview(
                tenant_id=tenant.id,
                tenant_name=tenant.name,
                tier=tenant.tier,
                api_calls=api_quota.current_value,
                api_calls_limit=api_quota.limit_value,
                api_calls_percentage=api_quota.usage_percentage,
                storage_bytes=storage_quota.current_value,
                storage_limit_bytes=storage_quota.limit_value,
                storage_percentage=storage_quota.usage_percentage,
                active_users=users_quota.current_value,
                users_limit=users_quota.limit_value,
                users_percentage=users_quota.usage_percentage,
                branches=branches_quota.current_value,
                branches_limit=branches_quota.limit_value,
                branches_percentage=branches_quota.usage_percentage,
                has_exceeded=has_exceeded_flag,
                has_warning=has_warning_flag,
            ))

        return overviews, total_tenants, total_warnings, total_exceeded

    @staticmethod
    def get_alerts(
        db: Session,
        tenant_id: Optional[UUID] = None,
        acknowledged: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[UsageAlert], int]:
        """Get usage alerts"""
        query = db.query(UsageAlert).filter(UsageAlert.is_active == True)

        if tenant_id:
            query = query.filter(UsageAlert.tenant_id == tenant_id)

        if acknowledged is True:
            query = query.filter(UsageAlert.acknowledged_at != None)
        elif acknowledged is False:
            query = query.filter(UsageAlert.acknowledged_at == None)

        total = query.count()
        alerts = query.order_by(UsageAlert.created_at.desc()).offset(skip).limit(limit).all()

        return alerts, total

    @staticmethod
    def acknowledge_alert(
        db: Session,
        alert_id: UUID,
        tenant_id: Optional[UUID] = None
    ) -> Optional[UsageAlert]:
        """Acknowledge a usage alert"""
        query = db.query(UsageAlert).filter(
            UsageAlert.id == alert_id,
            UsageAlert.is_active == True,
        )

        if tenant_id:
            query = query.filter(UsageAlert.tenant_id == tenant_id)

        alert = query.first()
        if alert:
            alert.acknowledged_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(alert)

        return alert

    @staticmethod
    def sync_tenant_quotas_with_tier(
        db: Session,
        tenant_id: UUID,
        tier: str
    ) -> List[UsageQuota]:
        """Sync quota limits when tenant tier changes"""
        tier_quotas = UsageService.DEFAULT_QUOTAS.get(tier, UsageService.DEFAULT_QUOTAS["free"])

        quotas = []
        for metric_type, limit_value in tier_quotas.items():
            quota = UsageService.get_or_create_quota(db, tenant_id, metric_type, limit_value)
            quota.limit_value = limit_value
            quota.updated_at = datetime.now(timezone.utc)
            quotas.append(quota)

        db.commit()
        return quotas

    @staticmethod
    def process_monthly_reset(db: Session) -> int:
        """
        Process monthly quota resets.

        Call this from a cron job on the 1st of each month.
        Returns the number of quotas reset.
        """
        today = date.today()

        quotas = db.query(UsageQuota).filter(
            UsageQuota.is_active == True,
            UsageQuota.reset_date <= today,
        ).all()

        count = 0
        for quota in quotas:
            quota.current_value = 0
            quota.period_start = today
            quota.reset_date = UsageService._get_next_reset_date()
            quota.alert_sent_at = None
            quota.updated_at = datetime.now(timezone.utc)
            count += 1

        db.commit()
        return count
