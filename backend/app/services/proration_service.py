"""
Proration Service
Business logic for calculating prorated subscription charges and credits
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class ProrationResult:
    """Result of proration calculation"""
    days_remaining: int
    current_daily_rate: int
    new_daily_rate: int
    proration_credit: int      # Credit from unused days of current tier
    proration_charge: int      # Charge for remaining days at new tier
    net_amount: int            # charge - credit
    credit_balance_available: int  # From tenant credit_balance
    credit_to_apply: int       # Credit to apply from balance
    amount_due: int            # Final amount to pay
    original_amount: int       # Full tier price


class ProrationService:
    """Service for calculating subscription proration"""

    # Days in billing periods
    DAYS_IN_MONTH = 30
    DAYS_IN_YEAR = 365

    @classmethod
    def get_period_days(cls, billing_period: str) -> int:
        """Get number of days in billing period"""
        if billing_period == "yearly":
            return cls.DAYS_IN_YEAR
        return cls.DAYS_IN_MONTH

    @classmethod
    def calculate_daily_rate(cls, tier_price: int, billing_period: str) -> int:
        """
        Calculate daily rate for a tier price.

        Args:
            tier_price: Price in smallest currency unit
            billing_period: "monthly" or "yearly"

        Returns:
            Daily rate in smallest currency unit (rounded)
        """
        period_days = cls.get_period_days(billing_period)
        if period_days == 0:
            return 0

        # Use Decimal for precise calculation
        daily = Decimal(tier_price) / Decimal(period_days)
        return int(daily.quantize(Decimal('1'), rounding=ROUND_HALF_UP))

    @classmethod
    def calculate_days_remaining(
        cls,
        subscription_ends_at: Optional[datetime],
        from_date: Optional[datetime] = None
    ) -> int:
        """
        Calculate days remaining in current subscription period.

        Args:
            subscription_ends_at: When subscription period ends
            from_date: Calculate from this date (default: now)

        Returns:
            Number of days remaining (0 if no end date or already passed)
        """
        if not subscription_ends_at:
            return 0

        if from_date is None:
            from_date = datetime.now(timezone.utc)

        # Ensure both are timezone-aware
        if subscription_ends_at.tzinfo is None:
            subscription_ends_at = subscription_ends_at.replace(tzinfo=timezone.utc)
        if from_date.tzinfo is None:
            from_date = from_date.replace(tzinfo=timezone.utc)

        delta = subscription_ends_at - from_date
        days = delta.days

        return max(0, days)

    @classmethod
    def calculate_proration(
        cls,
        current_tier_price: int,
        new_tier_price: int,
        billing_period: str,
        subscription_ends_at: Optional[datetime],
        credit_balance: int = 0,
        from_date: Optional[datetime] = None
    ) -> ProrationResult:
        """
        Calculate proration for a tier change.

        For upgrades:
        - credit = current_daily_rate * days_remaining
        - charge = new_daily_rate * days_remaining
        - amount_due = charge - credit - credit_balance

        For downgrades:
        - No charge (scheduled for end of period)
        - amount_due = 0

        Args:
            current_tier_price: Current tier price for billing period
            new_tier_price: New tier price for billing period
            billing_period: "monthly" or "yearly"
            subscription_ends_at: When current subscription period ends
            credit_balance: Tenant's available credit balance
            from_date: Calculate from this date (default: now)

        Returns:
            ProrationResult with all calculation details
        """
        days_remaining = cls.calculate_days_remaining(subscription_ends_at, from_date)

        # Calculate daily rates
        current_daily = cls.calculate_daily_rate(current_tier_price, billing_period)
        new_daily = cls.calculate_daily_rate(new_tier_price, billing_period)

        # Special case: No existing subscription (free tier or new customer)
        # Charge the full new tier price instead of prorating
        if subscription_ends_at is None or days_remaining == 0:
            proration_credit = 0
            proration_charge = new_tier_price  # Full price for new subscription
            net_amount = new_tier_price
            days_remaining = 30 if billing_period == "monthly" else 365
        else:
            # Calculate proration amounts for mid-cycle changes
            proration_credit = current_daily * days_remaining
            proration_charge = new_daily * days_remaining
            net_amount = proration_charge - proration_credit

        # Apply credit balance (only if there's an amount due)
        credit_to_apply = 0
        amount_due = net_amount

        if net_amount > 0 and credit_balance > 0:
            credit_to_apply = min(credit_balance, net_amount)
            amount_due = net_amount - credit_to_apply
        elif net_amount <= 0:
            amount_due = 0  # No payment needed for downgrades or zero-cost changes

        return ProrationResult(
            days_remaining=days_remaining,
            current_daily_rate=current_daily,
            new_daily_rate=new_daily,
            proration_credit=proration_credit,
            proration_charge=proration_charge,
            net_amount=net_amount,
            credit_balance_available=credit_balance,
            credit_to_apply=credit_to_apply,
            amount_due=max(0, amount_due),
            original_amount=new_tier_price,
        )

    @classmethod
    def is_upgrade(cls, current_tier_price: int, new_tier_price: int) -> bool:
        """
        Determine if this is an upgrade or downgrade.

        An upgrade means the new tier costs more than the current tier.
        """
        return new_tier_price > current_tier_price

    @classmethod
    def calculate_upgrade_proration(
        cls,
        current_tier_price: int,
        new_tier_price: int,
        billing_period: str,
        subscription_ends_at: Optional[datetime],
        credit_balance: int = 0,
    ) -> ProrationResult:
        """
        Calculate proration specifically for an upgrade.

        Upgrades are applied immediately and the tenant pays the
        prorated difference for the remaining days.
        """
        return cls.calculate_proration(
            current_tier_price=current_tier_price,
            new_tier_price=new_tier_price,
            billing_period=billing_period,
            subscription_ends_at=subscription_ends_at,
            credit_balance=credit_balance,
        )

    @classmethod
    def calculate_downgrade_proration(
        cls,
        current_tier_price: int,
        new_tier_price: int,
        billing_period: str,
        subscription_ends_at: Optional[datetime],
    ) -> ProrationResult:
        """
        Calculate proration specifically for a downgrade.

        Downgrades are scheduled for the end of the billing period.
        No payment is required. Credits are optionally generated.
        """
        days_remaining = cls.calculate_days_remaining(subscription_ends_at)

        # Calculate daily rates for reference
        current_daily = cls.calculate_daily_rate(current_tier_price, billing_period)
        new_daily = cls.calculate_daily_rate(new_tier_price, billing_period)

        # For downgrades, credit is the value difference (could be used for future billing)
        # But typically no payment/credit is processed - just scheduled
        proration_credit = (current_daily - new_daily) * days_remaining

        return ProrationResult(
            days_remaining=days_remaining,
            current_daily_rate=current_daily,
            new_daily_rate=new_daily,
            proration_credit=proration_credit,
            proration_charge=0,  # No charge for downgrade
            net_amount=0,
            credit_balance_available=0,
            credit_to_apply=0,
            amount_due=0,  # No payment required
            original_amount=new_tier_price,
        )

    @classmethod
    def format_proration_details(cls, result: ProrationResult) -> dict:
        """
        Format proration result as a dictionary for storage in JSON.
        """
        return {
            "days_remaining": result.days_remaining,
            "current_daily_rate": result.current_daily_rate,
            "new_daily_rate": result.new_daily_rate,
            "proration_credit": result.proration_credit,
            "proration_charge": result.proration_charge,
            "net_amount": result.net_amount,
            "credit_balance_available": result.credit_balance_available,
            "credit_to_apply": result.credit_to_apply,
            "amount_due": result.amount_due,
            "original_amount": result.original_amount,
        }
