"""
Subscription Tier Service
Business logic for tier configuration management
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Tuple
from uuid import UUID
import logging

from app.models.subscription_tier import SubscriptionTier
from app.schemas.subscription_tier import (
    SubscriptionTierCreate,
    SubscriptionTierUpdate,
    SubscriptionTierResponse,
    PublicTierResponse,
)
from app.core.exceptions import NotFoundException, ConflictException

logger = logging.getLogger(__name__)


class SubscriptionTierService:
    """Service for subscription tier management operations"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # CRUD OPERATIONS
    # ========================================================================

    def create_tier(self, data: SubscriptionTierCreate) -> SubscriptionTier:
        """Create a new subscription tier"""
        # Check code uniqueness
        existing = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.code == data.code
        ).first()
        if existing:
            raise ConflictException(f"Tier with code '{data.code}' already exists")

        tier = SubscriptionTier(
            code=data.code,
            display_name=data.display_name,
            description=data.description,
            price_monthly=data.price_monthly,
            price_yearly=data.price_yearly,
            currency=data.currency,
            max_users=data.max_users,
            max_branches=data.max_branches,
            max_storage_gb=data.max_storage_gb,
            features=data.features,
            sort_order=data.sort_order,
            is_public=data.is_public,
            is_recommended=data.is_recommended,
            trial_days=data.trial_days,
        )

        self.db.add(tier)
        self.db.commit()
        self.db.refresh(tier)

        logger.info(f"Created subscription tier: {tier.code}")
        return tier

    def get_tier_by_id(self, tier_id: UUID) -> SubscriptionTier:
        """Get tier by ID"""
        tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.id == tier_id
        ).first()
        if not tier:
            raise NotFoundException(f"Subscription tier with ID {tier_id} not found")
        return tier

    def get_tier_by_code(self, code: str) -> Optional[SubscriptionTier]:
        """Get tier by code (returns None if not found)"""
        return self.db.query(SubscriptionTier).filter(
            SubscriptionTier.code == code,
            SubscriptionTier.is_active == True
        ).first()

    def get_all_tiers(
        self,
        include_inactive: bool = False
    ) -> List[SubscriptionTier]:
        """Get all subscription tiers (for admin)"""
        query = self.db.query(SubscriptionTier)

        if not include_inactive:
            query = query.filter(SubscriptionTier.is_active == True)

        return query.order_by(SubscriptionTier.sort_order).all()

    def get_public_tiers(self) -> List[SubscriptionTier]:
        """Get public tiers for pricing page"""
        return self.db.query(SubscriptionTier).filter(
            SubscriptionTier.is_active == True,
            SubscriptionTier.is_public == True
        ).order_by(SubscriptionTier.sort_order).all()

    def update_tier(
        self,
        tier_id: UUID,
        data: SubscriptionTierUpdate
    ) -> SubscriptionTier:
        """Update subscription tier"""
        tier = self.get_tier_by_id(tier_id)

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(tier, key, value)

        self.db.commit()
        self.db.refresh(tier)

        logger.info(f"Updated subscription tier: {tier.code}")
        return tier

    def delete_tier(self, tier_id: UUID) -> bool:
        """
        Soft delete a subscription tier.
        Note: Cannot delete tiers that are in use by tenants.
        """
        tier = self.get_tier_by_id(tier_id)

        # Check if tier is in use
        from app.models.tenant import Tenant
        in_use_count = self.db.query(func.count(Tenant.id)).filter(
            Tenant.tier == tier.code
        ).scalar() or 0

        if in_use_count > 0:
            raise ConflictException(
                f"Cannot delete tier '{tier.code}': {in_use_count} tenant(s) are using it"
            )

        # Soft delete
        tier.is_active = False

        self.db.commit()

        logger.info(f"Deleted subscription tier: {tier.code}")
        return True

    # ========================================================================
    # UTILITY METHODS
    # ========================================================================

    def get_tier_limits(self, code: str) -> Optional[dict]:
        """Get tier limits as a dictionary (for TenantService compatibility)"""
        tier = self.get_tier_by_code(code)
        if not tier:
            return None
        return tier.to_limits_dict()

    def get_tier_pricing(self, code: str, billing_period: str) -> Optional[int]:
        """Get price for a tier based on billing period"""
        tier = self.get_tier_by_code(code)
        if not tier:
            return None

        if billing_period == "yearly":
            return tier.price_yearly
        return tier.price_monthly

    def reorder_tiers(self, tier_order: List[UUID]) -> List[SubscriptionTier]:
        """Reorder tiers by setting sort_order based on provided list"""
        for index, tier_id in enumerate(tier_order):
            tier = self.get_tier_by_id(tier_id)
            tier.sort_order = index

        self.db.commit()

        return self.get_all_tiers()

    def get_tier_count(self) -> int:
        """Get total number of active tiers"""
        return self.db.query(func.count(SubscriptionTier.id)).filter(
            SubscriptionTier.is_active == True
        ).scalar() or 0

    def ensure_default_tiers_exist(self) -> bool:
        """
        Check if default tiers exist, return True if they do.
        This is used during startup to verify tier seed has run.
        """
        free_tier = self.get_tier_by_code("free")
        return free_tier is not None


# ============================================================================
# DEFAULT TIER CONFIGURATIONS (for seeding)
# ============================================================================

DEFAULT_TIERS = [
    {
        "code": "free",
        "display_name": "Free",
        "description": "Perfect for getting started",
        "price_monthly": 0,
        "price_yearly": 0,
        "currency": "IDR",
        "max_users": 5,
        "max_branches": 1,
        "max_storage_gb": 1,
        "features": [
            "pos.terminal",
            "pos.transactions",
            "inventory.stock",
            "masterdata.items",
            "masterdata.categories",
            "masterdata.units",
            "masterdata.customers",
            "reports.basic",
        ],
        "sort_order": 0,
        "is_public": True,
        "is_recommended": False,
        "trial_days": 0,
    },
    {
        "code": "basic",
        "display_name": "Basic",
        "description": "For small teams",
        "price_monthly": 299000,  # IDR 299,000
        "price_yearly": 2990000,  # IDR 2,990,000 (2 months free)
        "currency": "IDR",
        "max_users": 20,
        "max_branches": 5,
        "max_storage_gb": 10,
        "features": [
            "pos.terminal",
            "pos.transactions",
            "pos.shifts",
            "inventory.stock",
            "inventory.adjustments",
            "masterdata.items",
            "masterdata.categories",
            "masterdata.units",
            "masterdata.warehouses",
            "masterdata.suppliers",
            "masterdata.customers",
            "masterdata.discounts",
            "reports.basic",
            "reports.sales",
            "reports.export",
        ],
        "sort_order": 1,
        "is_public": True,
        "is_recommended": False,
        "trial_days": 14,
    },
    {
        "code": "premium",
        "display_name": "Premium",
        "description": "For growing businesses",
        "price_monthly": 999000,  # IDR 999,000
        "price_yearly": 9990000,  # IDR 9,990,000 (2 months free)
        "currency": "IDR",
        "max_users": 100,
        "max_branches": 20,
        "max_storage_gb": 50,
        "features": [
            "pos.terminal",
            "pos.transactions",
            "pos.shifts",
            "inventory.stock",
            "inventory.adjustments",
            "inventory.transfer",
            "masterdata.items",
            "masterdata.categories",
            "masterdata.units",
            "masterdata.warehouses",
            "masterdata.suppliers",
            "masterdata.customers",
            "masterdata.price_levels",
            "masterdata.discounts",
            "masterdata.discount_groups",
            "masterdata.promotions",
            "purchasing.orders",
            "purchasing.receiving",
            "reports.basic",
            "reports.advanced",
            "reports.sales",
            "reports.export",
            "platform.api_access",
            "platform.audit_advanced",
            "platform.custom_fields",
            "loyalty.points",
            "hr.employees",
        ],
        "sort_order": 2,
        "is_public": True,
        "is_recommended": True,
        "trial_days": 14,
    },
    {
        "code": "enterprise",
        "display_name": "Enterprise",
        "description": "For large organizations",
        "price_monthly": 2999000,  # IDR 2,999,000
        "price_yearly": 29990000,  # IDR 29,990,000 (2 months free)
        "currency": "IDR",
        "max_users": -1,  # Unlimited
        "max_branches": -1,  # Unlimited
        "max_storage_gb": 200,
        "features": [
            "pos.terminal",
            "pos.transactions",
            "pos.shifts",
            "inventory.stock",
            "inventory.adjustments",
            "inventory.transfer",
            "masterdata.items",
            "masterdata.categories",
            "masterdata.units",
            "masterdata.warehouses",
            "masterdata.suppliers",
            "masterdata.customers",
            "masterdata.price_levels",
            "masterdata.discounts",
            "masterdata.discount_groups",
            "masterdata.promotions",
            "purchasing.orders",
            "purchasing.receiving",
            "reports.basic",
            "reports.advanced",
            "reports.sales",
            "reports.export",
            "platform.api_access",
            "platform.integrations",
            "platform.audit_advanced",
            "platform.multi_currency",
            "platform.custom_fields",
            "platform.workflow",
            "loyalty.points",
            "hr.employees",
        ],
        "sort_order": 3,
        "is_public": True,
        "is_recommended": False,
        "trial_days": 30,
    },
]
