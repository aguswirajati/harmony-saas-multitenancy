"""
Admin Billing Endpoints
Super admin endpoints for managing billing transactions (Command Center)
"""
from fastapi import APIRouter, Depends, Query, Path, Request
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_super_admin_user
from app.models.user import User
from app.models.tenant import Tenant
from app.services.payment_service import PaymentService
from app.schemas.payment import (
    BillingTransactionResponse,
    BillingTransactionListResponse,
    BillingTransactionDetailResponse,
    BillingTransactionListDetailResponse,
    BillingStats,
    TransactionApprove,
    TransactionReject,
    TransactionApplyCoupon,
    TransactionApplyDiscount,
    TransactionAddBonus,
    TransactionAddNote,
    ManualTransactionCreate,
)


router = APIRouter(prefix="/admin/billing", tags=["Admin Billing"])


@router.get("/stats", response_model=BillingStats)
def get_billing_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get billing statistics

    **Super Admin Only**

    Returns:
    - Total revenue (all time)
    - Revenue this month
    - Pending payment amount
    - Credits issued
    - Transaction counts
    - Requires review count
    """
    service = PaymentService(db)
    stats = service.get_billing_stats()
    stats.requires_review_count = service.get_requires_review_count()
    return stats


@router.get("/transactions", response_model=BillingTransactionListResponse)
def list_billing_transactions(
    status: Optional[str] = Query(None, description="Filter by status: pending, paid, cancelled"),
    transaction_type: Optional[str] = Query(None, description="Filter by type: subscription, upgrade, downgrade, renewal"),
    tenant_id: Optional[UUID] = Query(None, description="Filter by tenant ID"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    List all billing transactions

    **Super Admin Only**

    Supports filtering by status, transaction type, and tenant.
    """
    service = PaymentService(db)
    transactions, total = service.get_all_billing_transactions(
        status=status,
        transaction_type=transaction_type,
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
    )

    items = []
    for tx in transactions:
        # Get tenant name
        tenant = db.query(Tenant).filter(Tenant.id == tx.tenant_id).first()

        # Get payment method name
        payment_method_name = None
        if tx.payment_method:
            payment_method_name = tx.payment_method.name

        items.append(
            BillingTransactionResponse(
                id=tx.id,
                transaction_number=tx.transaction_number,
                tenant_id=tx.tenant_id,
                tenant_name=tenant.name if tenant else None,
                upgrade_request_id=tx.upgrade_request_id,
                transaction_type=tx.transaction_type,
                amount=tx.amount,
                original_amount=tx.original_amount,
                credit_applied=tx.credit_applied,
                credit_generated=tx.credit_generated,
                currency=tx.currency,
                billing_period=tx.billing_period,
                period_start=tx.period_start,
                period_end=tx.period_end,
                proration_details=tx.proration_details,
                payment_method_id=tx.payment_method_id,
                payment_method_name=payment_method_name,
                status=tx.status,
                invoice_date=tx.invoice_date,
                paid_at=tx.paid_at,
                cancelled_at=tx.cancelled_at,
                description=tx.description,
                created_at=tx.created_at,
            )
        )

    return BillingTransactionListResponse(
        items=items,
        total=total,
    )


@router.get("/transactions/{transaction_id}", response_model=BillingTransactionResponse)
def get_billing_transaction(
    transaction_id: UUID = Path(..., description="Transaction ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get billing transaction details

    **Super Admin Only**
    """
    service = PaymentService(db)
    tx = service.get_billing_transaction_by_id(transaction_id)

    # Get tenant name
    tenant = db.query(Tenant).filter(Tenant.id == tx.tenant_id).first()

    # Get payment method name
    payment_method_name = None
    if tx.payment_method:
        payment_method_name = tx.payment_method.name

    return BillingTransactionResponse(
        id=tx.id,
        transaction_number=tx.transaction_number,
        tenant_id=tx.tenant_id,
        tenant_name=tenant.name if tenant else None,
        upgrade_request_id=tx.upgrade_request_id,
        transaction_type=tx.transaction_type,
        amount=tx.amount,
        original_amount=tx.original_amount,
        credit_applied=tx.credit_applied,
        credit_generated=tx.credit_generated,
        currency=tx.currency,
        billing_period=tx.billing_period,
        period_start=tx.period_start,
        period_end=tx.period_end,
        proration_details=tx.proration_details,
        payment_method_id=tx.payment_method_id,
        payment_method_name=payment_method_name,
        status=tx.status,
        invoice_date=tx.invoice_date,
        paid_at=tx.paid_at,
        cancelled_at=tx.cancelled_at,
        description=tx.description,
        created_at=tx.created_at,
    )


def _build_transaction_detail_response(
    tx, db: Session
) -> BillingTransactionDetailResponse:
    """Helper to build detailed transaction response."""
    # Get tenant info
    tenant = db.query(Tenant).filter(Tenant.id == tx.tenant_id).first()

    # Get payment method name
    payment_method_name = None
    if tx.payment_method:
        payment_method_name = tx.payment_method.name

    # Get upgrade request info
    request_number = None
    request_status = None
    has_payment_proof = False
    payment_proof_file_id = None

    if tx.upgrade_request:
        request_number = tx.upgrade_request.request_number
        request_status = tx.upgrade_request.status
        has_payment_proof = tx.upgrade_request.payment_proof_file_id is not None
        payment_proof_file_id = tx.upgrade_request.payment_proof_file_id

    # Get adjusted by user name
    adjusted_by_name = None
    if tx.adjusted_by:
        adjusted_by_name = tx.adjusted_by.full_name or tx.adjusted_by.email

    # Get rejected by user name
    rejected_by_name = None
    if tx.rejected_by:
        rejected_by_name = tx.rejected_by.full_name or tx.rejected_by.email

    # Determine if transaction can be reviewed
    can_approve = tx.status == "pending" and (
        tx.upgrade_request is None or
        (tx.upgrade_request and tx.upgrade_request.status == "payment_uploaded")
    )
    can_reject = can_approve

    return BillingTransactionDetailResponse(
        id=tx.id,
        transaction_number=tx.transaction_number,
        tenant_id=tx.tenant_id,
        tenant_name=tenant.name if tenant else None,
        tenant_subdomain=tenant.subdomain if tenant else None,
        upgrade_request_id=tx.upgrade_request_id,
        request_number=request_number,
        request_status=request_status,
        has_payment_proof=has_payment_proof,
        payment_proof_file_id=payment_proof_file_id,
        transaction_type=tx.transaction_type,
        status=tx.status,
        requires_review=tx.requires_review,
        can_approve=can_approve,
        can_reject=can_reject,
        amount=tx.amount,
        original_amount=tx.original_amount,
        credit_applied=tx.credit_applied,
        credit_generated=tx.credit_generated,
        discount_amount=tx.discount_amount,
        net_amount=tx.net_amount,
        currency=tx.currency,
        coupon_id=tx.coupon_id,
        coupon_code=tx.coupon_code,
        discount_description=tx.discount_description,
        bonus_days=tx.bonus_days,
        billing_period=tx.billing_period,
        period_start=tx.period_start,
        period_end=tx.period_end,
        proration_details=tx.proration_details,
        payment_method_id=tx.payment_method_id,
        payment_method_name=payment_method_name,
        invoice_date=tx.invoice_date,
        paid_at=tx.paid_at,
        cancelled_at=tx.cancelled_at,
        rejected_at=tx.rejected_at,
        adjusted_at=tx.adjusted_at,
        admin_notes=tx.admin_notes,
        rejection_reason=tx.rejection_reason,
        adjusted_by_id=tx.adjusted_by_id,
        adjusted_by_name=adjusted_by_name,
        rejected_by_id=tx.rejected_by_id,
        rejected_by_name=rejected_by_name,
        description=tx.description,
        created_at=tx.created_at,
        updated_at=tx.updated_at,
    )


# ============================================================================
# TRANSACTION MANAGEMENT ENDPOINTS (Command Center)
# ============================================================================

@router.get("/transactions-detailed", response_model=BillingTransactionListDetailResponse)
def list_transactions_detailed(
    status: Optional[str] = Query(None, description="Filter by status"),
    transaction_type: Optional[str] = Query(None, description="Filter by type"),
    tenant_id: Optional[UUID] = Query(None, description="Filter by tenant"),
    requires_review: Optional[bool] = Query(None, description="Filter by requires review"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    List billing transactions with full details for management.

    **Super Admin Only**

    Returns detailed transaction info including linked upgrade request status,
    payment proof availability, and management actions available.
    """
    service = PaymentService(db)
    skip = (page - 1) * page_size

    if requires_review:
        transactions, total = service.get_transactions_requiring_review(
            skip=skip,
            limit=page_size,
        )
    else:
        transactions, total = service.get_all_billing_transactions(
            status=status,
            transaction_type=transaction_type,
            tenant_id=tenant_id,
            skip=skip,
            limit=page_size,
        )

    items = [
        _build_transaction_detail_response(tx, db)
        for tx in transactions
    ]

    return BillingTransactionListDetailResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        requires_review_count=service.get_requires_review_count(),
    )


@router.get("/transactions/{transaction_id}/detail", response_model=BillingTransactionDetailResponse)
def get_transaction_detail(
    transaction_id: UUID = Path(..., description="Transaction ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get detailed transaction information for management.

    **Super Admin Only**
    """
    service = PaymentService(db)
    tx = service.get_billing_transaction_by_id(transaction_id)
    return _build_transaction_detail_response(tx, db)


@router.post("/transactions/{transaction_id}/approve", response_model=BillingTransactionDetailResponse)
def approve_transaction(
    transaction_id: UUID = Path(..., description="Transaction ID"),
    data: TransactionApprove = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Approve a pending transaction.

    **Super Admin Only**

    If linked to an upgrade request, this will:
    - Approve the upgrade request
    - Apply the tier upgrade to the tenant
    - Apply any bonus days
    - Mark transaction as paid
    """
    service = PaymentService(db)

    if data is None:
        data = TransactionApprove()

    tx = service.approve_transaction(
        transaction_id=transaction_id,
        admin_id=current_user.id,
        data=data,
        request=request,
    )
    return _build_transaction_detail_response(tx, db)


@router.post("/transactions/{transaction_id}/reject", response_model=BillingTransactionDetailResponse)
def reject_transaction(
    transaction_id: UUID = Path(..., description="Transaction ID"),
    data: TransactionReject = ...,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Reject a pending transaction.

    **Super Admin Only**

    Rejection reason is required and will be shown to the tenant.
    """
    service = PaymentService(db)
    tx = service.reject_transaction(
        transaction_id=transaction_id,
        admin_id=current_user.id,
        data=data,
        request=request,
    )
    return _build_transaction_detail_response(tx, db)


@router.post("/transactions/{transaction_id}/apply-coupon", response_model=BillingTransactionDetailResponse)
def apply_coupon_to_transaction(
    transaction_id: UUID = Path(..., description="Transaction ID"),
    data: TransactionApplyCoupon = ...,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Apply a coupon to a pending transaction.

    **Super Admin Only**

    Validates the coupon and recalculates the transaction amount.
    """
    service = PaymentService(db)
    tx = service.apply_coupon_to_transaction(
        transaction_id=transaction_id,
        admin_id=current_user.id,
        data=data,
        request=request,
    )
    return _build_transaction_detail_response(tx, db)


@router.post("/transactions/{transaction_id}/apply-discount", response_model=BillingTransactionDetailResponse)
def apply_discount_to_transaction(
    transaction_id: UUID = Path(..., description="Transaction ID"),
    data: TransactionApplyDiscount = ...,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Apply a manual discount to a pending transaction.

    **Super Admin Only**

    Supports percentage or fixed amount discounts.
    """
    service = PaymentService(db)
    tx = service.apply_discount_to_transaction(
        transaction_id=transaction_id,
        admin_id=current_user.id,
        data=data,
        request=request,
    )
    return _build_transaction_detail_response(tx, db)


@router.post("/transactions/{transaction_id}/add-bonus", response_model=BillingTransactionDetailResponse)
def add_bonus_to_transaction(
    transaction_id: UUID = Path(..., description="Transaction ID"),
    data: TransactionAddBonus = ...,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Add bonus days to a transaction.

    **Super Admin Only**

    Bonus days will be applied to the tenant's subscription when approved.
    For already-paid transactions, bonus days are applied immediately.
    """
    service = PaymentService(db)
    tx = service.add_bonus_days_to_transaction(
        transaction_id=transaction_id,
        admin_id=current_user.id,
        data=data,
        request=request,
    )
    return _build_transaction_detail_response(tx, db)


@router.post("/transactions/{transaction_id}/add-note", response_model=BillingTransactionDetailResponse)
def add_note_to_transaction(
    transaction_id: UUID = Path(..., description="Transaction ID"),
    data: TransactionAddNote = ...,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Add admin notes to a transaction.

    **Super Admin Only**
    """
    service = PaymentService(db)
    tx = service.add_note_to_transaction(
        transaction_id=transaction_id,
        admin_id=current_user.id,
        notes=data.notes,
        request=request,
    )
    return _build_transaction_detail_response(tx, db)


@router.post("/transactions", response_model=BillingTransactionDetailResponse)
def create_manual_transaction(
    data: ManualTransactionCreate = ...,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Create a manual transaction (without upgrade request).

    **Super Admin Only**

    Supports:
    - credit_adjustment: Add or remove credits
    - extension: Add bonus days to subscription
    - promo: Apply promotional discount
    - refund: Issue refund as credit
    - manual: Other manual adjustments
    """
    service = PaymentService(db)
    tx = service.create_manual_transaction(
        admin_id=current_user.id,
        data=data,
        request=request,
    )
    return _build_transaction_detail_response(tx, db)
