"""
Coupon and Discount models for promotional pricing.
Supports percentage discounts, fixed amounts, and trial extensions.
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, ARRAY, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.core.database import Base
from app.models.base import BaseModel


class DiscountType:
    """Discount type constants"""
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    TRIAL_EXTENSION = "trial_extension"


class Coupon(Base, BaseModel):
    """
    Coupon/discount code for promotional pricing.

    Supports:
    - Percentage discounts (e.g., 20% off)
    - Fixed amount discounts (e.g., $50 off)
    - Trial extensions (e.g., 30 extra days)
    """
    __tablename__ = "coupons"

    # Unique coupon code (e.g., "SAVE20", "WELCOME50")
    code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique coupon code"
    )

    # Display name for admin UI
    name = Column(
        String(100),
        nullable=False,
        comment="Coupon display name"
    )

    # Description for users
    description = Column(
        String(500),
        nullable=True,
        comment="Coupon description"
    )

    # Discount type and value
    discount_type = Column(
        String(20),
        nullable=False,
        comment="Type: percentage, fixed_amount, trial_extension"
    )

    discount_value = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Discount value (percentage, amount, or days)"
    )

    currency = Column(
        String(3),
        nullable=False,
        default="IDR",
        comment="Currency for fixed_amount discounts"
    )

    # Redemption limits
    max_redemptions = Column(
        Integer,
        nullable=True,
        comment="Maximum total redemptions (null = unlimited)"
    )

    current_redemptions = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Current redemption count"
    )

    max_redemptions_per_tenant = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Max redemptions per tenant"
    )

    # Tier restrictions
    valid_for_tiers = Column(
        ARRAY(String),
        nullable=True,
        comment="Tier codes this coupon applies to (null = all tiers)"
    )

    # Billing period restrictions
    valid_for_billing_periods = Column(
        ARRAY(String),
        nullable=True,
        comment="Billing periods: monthly, yearly (null = all)"
    )

    # Validity period
    valid_from = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Start of validity period (null = immediate)"
    )

    valid_until = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="End of validity period (null = no expiry)"
    )

    # Usage restrictions
    first_time_only = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Only valid for first subscription"
    )

    new_customers_only = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Only valid for new tenants"
    )

    # Duration of discount
    duration_months = Column(
        Integer,
        nullable=True,
        comment="Months the discount applies (null = one-time)"
    )

    # Minimum purchase requirement
    minimum_amount = Column(
        Integer,
        nullable=True,
        comment="Minimum purchase amount required"
    )

    # Relationships
    redemptions = relationship("CouponRedemption", back_populates="coupon", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Coupon {self.code} ({self.discount_type}: {self.discount_value})>"

    @property
    def is_valid(self) -> bool:
        """Check if coupon is currently valid"""
        if not self.is_active:
            return False

        now = datetime.now(timezone.utc)

        if self.valid_from and now < self.valid_from:
            return False

        if self.valid_until and now > self.valid_until:
            return False

        if self.max_redemptions and self.current_redemptions >= self.max_redemptions:
            return False

        return True

    @property
    def is_expired(self) -> bool:
        """Check if coupon has expired"""
        if self.valid_until:
            return datetime.now(timezone.utc) > self.valid_until
        return False

    @property
    def is_maxed_out(self) -> bool:
        """Check if max redemptions reached"""
        if self.max_redemptions:
            return self.current_redemptions >= self.max_redemptions
        return False

    @property
    def remaining_redemptions(self) -> int | None:
        """Get remaining redemptions (None if unlimited)"""
        if self.max_redemptions:
            return max(0, self.max_redemptions - self.current_redemptions)
        return None

    def is_valid_for_tier(self, tier_code: str) -> bool:
        """Check if coupon is valid for a specific tier"""
        if not self.valid_for_tiers:
            return True
        return tier_code in self.valid_for_tiers

    def is_valid_for_billing_period(self, billing_period: str) -> bool:
        """Check if coupon is valid for a specific billing period"""
        if not self.valid_for_billing_periods:
            return True
        return billing_period in self.valid_for_billing_periods

    def increment_redemption(self) -> None:
        """Increment redemption count"""
        self.current_redemptions += 1


class CouponRedemption(Base, BaseModel):
    """
    Record of coupon redemption by a tenant.

    Tracks which coupons have been used and when they expire.
    """
    __tablename__ = "coupon_redemptions"

    coupon_id = Column(
        UUID(as_uuid=True),
        ForeignKey("coupons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Redeemed coupon"
    )

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant that redeemed the coupon"
    )

    upgrade_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("upgrade_requests.id", ondelete="SET NULL"),
        nullable=True,
        comment="Associated upgrade request"
    )

    # Discount details at time of redemption
    discount_type = Column(
        String(20),
        nullable=False,
        comment="Discount type at redemption"
    )

    discount_value = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Discount value at redemption"
    )

    discount_applied = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Actual discount amount applied"
    )

    # For recurring discounts
    applied_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="When coupon was applied"
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When discount expires (for duration-based coupons)"
    )

    is_expired = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether this redemption has expired"
    )

    # Relationships
    coupon = relationship("Coupon", back_populates="redemptions")
    tenant = relationship("Tenant", backref="coupon_redemptions")
    upgrade_request = relationship("UpgradeRequest", backref="coupon_redemption")

    def __repr__(self):
        return f"<CouponRedemption {self.coupon_id} -> {self.tenant_id}>"

    @property
    def is_active(self) -> bool:
        """Check if this redemption is still active"""
        if self.is_expired:
            return False
        if self.expires_at:
            return datetime.now(timezone.utc) < self.expires_at
        return True

    def mark_expired(self) -> None:
        """Mark this redemption as expired"""
        self.is_expired = True
