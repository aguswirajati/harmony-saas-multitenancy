"""
Feature Schemas

Pydantic models for feature flag API requests and responses.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class FeatureMetadataResponse(BaseModel):
    """Single feature metadata"""
    code: str
    name: str
    description: str
    module: str


class FeatureStatusResponse(BaseModel):
    """Feature with status for a tenant"""
    code: str
    name: str
    description: str
    module: str
    enabled: bool
    source: str = Field(description="Where the setting comes from: tier, enabled_override, disabled_override")


class TenantFeaturesResponse(BaseModel):
    """List of tenant's enabled features"""
    features: List[str]
    tier: str
    overrides: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Tenant-specific overrides: {enabled: [...], disabled: [...]}"
    )


class FeatureCheckResponse(BaseModel):
    """Response for feature check"""
    code: str
    enabled: bool


class AllFeaturesResponse(BaseModel):
    """All available features grouped by module"""
    modules: Dict[str, List[FeatureMetadataResponse]]
    total_count: int


class TierFeaturesUpdate(BaseModel):
    """Update features for a tier"""
    features: List[str] = Field(description="List of feature codes to enable for this tier")


class TierFeatureMatrix(BaseModel):
    """Feature availability matrix across tiers"""
    tiers: List[str]
    features: List[str]
    matrix: Dict[str, Dict[str, bool]] = Field(
        description="tier_code -> {feature_code: enabled, ...}"
    )


class TenantFeatureOverride(BaseModel):
    """Enable/disable a feature for a tenant"""
    feature_code: str
    action: str = Field(description="'enable' or 'disable'")
