"""
Payment Schemas
Request/response models for payment methods and upgrade requests
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID


# ============================================================================
# PAYMENT METHOD SCHEMAS
# ============================================================================

class PaymentMethodCreate(BaseModel):
    """Schema for creating a payment method"""
    code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        pattern="^[a-z0-9_-]+$",
        description="Unique payment method code"
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Display name"
    )
    type: Literal["bank_transfer", "qris"] = Field(
        ...,
        description="Payment type"
    )

    # Bank transfer details (optional based on type)
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=50)
    account_name: Optional[str] = Field(None, max_length=100)

    # Instructions
    instructions: Optional[str] = Field(None, max_length=2000)

    # Display settings
    sort_order: int = Field(default=0, ge=0)
    is_public: bool = Field(default=True)

    @field_validator('code')
    @classmethod
    def code_lowercase(cls, v: str) -> str:
        return v.lower()


class PaymentMethodUpdate(BaseModel):
    """Schema for updating a payment method (partial update)"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=50)
    account_name: Optional[str] = Field(None, max_length=100)
    instructions: Optional[str] = Field(None, max_length=2000)
    sort_order: Optional[int] = Field(None, ge=0)
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None


class PaymentMethodResponse(BaseModel):
    """Complete payment method response"""
    id: UUID
    code: str
    name: str
    type: str
    bank_name: Optional[str]
    account_number: Optional[str]
    account_name: Optional[str]
    qris_image_file_id: Optional[UUID]
    qris_image_url: Optional[str] = None
    instructions: Optional[str]
    sort_order: int
    is_public: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PaymentMethodSummary(BaseModel):
    """Payment method summary for list views"""
    id: UUID
    code: str
    name: str
    type: str
    is_public: bool
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True


class PaymentMethodListResponse(BaseModel):
    """List of payment methods"""
    items: List[PaymentMethodResponse]
    total: int


class PublicPaymentMethodResponse(BaseModel):
    """Public payment method info for upgrade flow"""
    id: UUID
    code: str
    name: str
    type: str
    bank_name: Optional[str]
    account_number: Optional[str]
    account_name: Optional[str]
    qris_image_url: Optional[str]
    instructions: Optional[str]

    class Config:
        from_attributes = True


# ============================================================================
# UPGRADE REQUEST SCHEMAS
# ============================================================================

class UpgradeRequestCreate(BaseModel):
    """Schema for creating an upgrade request"""
    target_tier_code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Target tier code"
    )
    billing_period: Literal["monthly", "yearly"] = Field(
        ...,
        description="Billing period"
    )
    payment_method_id: UUID = Field(
        ...,
        description="Selected payment method ID"
    )


class UpgradeRequestReview(BaseModel):
    """Schema for reviewing an upgrade request"""
    action: Literal["approve", "reject"] = Field(
        ...,
        description="Review action"
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Internal notes"
    )
    rejection_reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Reason shown to tenant if rejected"
    )

    @field_validator('rejection_reason')
    @classmethod
    def rejection_reason_required_for_reject(cls, v, info):
        if info.data.get('action') == 'reject' and not v:
            raise ValueError('Rejection reason is required when rejecting')
        return v


class UpgradeRequestResponse(BaseModel):
    """Complete upgrade request response"""
    id: UUID
    request_number: str
    tenant_id: UUID

    # Tier info
    current_tier_code: str
    target_tier_code: str
    current_tier_name: Optional[str] = None
    target_tier_name: Optional[str] = None

    # Pricing
    billing_period: str
    amount: int
    currency: str

    # Payment
    payment_method_id: Optional[UUID]
    payment_method_name: Optional[str] = None
    payment_proof_file_id: Optional[UUID]
    payment_proof_url: Optional[str] = None
    payment_proof_uploaded_at: Optional[datetime]

    # Status
    status: str

    # Review
    reviewed_by_id: Optional[UUID]
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    rejection_reason: Optional[str]

    # Timing
    expires_at: Optional[datetime]
    applied_at: Optional[datetime]

    # Requestor
    requested_by_id: Optional[UUID]
    requested_by_name: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class UpgradeRequestSummary(BaseModel):
    """Upgrade request summary for list views"""
    id: UUID
    request_number: str
    tenant_id: UUID
    tenant_name: Optional[str] = None
    current_tier_code: str
    target_tier_code: str
    billing_period: str
    amount: int
    currency: str
    status: str
    has_payment_proof: bool = False
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class UpgradeRequestListResponse(BaseModel):
    """Paginated list of upgrade requests"""
    items: List[UpgradeRequestSummary]
    total: int
    page: int
    page_size: int


class TenantUpgradeRequestListResponse(BaseModel):
    """List of upgrade requests for a tenant"""
    items: List[UpgradeRequestResponse]
    total: int


# ============================================================================
# UPGRADE FLOW SCHEMAS
# ============================================================================

class UpgradePreview(BaseModel):
    """Preview of upgrade details before creating request"""
    current_tier_code: str
    current_tier_name: str
    target_tier_code: str
    target_tier_name: str
    billing_period: str
    amount: int
    currency: str
    savings_from_yearly: Optional[int] = None
    new_limits: dict


class UpgradeRequestStatusResponse(BaseModel):
    """Upgrade request status for tenant view"""
    id: UUID
    request_number: str
    status: str
    status_display: str
    target_tier_code: str
    target_tier_name: Optional[str]
    amount: int
    currency: str
    billing_period: str
    payment_method_name: Optional[str]
    has_payment_proof: bool
    can_upload_proof: bool
    can_cancel: bool
    expires_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime


# ============================================================================
# STATISTICS SCHEMAS
# ============================================================================

class UpgradeRequestStats(BaseModel):
    """Statistics for upgrade requests (admin dashboard)"""
    pending_count: int
    payment_uploaded_count: int
    under_review_count: int
    approved_this_month: int
    rejected_this_month: int
    total_revenue_this_month: int
    currency: str
