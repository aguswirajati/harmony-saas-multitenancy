"""
Revenue Analytics Service
Business logic for calculating MRR, ARR, churn, ARPU, and revenue trends.
"""
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Tuple
from sqlalchemy import func, and_, or_, case, extract
from sqlalchemy.orm import Session
import csv
import io

from app.models.tenant import Tenant
from app.models.subscription_tier import SubscriptionTier
from app.models.billing_transaction import BillingTransaction, TransactionStatus, TransactionType
from app.schemas.revenue import (
    RevenueMetrics,
    ChurnMetrics,
    ARPUMetrics,
    TierBreakdown,
    BillingCycleBreakdown,
    RevenueMovement,
    RevenueBreakdown,
    RevenueTrendPoint,
    RevenueTrends,
    RevenueStatsResponse,
)


class RevenueService:
    """Service for revenue analytics calculations"""

    @staticmethod
    def calculate_mrr(db: Session) -> Tuple[int, int]:
        """
        Calculate Monthly Recurring Revenue (MRR).

        MRR = Sum of (monthly price for monthly subscribers) +
              Sum of (yearly price / 12 for yearly subscribers)

        Returns: (current_mrr, previous_mrr)
        """
        # Get all active paid tenants with their subscription tier prices
        query = (
            db.query(
                Tenant.billing_period,
                SubscriptionTier.price_monthly,
                SubscriptionTier.price_yearly,
            )
            .join(SubscriptionTier, Tenant.tier == SubscriptionTier.code)
            .filter(
                Tenant.is_active == True,
                Tenant.subscription_status == 'active',
                Tenant.tier != 'free',
                SubscriptionTier.is_active == True,
            )
        )

        current_mrr = 0
        for billing_period, price_monthly, price_yearly in query.all():
            if billing_period == 'yearly':
                # Yearly subscribers: divide yearly price by 12
                current_mrr += price_yearly // 12
            else:
                # Monthly subscribers: use monthly price
                current_mrr += price_monthly

        # Calculate previous month's MRR (approximation based on current data)
        # In production, this would query historical snapshots
        previous_mrr = current_mrr  # Placeholder - needs historical data

        return current_mrr, previous_mrr

    @staticmethod
    def calculate_arr(mrr: int) -> int:
        """Calculate Annual Recurring Revenue from MRR"""
        return mrr * 12

    @staticmethod
    def calculate_churn_rate(
        db: Session,
        start_date: date,
        end_date: date
    ) -> ChurnMetrics:
        """
        Calculate churn rate for a given period.

        Churn Rate = (Churned Tenants / Starting Tenants) * 100

        Churned = Cancelled + Downgraded to free tier
        """
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)

        # Count tenants that were paying at period start
        # This is an approximation - ideally we'd have historical snapshots
        starting_count = db.query(Tenant).filter(
            Tenant.is_active == True,
            Tenant.tier != 'free',
            Tenant.created_at < start_datetime,
        ).count()

        if starting_count == 0:
            # Use current paid tenants as fallback
            starting_count = db.query(Tenant).filter(
                Tenant.is_active == True,
                Tenant.tier != 'free',
            ).count()

        # Count churned transactions (downgrades to free + cancellations)
        churned_query = db.query(
            func.count(BillingTransaction.id).label('count'),
            func.coalesce(func.sum(BillingTransaction.amount), 0).label('revenue')
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.transaction_type == TransactionType.DOWNGRADE,
            BillingTransaction.created_at >= start_datetime,
            BillingTransaction.created_at <= end_datetime,
        )

        churned_result = churned_query.first()
        churned_count = churned_result.count if churned_result else 0
        churned_revenue = int(churned_result.revenue) if churned_result else 0

        # Calculate churn rate
        churn_rate = 0.0
        if starting_count > 0:
            churn_rate = (churned_count / starting_count) * 100

        return ChurnMetrics(
            churn_rate=round(churn_rate, 2),
            churned_count=churned_count,
            churned_revenue=churned_revenue,
            starting_count=starting_count,
            currency="IDR",
        )

    @staticmethod
    def calculate_arpu(db: Session, mrr: int) -> ARPUMetrics:
        """
        Calculate Average Revenue Per User (Tenant).

        ARPU = MRR / Number of Paying Tenants
        """
        paying_tenants = db.query(Tenant).filter(
            Tenant.is_active == True,
            Tenant.subscription_status == 'active',
            Tenant.tier != 'free',
        ).count()

        arpu = 0
        if paying_tenants > 0:
            arpu = mrr // paying_tenants

        return ARPUMetrics(
            arpu=arpu,
            paying_tenants=paying_tenants,
            arpu_growth=0.0,  # Would need historical data
            currency="IDR",
        )

    @staticmethod
    def get_revenue_breakdown(
        db: Session,
        start_date: date,
        end_date: date
    ) -> RevenueBreakdown:
        """Get revenue breakdown by tier, billing cycle, and movement type"""
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)

        # === By Tier ===
        tier_breakdown = []
        tier_query = (
            db.query(
                Tenant.tier,
                SubscriptionTier.display_name,
                func.count(Tenant.id).label('tenant_count'),
                SubscriptionTier.price_monthly,
                SubscriptionTier.price_yearly,
            )
            .join(SubscriptionTier, Tenant.tier == SubscriptionTier.code)
            .filter(
                Tenant.is_active == True,
                Tenant.subscription_status == 'active',
                Tenant.tier != 'free',
                SubscriptionTier.is_active == True,
            )
            .group_by(Tenant.tier, SubscriptionTier.display_name,
                     SubscriptionTier.price_monthly, SubscriptionTier.price_yearly)
        )

        total_revenue = 0
        tier_data = []
        for tier_code, tier_name, tenant_count, price_monthly, price_yearly in tier_query.all():
            # Estimate revenue based on average of monthly/yearly
            estimated_revenue = tenant_count * price_monthly
            total_revenue += estimated_revenue
            tier_data.append({
                'tier_code': tier_code,
                'tier_name': tier_name or tier_code,
                'tenant_count': tenant_count,
                'revenue': estimated_revenue,
            })

        # Calculate percentages
        for tier in tier_data:
            percentage = 0.0
            if total_revenue > 0:
                percentage = (tier['revenue'] / total_revenue) * 100
            tier_breakdown.append(TierBreakdown(
                tier_code=tier['tier_code'],
                tier_name=tier['tier_name'],
                tenant_count=tier['tenant_count'],
                revenue=tier['revenue'],
                percentage=round(percentage, 1),
            ))

        # === By Billing Cycle ===
        monthly_query = db.query(
            func.count(Tenant.id).label('count'),
        ).join(
            SubscriptionTier, Tenant.tier == SubscriptionTier.code
        ).filter(
            Tenant.is_active == True,
            Tenant.subscription_status == 'active',
            Tenant.tier != 'free',
            Tenant.billing_period == 'monthly',
        ).first()

        yearly_query = db.query(
            func.count(Tenant.id).label('count'),
        ).join(
            SubscriptionTier, Tenant.tier == SubscriptionTier.code
        ).filter(
            Tenant.is_active == True,
            Tenant.subscription_status == 'active',
            Tenant.tier != 'free',
            Tenant.billing_period == 'yearly',
        ).first()

        monthly_count = monthly_query.count if monthly_query else 0
        yearly_count = yearly_query.count if yearly_query else 0

        # Calculate revenue from paid transactions
        monthly_revenue_query = db.query(
            func.coalesce(func.sum(BillingTransaction.amount), 0)
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.status == TransactionStatus.PAID,
            BillingTransaction.billing_period == 'monthly',
            BillingTransaction.paid_at >= start_datetime,
            BillingTransaction.paid_at <= end_datetime,
        ).scalar()

        yearly_revenue_query = db.query(
            func.coalesce(func.sum(BillingTransaction.amount), 0)
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.status == TransactionStatus.PAID,
            BillingTransaction.billing_period == 'yearly',
            BillingTransaction.paid_at >= start_datetime,
            BillingTransaction.paid_at <= end_datetime,
        ).scalar()

        monthly_revenue = int(monthly_revenue_query) if monthly_revenue_query else 0
        yearly_revenue = int(yearly_revenue_query) if yearly_revenue_query else 0
        total_cycle_revenue = monthly_revenue + yearly_revenue

        billing_cycle = BillingCycleBreakdown(
            monthly_revenue=monthly_revenue,
            monthly_count=monthly_count,
            yearly_revenue=yearly_revenue,
            yearly_count=yearly_count,
            monthly_percentage=round((monthly_revenue / total_cycle_revenue * 100) if total_cycle_revenue > 0 else 0, 1),
            yearly_percentage=round((yearly_revenue / total_cycle_revenue * 100) if total_cycle_revenue > 0 else 0, 1),
        )

        # === Revenue Movement ===
        # New subscriptions
        new_revenue = db.query(
            func.coalesce(func.sum(BillingTransaction.amount), 0)
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.status == TransactionStatus.PAID,
            BillingTransaction.transaction_type == TransactionType.SUBSCRIPTION,
            BillingTransaction.paid_at >= start_datetime,
            BillingTransaction.paid_at <= end_datetime,
        ).scalar() or 0

        # Expansion (upgrades)
        expansion_revenue = db.query(
            func.coalesce(func.sum(BillingTransaction.amount), 0)
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.status == TransactionStatus.PAID,
            BillingTransaction.transaction_type == TransactionType.UPGRADE,
            BillingTransaction.paid_at >= start_datetime,
            BillingTransaction.paid_at <= end_datetime,
        ).scalar() or 0

        # Contraction (downgrades - credit generated)
        contraction_revenue = db.query(
            func.coalesce(func.sum(BillingTransaction.credit_generated), 0)
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.transaction_type == TransactionType.DOWNGRADE,
            BillingTransaction.created_at >= start_datetime,
            BillingTransaction.created_at <= end_datetime,
        ).scalar() or 0

        # Churned (cancelled/refunded)
        churned_revenue = db.query(
            func.coalesce(func.sum(BillingTransaction.amount), 0)
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.status.in_([TransactionStatus.CANCELLED, TransactionStatus.REFUNDED]),
            BillingTransaction.cancelled_at >= start_datetime,
            BillingTransaction.cancelled_at <= end_datetime,
        ).scalar() or 0

        movement = RevenueMovement(
            new_revenue=int(new_revenue),
            expansion_revenue=int(expansion_revenue),
            contraction_revenue=int(contraction_revenue),
            churned_revenue=int(churned_revenue),
            net_revenue=int(new_revenue) + int(expansion_revenue) - int(contraction_revenue) - int(churned_revenue),
            currency="IDR",
        )

        return RevenueBreakdown(
            by_tier=tier_breakdown,
            by_billing_cycle=billing_cycle,
            movement=movement,
        )

    @staticmethod
    def get_revenue_trends(
        db: Session,
        start_date: date,
        end_date: date,
        period: str = "daily"
    ) -> RevenueTrends:
        """
        Get time-series revenue data for charts.

        Aggregates by day, week, or month depending on period param.
        """
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)

        # Determine date truncation based on period
        if period == "weekly":
            date_trunc = func.date_trunc('week', BillingTransaction.paid_at)
        elif period == "monthly":
            date_trunc = func.date_trunc('month', BillingTransaction.paid_at)
        else:  # daily
            date_trunc = func.date_trunc('day', BillingTransaction.paid_at)

        # Query paid transactions grouped by period
        query = (
            db.query(
                date_trunc.label('period_date'),
                func.sum(BillingTransaction.amount).label('revenue'),
                func.sum(
                    case(
                        (BillingTransaction.transaction_type == TransactionType.SUBSCRIPTION, BillingTransaction.amount),
                        else_=0
                    )
                ).label('new_revenue'),
                func.count(func.distinct(BillingTransaction.tenant_id)).label('tenant_count'),
            )
            .filter(
                BillingTransaction.is_active == True,
                BillingTransaction.status == TransactionStatus.PAID,
                BillingTransaction.paid_at >= start_datetime,
                BillingTransaction.paid_at <= end_datetime,
            )
            .group_by(date_trunc)
            .order_by(date_trunc)
        )

        results = query.all()

        # Generate all dates in range
        data_points = []
        current_date = start_date
        result_map = {}

        for row in results:
            if row.period_date:
                period_date = row.period_date.date()
                result_map[period_date] = {
                    'revenue': int(row.revenue) if row.revenue else 0,
                    'new_revenue': int(row.new_revenue) if row.new_revenue else 0,
                    'tenant_count': row.tenant_count or 0,
                }

        # Fill in gaps with zero values
        if period == "daily":
            delta = timedelta(days=1)
        elif period == "weekly":
            delta = timedelta(weeks=1)
        else:  # monthly
            delta = timedelta(days=30)  # Approximation

        # Calculate current MRR for baseline
        current_mrr, _ = RevenueService.calculate_mrr(db)

        while current_date <= end_date:
            result = result_map.get(current_date, {
                'revenue': 0,
                'new_revenue': 0,
                'tenant_count': 0,
            })

            data_points.append(RevenueTrendPoint(
                date=current_date,
                mrr=current_mrr,  # Would be historical MRR ideally
                revenue=result['revenue'],
                new_revenue=result['new_revenue'],
                churned_revenue=0,  # Would need to track this
                tenant_count=result['tenant_count'],
            ))

            current_date += delta

        return RevenueTrends(
            period=period,
            start_date=start_date,
            end_date=end_date,
            data_points=data_points,
            currency="IDR",
        )

    @staticmethod
    def get_revenue_stats(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> RevenueStatsResponse:
        """Get combined revenue statistics for the dashboard"""
        # Default to last 30 days
        if end_date is None:
            end_date = date.today()
        if start_date is None:
            start_date = end_date - timedelta(days=30)

        # Calculate all metrics
        current_mrr, previous_mrr = RevenueService.calculate_mrr(db)
        arr = RevenueService.calculate_arr(current_mrr)

        # Calculate growth rates
        mrr_growth = 0.0
        if previous_mrr > 0:
            mrr_growth = ((current_mrr - previous_mrr) / previous_mrr) * 100

        metrics = RevenueMetrics(
            mrr=current_mrr,
            arr=arr,
            mrr_growth=round(mrr_growth, 2),
            arr_growth=round(mrr_growth, 2),  # Same as MRR growth
            currency="IDR",
        )

        churn = RevenueService.calculate_churn_rate(db, start_date, end_date)
        arpu = RevenueService.calculate_arpu(db, current_mrr)
        breakdown = RevenueService.get_revenue_breakdown(db, start_date, end_date)

        return RevenueStatsResponse(
            metrics=metrics,
            churn=churn,
            arpu=arpu,
            breakdown=breakdown,
            period_start=start_date,
            period_end=end_date,
            currency="IDR",
        )

    @staticmethod
    def export_revenue_csv(
        db: Session,
        start_date: date,
        end_date: date
    ) -> str:
        """
        Generate CSV content for revenue data export.

        Returns CSV string with transaction details.
        """
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)

        # Query transactions with tenant info
        transactions = (
            db.query(
                BillingTransaction,
                Tenant.name.label('tenant_name'),
            )
            .join(Tenant, BillingTransaction.tenant_id == Tenant.id)
            .filter(
                BillingTransaction.is_active == True,
                BillingTransaction.created_at >= start_datetime,
                BillingTransaction.created_at <= end_datetime,
            )
            .order_by(BillingTransaction.created_at.desc())
        ).all()

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)

        # Header row
        writer.writerow([
            'Date',
            'Transaction Number',
            'Tenant',
            'Type',
            'Billing Period',
            'Amount',
            'Original Amount',
            'Credit Applied',
            'Credit Generated',
            'Status',
            'Currency',
        ])

        # Data rows
        for transaction, tenant_name in transactions:
            writer.writerow([
                transaction.created_at.strftime('%Y-%m-%d'),
                transaction.transaction_number,
                tenant_name,
                transaction.transaction_type,
                transaction.billing_period,
                transaction.amount,
                transaction.original_amount,
                transaction.credit_applied,
                transaction.credit_generated,
                transaction.status,
                transaction.currency,
            ])

        # Add summary section
        writer.writerow([])
        writer.writerow(['=== SUMMARY ==='])

        # Total revenue
        total_paid = sum(
            t.amount for t, _ in transactions
            if t.status == TransactionStatus.PAID
        )
        total_pending = sum(
            t.amount for t, _ in transactions
            if t.status == TransactionStatus.PENDING
        )

        writer.writerow(['Total Paid Revenue', total_paid])
        writer.writerow(['Total Pending Revenue', total_pending])
        writer.writerow(['Total Transactions', len(transactions)])
        writer.writerow(['Period', f'{start_date} to {end_date}'])

        return output.getvalue()
