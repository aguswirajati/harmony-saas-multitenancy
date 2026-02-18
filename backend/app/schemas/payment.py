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
    type: Literal["bank_transfer", "qris", "wallet"] = Field(
        ...,
        description="Payment type"
    )

    # Bank transfer details (optional based on type)
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=50)
    account_name: Optional[str] = Field(None, max_length=100)

    # Wallet details (for e-wallets like ShopeePay, GoPay, Dana)
    wallet_type: Optional[str] = Field(
        None,
        max_length=50,
        description="Wallet provider: shopeepay, gopay, dana, ovo, linkaja"
    )

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
    wallet_type: Optional[str] = Field(None, max_length=50)
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
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None
    wallet_type: Optional[str] = None
    qris_image_file_id: Optional[UUID] = None
    qris_image_url: Optional[str] = None
    instructions: Optional[str] = None
    sort_order: int
    is_public: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

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
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None
    wallet_type: Optional[str] = None
    qris_image_url: Optional[str] = None
    instructions: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# PRORATION SCHEMAS
# ============================================================================

class ProrationBreakdown(BaseModel):
    """Proration calculation breakdown"""
    days_remaining: int = Field(..., description="Days remaining in billing period")
    current_daily_rate: int = Field(..., description="Daily rate for current tier")
    new_daily_rate: int = Field(..., description="Daily rate for new tier")
    proration_credit: int = Field(..., description="Credit from unused days of current tier")
    proration_charge: int = Field(..., description="Charge for remaining days at new tier")
    net_amount: int = Field(..., description="Net amount (charge - credit)")
    credit_balance_available: int = Field(default=0, description="Available credit balance on tenant")
    credit_to_apply: int = Field(default=0, description="Credit to apply from balance")
    amount_due: int = Field(..., description="Final amount due after credits")
    original_amount: int = Field(..., description="Full tier price before proration")


class ScheduledChange(BaseModel):
    """Scheduled tier change info"""
    tier_code: str
    tier_name: Optional[str] = None
    effective_at: datetime
    days_until: int


class SubscriptionInfo(BaseModel):
    """Tenant subscription information"""
    tier_code: str
    tier_name: str
    billing_period: Literal["monthly", "yearly"]
    subscription_started_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None
    days_remaining: int
    credit_balance: int
    scheduled_change: Optional[ScheduledChange] = None


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
    payment_method_id: Optional[UUID] = Field(
        None,
        description="Selected payment method ID (required for upgrades, optional for downgrades)"
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

    # Request type
    request_type: Literal["upgrade", "downgrade"] = "upgrade"

    # Tier info
    current_tier_code: str
    target_tier_code: str
    current_tier_name: Optional[str] = None
    target_tier_name: Optional[str] = None

    # Pricing
    billing_period: str
    amount: int
    currency: str

    # Proration details
    original_amount: int = 0
    proration_credit: int = 0
    proration_charge: int = 0
    days_remaining: int = 0
    effective_date: Optional[datetime] = None

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
    request_type: Literal["upgrade", "downgrade"] = "upgrade"
    current_tier_code: str
    target_tier_code: str
    billing_period: str
    amount: int
    currency: str
    status: str
    has_payment_proof: bool = False
    expires_at: Optional[datetime]
    effective_date: Optional[datetime] = None
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
    """Preview of upgrade/downgrade details before creating request"""
    current_tier_code: str
    current_tier_name: str
    target_tier_code: str
    target_tier_name: str
    billing_period: str
    amount: int
    currency: str
    savings_from_yearly: Optional[int] = None
    new_limits: dict

    # Proration info
    request_type: Literal["upgrade", "downgrade"] = "upgrade"
    days_remaining: int = 0
    proration_credit: int = 0
    proration_charge: int = 0
    credit_balance_available: int = 0
    credit_to_apply: int = 0
    amount_due: int = 0
    original_amount: int = 0
    effective_date: Optional[datetime] = None
    requires_payment: bool = True


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


# ============================================================================
# BILLING TRANSACTION SCHEMAS
# ============================================================================

class BillingTransactionResponse(BaseModel):
    """Billing transaction response"""
    id: UUID
    transaction_number: str
    tenant_id: UUID
    tenant_name: Optional[str] = None
    upgrade_request_id: Optional[UUID] = None
    transaction_type: str = "subscription"
    amount: int
    original_amount: int = 0
    credit_applied: int = 0
    credit_generated: int = 0
    currency: str
    billing_period: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    proration_details: Optional[dict] = None
    payment_method_id: Optional[UUID] = None
    payment_method_name: Optional[str] = None
    status: str
    invoice_date: datetime
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BillingTransactionListResponse(BaseModel):
    """List of billing transactions"""
    items: List[BillingTransactionResponse]
    total: int


class InvoiceLineItem(BaseModel):
    """Single line item in an invoice"""
    description: str
    quantity: int = 1
    unit_price: int
    amount: int
    is_credit: bool = False


class InvoiceData(BaseModel):
    """Data for invoice generation"""
    # Transaction info
    transaction_number: str
    invoice_date: datetime
    status: str  # pending, paid
    paid_at: Optional[datetime] = None

    # Seller info (system)
    seller_name: str = "Harmony SaaS"
    seller_address: Optional[str] = None
    seller_email: Optional[str] = None

    # Buyer info (tenant)
    buyer_name: str
    buyer_email: Optional[str] = None

    # Line items (for proration breakdown)
    line_items: List[InvoiceLineItem] = []
    subtotal: int = 0
    credit_applied: int = 0
    total: int = 0

    # Legacy fields for backward compatibility
    description: str
    billing_period: str
    amount: int
    currency: str

    # Billing period dates
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

    # Payment info
    payment_method_name: Optional[str] = None


class BillingStats(BaseModel):
    """Billing statistics for admin dashboard"""
    total_revenue: int
    total_revenue_this_month: int
    pending_amount: int
    credits_issued: int
    transaction_count: int
    paid_count: int
    pending_count: int
    requires_review_count: int = 0
    currency: str = "IDR"


# ============================================================================
# TRANSACTION MANAGEMENT SCHEMAS (Admin Command Center)
# ============================================================================

class TransactionApprove(BaseModel):
    """Schema for approving a transaction"""
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Internal admin notes"
    )


class TransactionReject(BaseModel):
    """Schema for rejecting a transaction"""
    rejection_reason: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Reason for rejection (shown to tenant)"
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Internal admin notes"
    )


class TransactionApplyCoupon(BaseModel):
    """Schema for applying a coupon to a transaction"""
    coupon_code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Coupon code to apply"
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Notes about the coupon application"
    )


class TransactionApplyDiscount(BaseModel):
    """Schema for applying a manual discount to a transaction"""
    discount_type: Literal["percentage", "fixed"] = Field(
        ...,
        description="Type of discount"
    )
    discount_value: int = Field(
        ...,
        gt=0,
        description="Discount value (percentage 1-100 or fixed amount)"
    )
    description: Optional[str] = Field(
        None,
        max_length=255,
        description="Description of the discount"
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Internal admin notes"
    )


class TransactionAddBonus(BaseModel):
    """Schema for adding bonus days to a subscription"""
    bonus_days: int = Field(
        ...,
        gt=0,
        le=365,
        description="Number of bonus days to add"
    )
    reason: Optional[str] = Field(
        None,
        max_length=255,
        description="Reason for the bonus"
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Internal admin notes"
    )


class TransactionAddNote(BaseModel):
    """Schema for adding admin notes to a transaction"""
    notes: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Admin notes"
    )


class ManualTransactionCreate(BaseModel):
    """Schema for creating a manual transaction (without upgrade request)"""
    tenant_id: UUID = Field(
        ...,
        description="Target tenant ID"
    )
    transaction_type: Literal[
        "credit_adjustment",
        "extension",
        "promo",
        "refund",
        "manual"
    ] = Field(
        ...,
        description="Transaction type"
    )
    amount: int = Field(
        default=0,
        ge=0,
        description="Transaction amount (0 for non-monetary transactions)"
    )
    currency: str = Field(
        default="IDR",
        description="Currency code"
    )
    description: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Description of the transaction"
    )

    # For credit adjustments
    credit_adjustment: Optional[int] = Field(
        None,
        description="Credit amount to add (positive) or remove (negative)"
    )

    # For subscription extensions
    bonus_days: Optional[int] = Field(
        None,
        gt=0,
        le=365,
        description="Number of days to extend subscription"
    )

    # For discounts/promos
    discount_amount: Optional[int] = Field(
        None,
        ge=0,
        description="Discount amount applied"
    )

    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Internal admin notes"
    )


class BillingTransactionDetailResponse(BaseModel):
    """Detailed billing transaction response with all management fields"""
    id: UUID
    transaction_number: str
    tenant_id: UUID
    tenant_name: Optional[str] = None
    tenant_subdomain: Optional[str] = None

    # Request link
    upgrade_request_id: Optional[UUID] = None
    request_number: Optional[str] = None
    request_status: Optional[str] = None
    has_payment_proof: bool = False
    payment_proof_file_id: Optional[UUID] = None

    # Transaction type and status
    transaction_type: str = "subscription"
    status: str
    requires_review: bool = False
    can_approve: bool = False
    can_reject: bool = False

    # Amounts
    amount: int
    original_amount: int = 0
    credit_applied: int = 0
    credit_generated: int = 0
    discount_amount: int = 0
    net_amount: int = 0
    currency: str

    # Coupon/discount info
    coupon_id: Optional[UUID] = None
    coupon_code: Optional[str] = None
    discount_description: Optional[str] = None

    # Bonus
    bonus_days: int = 0

    # Billing period
    billing_period: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    proration_details: Optional[dict] = None

    # Payment method
    payment_method_id: Optional[UUID] = None
    payment_method_name: Optional[str] = None

    # Dates
    invoice_date: datetime
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    adjusted_at: Optional[datetime] = None

    # Admin fields
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    adjusted_by_id: Optional[UUID] = None
    adjusted_by_name: Optional[str] = None
    rejected_by_id: Optional[UUID] = None
    rejected_by_name: Optional[str] = None

    # Description
    description: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BillingTransactionListDetailResponse(BaseModel):
    """Paginated list of detailed billing transactions"""
    items: List[BillingTransactionDetailResponse]
    total: int
    page: int
    page_size: int
    requires_review_count: int = 0
