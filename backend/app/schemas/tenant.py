"""
Tenant Schemas for Phase 6A - Tenant Management
Comprehensive request/response models for tenant operations
"""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from uuid import UUID


# ============================================================================
# FORMAT SETTINGS (Regional Preferences)
# ============================================================================

class FormatSettings(BaseModel):
    """Tenant-level format settings for currency, numbers, and dates"""
    currency_code: str = Field(default="IDR", description="ISO currency code")
    currency_symbol_position: Literal["before", "after"] = Field(
        default="before",
        description="Currency symbol position (Rp 1.000 vs 1.000 Rp)"
    )
    decimal_separator: str = Field(default=",", description="Decimal separator")
    thousands_separator: str = Field(default=".", description="Thousands separator")
    price_decimal_places: int = Field(default=0, ge=0, le=4, description="Decimal places for prices")
    quantity_decimal_places: int = Field(default=0, ge=0, le=4, description="Decimal places for quantities")
    date_format: str = Field(default="DD/MM/YYYY", description="Date display format")
    timezone: str = Field(default="Asia/Jakarta", description="Tenant timezone")

    class Config:
        json_schema_extra = {
            "example": {
                "currency_code": "IDR",
                "currency_symbol_position": "before",
                "decimal_separator": ",",
                "thousands_separator": ".",
                "price_decimal_places": 0,
                "quantity_decimal_places": 0,
                "date_format": "DD/MM/YYYY",
                "timezone": "Asia/Jakarta"
            }
        }


# ============================================================================
# BASE SCHEMAS
# ============================================================================

class TenantBase(BaseModel):
    """Base tenant schema with common fields"""
    name: str = Field(..., min_length=2, max_length=255, description="Organization name")
    subdomain: str = Field(..., min_length=3, max_length=100, pattern="^[a-z0-9-]+$", 
                          description="Unique subdomain (lowercase, alphanumeric, hyphens)")
    domain: Optional[str] = Field(None, max_length=255, description="Custom domain (optional)")
    logo_url: Optional[str] = Field(None, description="Logo URL")


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class TenantCreate(TenantBase):
    """Schema for creating new tenant (Super Admin only)"""
    tier: str = Field(default="free", description="Subscription tier")
    max_users: int = Field(default=5, ge=-1, description="Maximum users allowed (-1 for unlimited)")
    max_branches: int = Field(default=1, ge=-1, description="Maximum branches allowed (-1 for unlimited)")
    max_storage_gb: int = Field(default=1, ge=-1, description="Storage limit in GB (-1 for unlimited)")
    
    # Admin user for the tenant
    admin_email: EmailStr = Field(..., description="Admin user email")
    admin_password: str = Field(..., min_length=8, description="Admin password")
    admin_first_name: str = Field(..., min_length=2, description="Admin first name")
    admin_last_name: str = Field(..., min_length=2, description="Admin last name")

    @validator('subdomain')
    def subdomain_lowercase(cls, v):
        if v:
            return v.lower()
        return v

    @validator('tier')
    def valid_tier(cls, v):
        allowed = ['free', 'basic', 'premium', 'enterprise']
        if v not in allowed:
            raise ValueError(f'Tier must be one of: {", ".join(allowed)}')
        return v


class TenantUpdate(BaseModel):
    """Schema for updating tenant (partial update allowed)"""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    meta_data: Optional[Dict[str, Any]] = None


class TenantSubscriptionUpdate(BaseModel):
    """Schema for updating subscription (Super Admin only)"""
    tier: str = Field(..., description="Subscription tier")
    subscription_status: Optional[str] = Field(None, description="Subscription status")
    max_users: Optional[int] = Field(None, ge=-1, description="Maximum users (-1 for unlimited)")
    max_branches: Optional[int] = Field(None, ge=-1, description="Maximum branches (-1 for unlimited)")
    max_storage_gb: Optional[int] = Field(None, ge=-1, description="Storage limit in GB (-1 for unlimited)")
    trial_ends_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None

    @validator('tier')
    def valid_tier(cls, v):
        allowed = ['free', 'basic', 'premium', 'enterprise']
        if v not in allowed:
            raise ValueError(f'Tier must be one of: {", ".join(allowed)}')
        return v

    @validator('subscription_status')
    def valid_status(cls, v):
        if v is None:
            return v
        allowed = ['active', 'trial', 'expired', 'cancelled', 'suspended']
        if v not in allowed:
            raise ValueError(f'Status must be one of: {", ".join(allowed)}')
        return v


class TenantFeatureUpdate(BaseModel):
    """Schema for updating tenant features (feature flags)"""
    features: Dict[str, bool] = Field(..., description="Feature flags")
    
    class Config:
        json_schema_extra = {
            "example": {
                "features": {
                    "inventory_module": True,
                    "sales_module": False,
                    "pos_module": True,
                    "analytics": True,
                    "api_access": False
                }
            }
        }


class TenantStatusUpdate(BaseModel):
    """Schema for activating/deactivating tenant"""
    is_active: bool = Field(..., description="Active status")
    reason: Optional[str] = Field(None, description="Reason for status change")


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class TenantResponse(TenantBase):
    """Complete tenant response with all fields"""
    id: UUID
    tier: str
    subscription_status: str
    max_users: int
    max_branches: int
    max_storage_gb: int
    features: Dict[str, Any]
    settings: Dict[str, Any]
    meta_data: Dict[str, Any]
    trial_ends_at: Optional[datetime]
    subscription_ends_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    # Usage stats (computed)
    user_count: int = 0
    branch_count: int = 0

    class Config:
        from_attributes = True


class TenantSummary(BaseModel):
    """Tenant summary for list views"""
    id: UUID
    name: str
    subdomain: str
    tier: str
    subscription_status: str
    is_active: bool
    created_at: datetime
    
    # Usage stats
    user_count: int = 0
    branch_count: int = 0
    
    class Config:
        from_attributes = True


class TenantStats(BaseModel):
    """Detailed tenant statistics"""
    id: UUID
    name: str
    subdomain: str
    tier: str
    subscription_status: str
    
    # Limits
    max_users: int
    max_branches: int
    max_storage_gb: int
    
    # Current usage
    user_count: int = 0
    branch_count: int = 0
    storage_used_gb: float = 0.0
    
    # Usage percentages
    users_usage_percent: float = 0.0
    branches_usage_percent: float = 0.0
    storage_usage_percent: float = 0.0
    
    # Status flags
    is_active: bool
    is_trial: bool = False
    is_expired: bool = False
    days_until_expiry: Optional[int] = None
    
    created_at: datetime
    last_activity_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    """Paginated list of tenants"""
    items: List[TenantSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# SYSTEM STATS (SUPER ADMIN DASHBOARD)
# ============================================================================

class SystemStats(BaseModel):
    """Overall system statistics for Super Admin dashboard"""
    total_tenants: int = 0
    active_tenants: int = 0
    inactive_tenants: int = 0
    trial_tenants: int = 0

    # By tier (individual counts for backwards compatibility)
    free_tier_count: int = 0
    basic_tier_count: int = 0
    premium_tier_count: int = 0
    enterprise_tier_count: int = 0

    # By tier and status (dictionaries for frontend)
    tenants_by_tier: Dict[str, int] = {}
    tenants_by_status: Dict[str, int] = {}

    # Users & Branches
    total_users: int = 0
    total_branches: int = 0

    # Recent activity
    tenants_created_today: int = 0
    tenants_created_this_week: int = 0
    tenants_created_this_month: int = 0

    # Expiring soon
    trials_expiring_soon: int = 0
    subscriptions_expiring_soon: int = 0


# ============================================================================
# TENANT SETTINGS (SELF-SERVICE)
# ============================================================================

class TenantSettingsUpdate(BaseModel):
    """Tenant can update their own settings (non-subscription)"""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    logo_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = Field(None, description="Custom settings")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "ACME Corporation",
                "logo_url": "https://example.com/logo.png",
                "settings": {
                    "timezone": "Asia/Jakarta",
                    "language": "id",
                    "date_format": "DD/MM/YYYY",
                    "currency": "IDR"
                }
            }
        }


class TenantUsageResponse(BaseModel):
    """Current usage vs limits for tenant dashboard"""
    tenant_id: UUID
    tenant_name: str
    tier: str
    
    # Users
    users_current: int
    users_limit: int
    users_available: int
    users_percent: float
    
    # Branches
    branches_current: int
    branches_limit: int
    branches_available: int
    branches_percent: float
    
    # Storage
    storage_used_gb: float
    storage_limit_gb: int
    storage_available_gb: float
    storage_percent: float
    
    # Warnings
    is_user_limit_reached: bool = False
    is_branch_limit_reached: bool = False
    is_storage_limit_reached: bool = False
    
    # Upgrade info
    can_upgrade: bool = True
    next_tier: Optional[str] = None


# ============================================================================
# TIER INFORMATION
# ============================================================================

class TierInfo(BaseModel):
    """Information about subscription tiers"""
    tier: str
    display_name: str
    price_monthly: float
    price_yearly: float
    max_users: int
    max_branches: int
    max_storage_gb: int
    features: List[str]
    is_recommended: bool = False


class AvailableTiers(BaseModel):
    """List of all available subscription tiers"""
    tiers: List[TierInfo]
    current_tier: str
