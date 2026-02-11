"""
Subscription Tier Schemas
Request/response models for tier configuration management
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class SubscriptionTierCreate(BaseModel):
    """Schema for creating a new subscription tier"""
    code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        pattern="^[a-z0-9_-]+$",
        description="Unique tier code (lowercase alphanumeric)"
    )
    display_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Display name for the tier"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Tier description"
    )

    # Pricing
    price_monthly: int = Field(
        default=0,
        ge=0,
        description="Monthly price in smallest currency unit"
    )
    price_yearly: int = Field(
        default=0,
        ge=0,
        description="Yearly price in smallest currency unit"
    )
    currency: str = Field(
        default="IDR",
        min_length=3,
        max_length=3,
        description="ISO 4217 currency code"
    )

    # Limits
    max_users: int = Field(
        default=5,
        ge=-1,
        description="Maximum users (-1 for unlimited)"
    )
    max_branches: int = Field(
        default=1,
        ge=-1,
        description="Maximum branches (-1 for unlimited)"
    )
    max_storage_gb: int = Field(
        default=1,
        ge=-1,
        description="Maximum storage in GB (-1 for unlimited)"
    )

    # Features
    features: List[str] = Field(
        default_factory=list,
        description="List of feature flags enabled for this tier"
    )

    # Display settings
    sort_order: int = Field(
        default=0,
        ge=0,
        description="Display order (lower = first)"
    )
    is_public: bool = Field(
        default=True,
        description="Whether tier is visible on public pricing page"
    )
    is_recommended: bool = Field(
        default=False,
        description="Whether to highlight as recommended"
    )
    trial_days: int = Field(
        default=0,
        ge=0,
        description="Trial days for this tier"
    )

    @field_validator('code')
    @classmethod
    def code_lowercase(cls, v: str) -> str:
        return v.lower()

    @field_validator('currency')
    @classmethod
    def currency_uppercase(cls, v: str) -> str:
        return v.upper()


class SubscriptionTierUpdate(BaseModel):
    """Schema for updating a subscription tier (partial update)"""
    display_name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100
    )
    description: Optional[str] = Field(None, max_length=1000)

    # Pricing
    price_monthly: Optional[int] = Field(None, ge=0)
    price_yearly: Optional[int] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)

    # Limits
    max_users: Optional[int] = Field(None, ge=-1)
    max_branches: Optional[int] = Field(None, ge=-1)
    max_storage_gb: Optional[int] = Field(None, ge=-1)

    # Features
    features: Optional[List[str]] = None

    # Display settings
    sort_order: Optional[int] = Field(None, ge=0)
    is_public: Optional[bool] = None
    is_recommended: Optional[bool] = None
    trial_days: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None

    @field_validator('currency')
    @classmethod
    def currency_uppercase(cls, v: Optional[str]) -> Optional[str]:
        return v.upper() if v else v


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class SubscriptionTierResponse(BaseModel):
    """Complete subscription tier response"""
    id: UUID
    code: str
    display_name: str
    description: Optional[str]

    # Pricing
    price_monthly: int
    price_yearly: int
    currency: str

    # Limits
    max_users: int
    max_branches: int
    max_storage_gb: int

    # Features
    features: List[Any]

    # Display settings
    sort_order: int
    is_public: bool
    is_recommended: bool
    trial_days: int

    # Status
    is_active: bool

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class SubscriptionTierSummary(BaseModel):
    """Subscription tier summary for list views"""
    id: UUID
    code: str
    display_name: str
    price_monthly: int
    price_yearly: int
    currency: str
    max_users: int
    max_branches: int
    max_storage_gb: int
    sort_order: int
    is_public: bool
    is_recommended: bool
    is_active: bool

    class Config:
        from_attributes = True


class SubscriptionTierListResponse(BaseModel):
    """Paginated list of subscription tiers"""
    items: List[SubscriptionTierResponse]
    total: int


class PublicTierResponse(BaseModel):
    """Public tier information for pricing pages"""
    code: str
    display_name: str
    description: Optional[str]

    # Pricing
    price_monthly: int
    price_yearly: int
    currency: str

    # Limits (display formatted)
    max_users: int
    max_branches: int
    max_storage_gb: int
    max_users_display: str  # "5 users" or "Unlimited"
    max_branches_display: str
    max_storage_display: str

    # Features
    features: List[str]

    # Display settings
    sort_order: int
    is_recommended: bool
    trial_days: int

    class Config:
        from_attributes = True

    @classmethod
    def from_tier(cls, tier) -> "PublicTierResponse":
        """Create PublicTierResponse from SubscriptionTier model"""
        return cls(
            code=tier.code,
            display_name=tier.display_name,
            description=tier.description,
            price_monthly=tier.price_monthly,
            price_yearly=tier.price_yearly,
            currency=tier.currency,
            max_users=tier.max_users,
            max_branches=tier.max_branches,
            max_storage_gb=tier.max_storage_gb,
            max_users_display=cls._format_limit(tier.max_users, "user"),
            max_branches_display=cls._format_limit(tier.max_branches, "branch"),
            max_storage_display=cls._format_storage(tier.max_storage_gb),
            features=tier.features or [],
            sort_order=tier.sort_order,
            is_recommended=tier.is_recommended,
            trial_days=tier.trial_days,
        )

    @staticmethod
    def _format_limit(value: int, unit: str) -> str:
        """Format limit value for display"""
        if value == -1:
            return "Unlimited"
        plural = "s" if value != 1 else ""
        return f"{value} {unit}{plural}"

    @staticmethod
    def _format_storage(value: int) -> str:
        """Format storage value for display"""
        if value == -1:
            return "Unlimited"
        return f"{value} GB"


class PublicTierListResponse(BaseModel):
    """List of public tiers for pricing page"""
    tiers: List[PublicTierResponse]
