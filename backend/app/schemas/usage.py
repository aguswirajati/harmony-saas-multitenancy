"""
Usage Schemas
Request/response models for usage metering and quotas
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, date
from uuid import UUID


# ============================================================================
# METRIC TYPES
# ============================================================================

MetricTypeEnum = Literal["api_calls", "storage_bytes", "active_users", "branches"]


# ============================================================================
# USAGE RECORD SCHEMAS
# ============================================================================

class UsageRecordCreate(BaseModel):
    """Schema for creating a usage record"""
    tenant_id: UUID
    metric_type: MetricTypeEnum
    value: int = Field(..., ge=0)
    recorded_date: Optional[date] = None


class UsageRecordResponse(BaseModel):
    """Usage record response"""
    id: UUID
    tenant_id: UUID
    metric_type: str
    value: int
    recorded_date: date
    created_at: datetime

    class Config:
        from_attributes = True


class UsageRecordListResponse(BaseModel):
    """List of usage records"""
    items: List[UsageRecordResponse]
    total: int


# ============================================================================
# USAGE QUOTA SCHEMAS
# ============================================================================

class UsageQuotaCreate(BaseModel):
    """Schema for creating a usage quota"""
    metric_type: MetricTypeEnum
    limit_value: int = Field(..., ge=-1, description="-1 for unlimited")
    alert_threshold: int = Field(default=80, ge=0, le=100)


class UsageQuotaUpdate(BaseModel):
    """Schema for updating a usage quota"""
    limit_value: Optional[int] = Field(None, ge=-1)
    alert_threshold: Optional[int] = Field(None, ge=0, le=100)
    reset_date: Optional[date] = None


class UsageQuotaResponse(BaseModel):
    """Usage quota response"""
    id: UUID
    tenant_id: UUID
    metric_type: str
    limit_value: int
    current_value: int
    period_start: date
    reset_date: Optional[date]
    alert_threshold: int
    usage_percentage: float
    is_unlimited: bool
    is_exceeded: bool
    is_near_limit: bool
    remaining: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class UsageQuotaListResponse(BaseModel):
    """List of usage quotas"""
    items: List[UsageQuotaResponse]
    total: int


# ============================================================================
# USAGE ALERT SCHEMAS
# ============================================================================

class UsageAlertResponse(BaseModel):
    """Usage alert response"""
    id: UUID
    tenant_id: UUID
    metric_type: str
    alert_type: str
    usage_percentage: int
    current_value: int
    limit_value: int
    message: Optional[str]
    acknowledged_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class UsageAlertListResponse(BaseModel):
    """List of usage alerts"""
    items: List[UsageAlertResponse]
    total: int


class UsageAlertAcknowledge(BaseModel):
    """Schema for acknowledging an alert"""
    alert_id: UUID


# ============================================================================
# USAGE SUMMARY SCHEMAS
# ============================================================================

class UsageMetricSummary(BaseModel):
    """Summary of a single metric"""
    metric_type: str
    metric_display_name: str
    current_value: int
    limit_value: int
    usage_percentage: float
    is_unlimited: bool
    is_exceeded: bool
    is_near_limit: bool
    remaining: int
    unit: str  # "calls", "bytes", "users", etc.


class TenantUsageSummary(BaseModel):
    """Complete usage summary for a tenant"""
    tenant_id: UUID
    tenant_name: Optional[str]
    period_start: date
    metrics: List[UsageMetricSummary]
    has_alerts: bool
    unacknowledged_alerts: int


class UsageTrendPoint(BaseModel):
    """Single data point for usage trends"""
    date: date
    value: int


class UsageTrends(BaseModel):
    """Time-series usage data"""
    metric_type: str
    start_date: date
    end_date: date
    data_points: List[UsageTrendPoint]
    total: int
    average: float


# ============================================================================
# ADMIN USAGE OVERVIEW
# ============================================================================

class TenantUsageOverview(BaseModel):
    """Usage overview for a single tenant (admin view)"""
    tenant_id: UUID
    tenant_name: str
    tier: str
    api_calls: int
    api_calls_limit: int
    api_calls_percentage: float
    storage_bytes: int
    storage_limit_bytes: int
    storage_percentage: float
    active_users: int
    users_limit: int
    users_percentage: float
    branches: int
    branches_limit: int
    branches_percentage: float
    has_exceeded: bool
    has_warning: bool


class AdminUsageOverviewResponse(BaseModel):
    """Admin usage overview response"""
    items: List[TenantUsageOverview]
    total: int
    tenants_with_warnings: int
    tenants_exceeded: int


# ============================================================================
# USAGE INCREMENT/DECREMENT
# ============================================================================

class UsageIncrementRequest(BaseModel):
    """Request to increment usage"""
    metric_type: MetricTypeEnum
    amount: int = Field(default=1, ge=1)


class UsageIncrementResponse(BaseModel):
    """Response after incrementing usage"""
    metric_type: str
    previous_value: int
    new_value: int
    limit_value: int
    usage_percentage: float
    is_exceeded: bool
    is_near_limit: bool
    remaining: int


class UsageResetRequest(BaseModel):
    """Request to reset usage counter"""
    metric_type: MetricTypeEnum


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

METRIC_DISPLAY_NAMES = {
    "api_calls": "API Calls",
    "storage_bytes": "Storage",
    "active_users": "Active Users",
    "branches": "Branches",
}

METRIC_UNITS = {
    "api_calls": "calls",
    "storage_bytes": "bytes",
    "active_users": "users",
    "branches": "branches",
}


def format_bytes(bytes_value: int) -> str:
    """Format bytes to human-readable string"""
    if bytes_value < 1024:
        return f"{bytes_value} B"
    elif bytes_value < 1024 * 1024:
        return f"{bytes_value / 1024:.1f} KB"
    elif bytes_value < 1024 * 1024 * 1024:
        return f"{bytes_value / (1024 * 1024):.1f} MB"
    else:
        return f"{bytes_value / (1024 * 1024 * 1024):.2f} GB"


def format_metric_value(metric_type: str, value: int) -> str:
    """Format metric value based on type"""
    if metric_type == "storage_bytes":
        return format_bytes(value)
    elif value == -1:
        return "Unlimited"
    else:
        return f"{value:,}"
