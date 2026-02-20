"""
Feature Service

Business logic for feature flag management and checking.
"""
from sqlalchemy.orm import Session
from typing import Set, List, Dict, Optional
import logging

from app.models.tenant import Tenant
from app.models.subscription_tier import SubscriptionTier
from app.core.features import (
    TIER_DEFAULT_FEATURES,
    FEATURE_REGISTRY,
    FeatureMetadata,
    FeatureModule,
    get_feature_metadata,
    get_features_by_module,
    get_all_feature_codes,
)

logger = logging.getLogger(__name__)


class FeatureService:
    """Service for feature flag operations"""

    @staticmethod
    def get_tier_features(db: Session, tier_code: str) -> Set[str]:
        """
        Get features for a tier from database or defaults.

        Priority:
        1. Database tier.features if populated
        2. TIER_DEFAULT_FEATURES from code
        """
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.code == tier_code,
            SubscriptionTier.is_active == True
        ).first()

        if tier and tier.features:
            # If tier has features defined in DB, use those
            if isinstance(tier.features, list) and len(tier.features) > 0:
                # Check if these are actual feature codes (contain dots)
                # vs marketing strings
                if any("." in str(f) for f in tier.features):
                    return set(tier.features)

        # Fall back to defaults
        return TIER_DEFAULT_FEATURES.get(tier_code, set())

    @staticmethod
    def get_tenant_features(db: Session, tenant: Tenant) -> Set[str]:
        """
        Get all enabled features for a tenant.

        Combines:
        1. Tier-based features
        2. Tenant-specific overrides (addons/removed)
        """
        # Get tier features
        tier_features = FeatureService.get_tier_features(db, tenant.tier)

        # Get tenant-specific overrides
        tenant_overrides = tenant.features or {}

        # Apply overrides
        result = set(tier_features)

        # Add any explicitly enabled features
        enabled = tenant_overrides.get("enabled", [])
        if isinstance(enabled, list):
            result.update(enabled)

        # Remove any explicitly disabled features
        disabled = tenant_overrides.get("disabled", [])
        if isinstance(disabled, list):
            result.difference_update(disabled)

        return result

    @staticmethod
    def has_feature(db: Session, tenant: Tenant, feature_code: str) -> bool:
        """Check if tenant has access to a specific feature"""
        features = FeatureService.get_tenant_features(db, tenant)
        return feature_code in features

    @staticmethod
    def has_any_feature(db: Session, tenant: Tenant, feature_codes: List[str]) -> bool:
        """Check if tenant has access to any of the specified features"""
        features = FeatureService.get_tenant_features(db, tenant)
        return any(code in features for code in feature_codes)

    @staticmethod
    def has_all_features(db: Session, tenant: Tenant, feature_codes: List[str]) -> bool:
        """Check if tenant has access to all specified features"""
        features = FeatureService.get_tenant_features(db, tenant)
        return all(code in features for code in feature_codes)

    @staticmethod
    def enable_feature(db: Session, tenant: Tenant, feature_code: str) -> None:
        """
        Enable a feature for a tenant (override tier).

        This is for adding features beyond what the tier provides.
        """
        if not tenant.features:
            tenant.features = {}

        enabled = tenant.features.get("enabled", [])
        if feature_code not in enabled:
            enabled.append(feature_code)
            tenant.features["enabled"] = enabled

        # Remove from disabled if present
        disabled = tenant.features.get("disabled", [])
        if feature_code in disabled:
            disabled.remove(feature_code)
            tenant.features["disabled"] = disabled

        db.commit()
        logger.info(f"Enabled feature '{feature_code}' for tenant {tenant.id}")

    @staticmethod
    def disable_feature(db: Session, tenant: Tenant, feature_code: str) -> None:
        """
        Disable a feature for a tenant (override tier).

        This is for removing features that the tier would normally provide.
        """
        if not tenant.features:
            tenant.features = {}

        disabled = tenant.features.get("disabled", [])
        if feature_code not in disabled:
            disabled.append(feature_code)
            tenant.features["disabled"] = disabled

        # Remove from enabled if present
        enabled = tenant.features.get("enabled", [])
        if feature_code in enabled:
            enabled.remove(feature_code)
            tenant.features["enabled"] = enabled

        db.commit()
        logger.info(f"Disabled feature '{feature_code}' for tenant {tenant.id}")

    @staticmethod
    def reset_tenant_overrides(db: Session, tenant: Tenant) -> None:
        """Reset tenant to tier-default features (remove all overrides)"""
        tenant.features = {}
        db.commit()
        logger.info(f"Reset feature overrides for tenant {tenant.id}")

    @staticmethod
    def get_features_with_status(
        db: Session,
        tenant: Tenant
    ) -> List[Dict]:
        """
        Get all features with their status for a tenant.

        Returns list of {code, name, description, module, enabled, source}
        where source is 'tier', 'enabled_override', or 'disabled_override'
        """
        tier_features = FeatureService.get_tier_features(db, tenant.tier)
        tenant_overrides = tenant.features or {}
        enabled_overrides = set(tenant_overrides.get("enabled", []))
        disabled_overrides = set(tenant_overrides.get("disabled", []))

        result = []
        for code in get_all_feature_codes():
            meta = get_feature_metadata(code)
            if not meta:
                continue

            # Determine if enabled and source
            if code in disabled_overrides:
                enabled = False
                source = "disabled_override"
            elif code in enabled_overrides:
                enabled = True
                source = "enabled_override"
            elif code in tier_features:
                enabled = True
                source = "tier"
            else:
                enabled = False
                source = "tier"

            result.append({
                "code": code,
                "name": meta.name,
                "description": meta.description,
                "module": meta.module.value,
                "enabled": enabled,
                "source": source,
            })

        return result

    @staticmethod
    def get_tier_feature_matrix(db: Session) -> Dict[str, Dict[str, bool]]:
        """
        Get feature availability matrix across all tiers.

        Returns {tier_code: {feature_code: bool, ...}, ...}
        """
        from app.services.subscription_tier_service import SubscriptionTierService

        tier_service = SubscriptionTierService(db)
        tiers = tier_service.get_all_tiers()

        matrix = {}
        for tier in tiers:
            tier_features = FeatureService.get_tier_features(db, tier.code)
            matrix[tier.code] = {
                code: code in tier_features
                for code in get_all_feature_codes()
            }

        return matrix

    @staticmethod
    def update_tier_features(
        db: Session,
        tier_code: str,
        features: List[str]
    ) -> SubscriptionTier:
        """
        Update the features list for a subscription tier.
        """
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.code == tier_code,
            SubscriptionTier.is_active == True
        ).first()

        if not tier:
            raise ValueError(f"Tier '{tier_code}' not found")

        # Validate feature codes
        valid_codes = set(get_all_feature_codes())
        invalid = [f for f in features if f not in valid_codes]
        if invalid:
            raise ValueError(f"Invalid feature codes: {invalid}")

        tier.features = features
        db.commit()
        db.refresh(tier)

        logger.info(f"Updated features for tier '{tier_code}': {len(features)} features")
        return tier
