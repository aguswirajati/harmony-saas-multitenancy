"""
Revenue Analytics Schemas
Request/response models for revenue metrics and analytics dashboard
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, date


# ============================================================================
# CORE METRICS
# ============================================================================

class RevenueMetrics(BaseModel):
    """Monthly and Annual Recurring Revenue metrics"""
    mrr: int = Field(..., description="Monthly Recurring Revenue in smallest currency unit")
    arr: int = Field(..., description="Annual Recurring Revenue (MRR * 12)")
    mrr_growth: float = Field(default=0, description="MRR growth percentage vs previous period")
    arr_growth: float = Field(default=0, description="ARR growth percentage vs previous period")
    currency: str = Field(default="IDR", description="Currency code")


class ChurnMetrics(BaseModel):
    """Churn rate and related metrics"""
    churn_rate: float = Field(..., description="Churn rate percentage")
    churned_count: int = Field(..., description="Number of churned tenants")
    churned_revenue: int = Field(..., description="Revenue lost to churn")
    starting_count: int = Field(..., description="Starting tenant count for the period")
    currency: str = Field(default="IDR", description="Currency code")


class ARPUMetrics(BaseModel):
    """Average Revenue Per User/Tenant metrics"""
    arpu: int = Field(..., description="Average Revenue Per Tenant")
    paying_tenants: int = Field(..., description="Number of paying tenants")
    arpu_growth: float = Field(default=0, description="ARPU growth percentage vs previous period")
    currency: str = Field(default="IDR", description="Currency code")


# ============================================================================
# REVENUE BREAKDOWNS
# ============================================================================

class TierBreakdown(BaseModel):
    """Revenue breakdown by subscription tier"""
    tier_code: str
    tier_name: str
    tenant_count: int
    revenue: int
    percentage: float = Field(..., description="Percentage of total revenue")


class BillingCycleBreakdown(BaseModel):
    """Revenue breakdown by billing cycle (monthly/yearly)"""
    monthly_revenue: int
    monthly_count: int
    yearly_revenue: int
    yearly_count: int
    monthly_percentage: float
    yearly_percentage: float


class RevenueMovement(BaseModel):
    """Revenue movement: new, expansion, contraction, churned"""
    new_revenue: int = Field(..., description="Revenue from new subscriptions")
    expansion_revenue: int = Field(..., description="Revenue from upgrades")
    contraction_revenue: int = Field(..., description="Revenue lost to downgrades")
    churned_revenue: int = Field(..., description="Revenue lost to cancellations")
    net_revenue: int = Field(..., description="Net revenue change")
    currency: str = Field(default="IDR")


class RevenueBreakdown(BaseModel):
    """Combined revenue breakdown"""
    by_tier: List[TierBreakdown]
    by_billing_cycle: BillingCycleBreakdown
    movement: RevenueMovement


# ============================================================================
# TIME-SERIES DATA
# ============================================================================

class RevenueTrendPoint(BaseModel):
    """Single data point for time-series charts"""
    date: date
    mrr: int
    revenue: int = Field(..., description="Actual revenue collected")
    new_revenue: int = Field(default=0)
    churned_revenue: int = Field(default=0)
    tenant_count: int = Field(default=0)


class RevenueTrends(BaseModel):
    """Time-series revenue data"""
    period: Literal["daily", "weekly", "monthly"] = "daily"
    start_date: date
    end_date: date
    data_points: List[RevenueTrendPoint]
    currency: str = Field(default="IDR")


# ============================================================================
# DASHBOARD RESPONSE
# ============================================================================

class RevenueStatsResponse(BaseModel):
    """Combined response for revenue analytics dashboard"""
    metrics: RevenueMetrics
    churn: ChurnMetrics
    arpu: ARPUMetrics
    breakdown: RevenueBreakdown
    period_start: date
    period_end: date
    currency: str = Field(default="IDR")


# ============================================================================
# EXPORT SCHEMAS
# ============================================================================

class RevenueExportParams(BaseModel):
    """Parameters for CSV export"""
    start_date: date
    end_date: date
    include_transactions: bool = Field(default=True)
    include_summary: bool = Field(default=True)


class RevenueExportRow(BaseModel):
    """Single row for CSV export"""
    date: str
    transaction_number: Optional[str] = None
    tenant_name: Optional[str] = None
    tier_code: Optional[str] = None
    transaction_type: Optional[str] = None
    billing_period: Optional[str] = None
    amount: int
    status: Optional[str] = None
    currency: str = "IDR"
