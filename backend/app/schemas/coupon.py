"""
Pydantic schemas for Coupon and Discount system.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class DiscountTypeEnum:
    """Discount type constants"""
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    TRIAL_EXTENSION = "trial_extension"


# ============== Coupon Schemas ==============

class CouponBase(BaseModel):
    """Base coupon fields"""
    code: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    discount_type: str = Field(..., description="percentage, fixed_amount, or trial_extension")
    discount_value: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=3)
    max_redemptions: Optional[int] = Field(None, ge=1)
    max_redemptions_per_tenant: int = Field(default=1, ge=1)
    valid_for_tiers: Optional[List[str]] = None
    valid_for_billing_periods: Optional[List[str]] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    first_time_only: bool = False
    new_customers_only: bool = False
    duration_months: Optional[int] = Field(None, ge=1)
    minimum_amount: Optional[int] = Field(None, ge=0)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Normalize coupon code to uppercase"""
        return v.upper().strip()

    @field_validator("discount_type")
    @classmethod
    def validate_discount_type(cls, v: str) -> str:
        """Validate discount type"""
        valid_types = [
            DiscountTypeEnum.PERCENTAGE,
            DiscountTypeEnum.FIXED_AMOUNT,
            DiscountTypeEnum.TRIAL_EXTENSION
        ]
        if v not in valid_types:
            raise ValueError(f"discount_type must be one of: {', '.join(valid_types)}")
        return v

    @field_validator("discount_value")
    @classmethod
    def validate_discount_value(cls, v: Decimal, info) -> Decimal:
        """Validate discount value based on type"""
        # Note: Can't access discount_type here in field_validator
        # Full validation done in model_validator if needed
        if v <= 0:
            raise ValueError("discount_value must be positive")
        return v


class CouponCreate(CouponBase):
    """Schema for creating a coupon"""
    pass


class CouponUpdate(BaseModel):
    """Schema for updating a coupon"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    max_redemptions: Optional[int] = Field(None, ge=1)
    max_redemptions_per_tenant: Optional[int] = Field(None, ge=1)
    valid_for_tiers: Optional[List[str]] = None
    valid_for_billing_periods: Optional[List[str]] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    first_time_only: Optional[bool] = None
    new_customers_only: Optional[bool] = None
    duration_months: Optional[int] = Field(None, ge=1)
    minimum_amount: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class CouponResponse(BaseModel):
    """Coupon response schema"""
    id: UUID
    code: str
    name: str
    description: Optional[str]
    discount_type: str
    discount_value: Decimal
    currency: str
    max_redemptions: Optional[int]
    current_redemptions: int
    max_redemptions_per_tenant: int
    valid_for_tiers: Optional[List[str]]
    valid_for_billing_periods: Optional[List[str]]
    valid_from: Optional[datetime]
    valid_until: Optional[datetime]
    first_time_only: bool
    new_customers_only: bool
    duration_months: Optional[int]
    minimum_amount: Optional[int]
    is_active: bool
    is_valid: bool
    is_expired: bool
    is_maxed_out: bool
    remaining_redemptions: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class CouponListResponse(BaseModel):
    """Paginated coupon list"""
    items: List[CouponResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ============== Coupon Validation Schemas ==============

class CouponValidateRequest(BaseModel):
    """Request to validate a coupon code"""
    code: str = Field(..., min_length=3, max_length=50)
    tier_code: Optional[str] = None
    billing_period: Optional[str] = None
    amount: Optional[int] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.upper().strip()


class CouponValidateResponse(BaseModel):
    """Response from coupon validation"""
    valid: bool
    coupon: Optional[CouponResponse] = None
    discount_amount: Optional[int] = None
    discount_description: Optional[str] = None
    error_message: Optional[str] = None


# ============== Coupon Redemption Schemas ==============

class CouponRedemptionCreate(BaseModel):
    """Schema for redeeming a coupon"""
    coupon_id: UUID
    upgrade_request_id: Optional[UUID] = None


class CouponRedemptionResponse(BaseModel):
    """Coupon redemption response"""
    id: UUID
    coupon_id: UUID
    tenant_id: UUID
    upgrade_request_id: Optional[UUID]
    discount_type: str
    discount_value: Decimal
    discount_applied: int
    applied_at: datetime
    expires_at: Optional[datetime]
    is_expired: bool
    coupon_code: Optional[str] = None
    coupon_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CouponRedemptionListResponse(BaseModel):
    """Paginated redemption list"""
    items: List[CouponRedemptionResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ============== Apply Coupon Schemas ==============

class ApplyCouponRequest(BaseModel):
    """Request to apply coupon to an upgrade request"""
    code: str = Field(..., min_length=3, max_length=50)
    upgrade_request_id: UUID

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.upper().strip()


class ApplyCouponResponse(BaseModel):
    """Response from applying a coupon"""
    success: bool
    redemption: Optional[CouponRedemptionResponse] = None
    original_amount: int
    discount_amount: int
    final_amount: int
    discount_description: str
    error_message: Optional[str] = None


# ============== Coupon Statistics Schemas ==============

class CouponStatistics(BaseModel):
    """Statistics for a single coupon"""
    coupon_id: UUID
    code: str
    name: str
    total_redemptions: int
    total_discount_given: int
    unique_tenants: int
    active_redemptions: int
    expired_redemptions: int


class CouponOverviewStats(BaseModel):
    """Overall coupon statistics"""
    total_coupons: int
    active_coupons: int
    expired_coupons: int
    total_redemptions: int
    total_discount_given: int
    top_coupons: List[CouponStatistics]
