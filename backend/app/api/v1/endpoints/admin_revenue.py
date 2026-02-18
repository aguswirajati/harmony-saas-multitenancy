"""
Admin Revenue Analytics API Endpoints
Revenue metrics, trends, and export for super admin dashboard.
"""
from datetime import date, timedelta
from typing import Optional, Literal
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from app.api.deps import get_db, get_super_admin_user
from app.models.user import User
from app.services.revenue_service import RevenueService
from app.schemas.revenue import (
    RevenueStatsResponse,
    RevenueTrends,
)

router = APIRouter(
    prefix="/admin/revenue",
    tags=["admin-revenue"],
    dependencies=[Depends(get_super_admin_user)],
)


@router.get("/stats", response_model=RevenueStatsResponse)
async def get_revenue_stats(
    start_date: Optional[date] = Query(
        None,
        description="Start date for the period (defaults to 30 days ago)"
    ),
    end_date: Optional[date] = Query(
        None,
        description="End date for the period (defaults to today)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get revenue analytics dashboard metrics.

    Returns:
    - MRR (Monthly Recurring Revenue)
    - ARR (Annual Recurring Revenue)
    - Churn rate and metrics
    - ARPU (Average Revenue Per Tenant)
    - Revenue breakdown by tier and billing cycle
    - Revenue movement (new/expansion/contraction/churn)
    """
    return RevenueService.get_revenue_stats(db, start_date, end_date)


@router.get("/trends", response_model=RevenueTrends)
async def get_revenue_trends(
    start_date: Optional[date] = Query(
        None,
        description="Start date for the period (defaults to 30 days ago)"
    ),
    end_date: Optional[date] = Query(
        None,
        description="End date for the period (defaults to today)"
    ),
    period: Literal["daily", "weekly", "monthly"] = Query(
        "daily",
        description="Aggregation period for the data points"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get time-series revenue data for charts.

    Returns data points aggregated by day, week, or month.
    Use for plotting revenue trends over time.
    """
    # Default to last 30 days
    if end_date is None:
        end_date = date.today()
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    return RevenueService.get_revenue_trends(db, start_date, end_date, period)


@router.get("/export")
async def export_revenue_csv(
    start_date: Optional[date] = Query(
        None,
        description="Start date for export (defaults to 30 days ago)"
    ),
    end_date: Optional[date] = Query(
        None,
        description="End date for export (defaults to today)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Export revenue data as CSV.

    Downloads a CSV file with:
    - All transactions in the date range
    - Transaction details (amount, type, status, tenant)
    - Summary totals
    """
    # Default to last 30 days
    if end_date is None:
        end_date = date.today()
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    csv_content = RevenueService.export_revenue_csv(db, start_date, end_date)

    # Create filename with date range
    filename = f"revenue-export-{start_date}-to-{end_date}.csv"

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
