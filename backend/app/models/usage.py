"""
Usage tracking models for metered billing.
Tracks API calls, storage consumption, and other usage metrics per tenant.
"""
from sqlalchemy import Column, String, BigInteger, Integer, Date, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, date, timezone

from app.core.database import Base
from app.models.base import BaseModel


class MetricType:
    """Usage metric type constants"""
    API_CALLS = "api_calls"
    STORAGE_BYTES = "storage_bytes"
    ACTIVE_USERS = "active_users"
    BRANCHES = "branches"


class UsageRecord(Base, BaseModel):
    """
    Daily usage records for metered billing.

    Stores aggregated usage per tenant per day per metric type.
    Used for historical reporting and billing calculations.
    """
    __tablename__ = "usage_records"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant this usage belongs to"
    )

    metric_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of metric: api_calls, storage_bytes, active_users, branches"
    )

    value = Column(
        BigInteger,
        nullable=False,
        default=0,
        comment="Usage value (count or bytes)"
    )

    recorded_date = Column(
        Date,
        nullable=False,
        default=lambda: date.today(),
        index=True,
        comment="Date this usage was recorded"
    )

    # Relationships
    tenant = relationship("Tenant", backref="usage_records")

    __table_args__ = (
        # Ensure one record per tenant per metric per day
        UniqueConstraint('tenant_id', 'metric_type', 'recorded_date', name='uix_usage_record_tenant_metric_date'),
        # Index for efficient queries
        Index('ix_usage_records_tenant_date', 'tenant_id', 'recorded_date'),
        Index('ix_usage_records_metric_date', 'metric_type', 'recorded_date'),
    )

    def __repr__(self):
        return f"<UsageRecord {self.tenant_id} {self.metric_type}={self.value} on {self.recorded_date}>"


class UsageQuota(Base, BaseModel):
    """
    Usage quotas and current counters per tenant.

    Tracks current period usage against limits.
    Reset monthly or on billing cycle.
    """
    __tablename__ = "usage_quotas"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant this quota belongs to"
    )

    metric_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of metric being tracked"
    )

    limit_value = Column(
        BigInteger,
        nullable=False,
        default=0,
        comment="Maximum allowed value (-1 for unlimited)"
    )

    current_value = Column(
        BigInteger,
        nullable=False,
        default=0,
        comment="Current period usage"
    )

    period_start = Column(
        Date,
        nullable=False,
        default=lambda: date.today(),
        comment="Start of current billing/quota period"
    )

    reset_date = Column(
        Date,
        nullable=True,
        comment="Date when quota resets (null = manual reset only)"
    )

    alert_threshold = Column(
        Integer,
        nullable=False,
        default=80,
        comment="Percentage threshold for usage alerts"
    )

    alert_sent_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When last alert was sent (to prevent spam)"
    )

    # Relationships
    tenant = relationship("Tenant", backref="usage_quotas")

    __table_args__ = (
        # One quota per tenant per metric
        UniqueConstraint('tenant_id', 'metric_type', name='uix_usage_quota_tenant_metric'),
    )

    def __repr__(self):
        return f"<UsageQuota {self.tenant_id} {self.metric_type}: {self.current_value}/{self.limit_value}>"

    @property
    def is_unlimited(self) -> bool:
        """Check if quota is unlimited"""
        return self.limit_value == -1

    @property
    def usage_percentage(self) -> float:
        """Calculate current usage as percentage of limit"""
        if self.is_unlimited or self.limit_value == 0:
            return 0.0
        return (self.current_value / self.limit_value) * 100

    @property
    def is_exceeded(self) -> bool:
        """Check if quota is exceeded"""
        if self.is_unlimited:
            return False
        return self.current_value >= self.limit_value

    @property
    def is_near_limit(self) -> bool:
        """Check if usage is near the alert threshold"""
        if self.is_unlimited:
            return False
        return self.usage_percentage >= self.alert_threshold

    @property
    def remaining(self) -> int:
        """Get remaining quota"""
        if self.is_unlimited:
            return -1
        return max(0, self.limit_value - self.current_value)

    def can_send_alert(self) -> bool:
        """Check if enough time has passed since last alert (24h cooldown)"""
        if self.alert_sent_at is None:
            return True
        from datetime import timedelta
        cooldown = timedelta(hours=24)
        return datetime.now(timezone.utc) - self.alert_sent_at > cooldown

    def mark_alert_sent(self) -> None:
        """Mark that an alert was sent"""
        self.alert_sent_at = datetime.now(timezone.utc)


class UsageAlert(Base, BaseModel):
    """
    Usage alert history.

    Tracks alerts sent to tenants about quota usage.
    """
    __tablename__ = "usage_alerts"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant this alert was sent to"
    )

    metric_type = Column(
        String(50),
        nullable=False,
        comment="Type of metric that triggered alert"
    )

    alert_type = Column(
        String(50),
        nullable=False,
        comment="Type of alert: threshold_warning, limit_reached, limit_exceeded"
    )

    usage_percentage = Column(
        Integer,
        nullable=False,
        comment="Usage percentage when alert was triggered"
    )

    current_value = Column(
        BigInteger,
        nullable=False,
        comment="Usage value when alert was triggered"
    )

    limit_value = Column(
        BigInteger,
        nullable=False,
        comment="Limit value when alert was triggered"
    )

    message = Column(
        String(500),
        nullable=True,
        comment="Alert message"
    )

    acknowledged_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When tenant acknowledged the alert"
    )

    # Relationships
    tenant = relationship("Tenant", backref="usage_alerts")

    __table_args__ = (
        Index('ix_usage_alerts_tenant_created', 'tenant_id', 'created_at'),
    )

    def __repr__(self):
        return f"<UsageAlert {self.tenant_id} {self.alert_type} for {self.metric_type}>"
