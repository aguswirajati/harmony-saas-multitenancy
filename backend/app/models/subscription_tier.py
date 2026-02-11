"""
SubscriptionTier model for database-driven tier configuration.
Replaces hardcoded TIER_CONFIGS with editable tiers via admin UI.
"""
from sqlalchemy import Column, String, Integer, Boolean, Text, JSON
from app.core.database import Base
from app.models.base import BaseModel


class SubscriptionTier(Base, BaseModel):
    """
    Subscription tier configuration model.

    Stores tier definitions that can be managed via admin UI:
    - Pricing (monthly/yearly)
    - Resource limits (users, branches, storage)
    - Feature flags
    - Display settings (order, visibility, recommended)
    """
    __tablename__ = "subscription_tiers"

    # Unique identifier (e.g., "free", "basic", "premium")
    code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique tier code (e.g., 'free', 'basic')"
    )

    # Display info
    display_name = Column(
        String(100),
        nullable=False,
        comment="Display name (e.g., 'Free Plan', 'Basic Plan')"
    )
    description = Column(
        Text,
        nullable=True,
        comment="Tier description for marketing/pricing page"
    )

    # Pricing (IDR as default for Indonesian market)
    price_monthly = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Monthly price in smallest currency unit"
    )
    price_yearly = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Yearly price in smallest currency unit (typically discounted)"
    )
    currency = Column(
        String(3),
        default="IDR",
        nullable=False,
        comment="ISO 4217 currency code"
    )

    # Resource limits (-1 = unlimited)
    max_users = Column(
        Integer,
        default=5,
        nullable=False,
        comment="Maximum users allowed (-1 for unlimited)"
    )
    max_branches = Column(
        Integer,
        default=1,
        nullable=False,
        comment="Maximum branches allowed (-1 for unlimited)"
    )
    max_storage_gb = Column(
        Integer,
        default=1,
        nullable=False,
        comment="Maximum storage in GB (-1 for unlimited)"
    )

    # Feature flags (list of enabled features for this tier)
    features = Column(
        JSON,
        default=list,
        nullable=False,
        comment="List of feature flags enabled for this tier"
    )

    # Display settings
    sort_order = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order in pricing pages (lower = first)"
    )
    is_public = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether tier is visible on public pricing page"
    )
    is_recommended = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether to highlight this tier as recommended"
    )

    # Trial settings
    trial_days = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of trial days for this tier (0 = no trial)"
    )

    def __repr__(self):
        return f"<SubscriptionTier {self.code} ({self.display_name})>"

    @property
    def is_free(self) -> bool:
        """Check if this is a free tier"""
        return self.price_monthly == 0 and self.price_yearly == 0

    @property
    def has_unlimited_users(self) -> bool:
        """Check if tier has unlimited users"""
        return self.max_users == -1

    @property
    def has_unlimited_branches(self) -> bool:
        """Check if tier has unlimited branches"""
        return self.max_branches == -1

    @property
    def has_unlimited_storage(self) -> bool:
        """Check if tier has unlimited storage"""
        return self.max_storage_gb == -1

    def to_limits_dict(self) -> dict:
        """Return limits as a dictionary (for TenantService compatibility)"""
        return {
            "max_users": self.max_users,
            "max_branches": self.max_branches,
            "max_storage_gb": self.max_storage_gb,
        }
