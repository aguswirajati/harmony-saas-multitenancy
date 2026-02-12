"""
Upgrade Request Endpoints
Tenant endpoints for creating/managing upgrade requests
Admin endpoints for reviewing requests
"""
from fastapi import APIRouter, Depends, Query, Path, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID

from app.core.database import get_db
from app.api.deps import (
    get_super_admin_user,
    get_current_active_user,
    get_admin_user,
    get_current_tenant,
)
from app.models.user import User
from app.models.tenant import Tenant
from app.services.payment_service import PaymentService
from app.services.subscription_tier_service import SubscriptionTierService
from app.schemas.payment import (
    UpgradeRequestCreate,
    UpgradeRequestReview,
    UpgradeRequestResponse,
    UpgradeRequestSummary,
    UpgradeRequestListResponse,
    TenantUpgradeRequestListResponse,
    UpgradeRequestStats,
    UpgradePreview,
)


# ============================================================================
# TENANT ROUTES (Tenant Admin)
# ============================================================================

tenant_router = APIRouter(prefix="/upgrade-requests", tags=["Upgrade Requests (Tenant)"])


@tenant_router.post("/", response_model=UpgradeRequestResponse, status_code=201)
def create_upgrade_request(
    data: UpgradeRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Create a new upgrade request

    **Tenant Admin Only**

    Steps:
    1. Create request with target tier, billing period, and payment method
    2. Receive payment instructions
    3. Upload payment proof
    4. Wait for admin approval
    """
    # Ensure user is not super admin
    if current_user.role == "super_admin":
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Super admin cannot create upgrade requests")

    service = PaymentService(db)
    upgrade_request = service.create_upgrade_request(
        tenant_id=tenant.id,
        user_id=current_user.id,
        data=data,
        request=request,
    )

    return _build_upgrade_response(db, upgrade_request)


@tenant_router.get("/", response_model=TenantUpgradeRequestListResponse)
def list_my_upgrade_requests(
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    List upgrade requests for my tenant

    **Tenant Admin Only**
    """
    if current_user.role == "super_admin":
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Super admin should use admin endpoints")

    service = PaymentService(db)
    requests = service.get_tenant_upgrade_requests(tenant.id, status)

    return TenantUpgradeRequestListResponse(
        items=[_build_upgrade_response(db, r) for r in requests],
        total=len(requests),
    )


@tenant_router.get("/preview")
def preview_upgrade(
    target_tier_code: str = Query(..., description="Target tier code"),
    billing_period: str = Query(..., description="Billing period: monthly or yearly"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Preview upgrade details before creating request

    **Tenant Admin Only**
    """
    if current_user.role == "super_admin":
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Super admin should use admin endpoints")

    tier_service = SubscriptionTierService(db)

    current_tier = tier_service.get_tier_by_code(tenant.tier)
    target_tier = tier_service.get_tier_by_code(target_tier_code)

    if not target_tier:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(f"Tier '{target_tier_code}' not found")

    if billing_period == "yearly":
        amount = target_tier.price_yearly
        savings = (target_tier.price_monthly * 12) - target_tier.price_yearly
    else:
        amount = target_tier.price_monthly
        savings = None

    return UpgradePreview(
        current_tier_code=tenant.tier,
        current_tier_name=current_tier.display_name if current_tier else tenant.tier,
        target_tier_code=target_tier_code,
        target_tier_name=target_tier.display_name,
        billing_period=billing_period,
        amount=amount,
        currency=target_tier.currency,
        savings_from_yearly=savings,
        new_limits={
            "max_users": target_tier.max_users,
            "max_branches": target_tier.max_branches,
            "max_storage_gb": target_tier.max_storage_gb,
        },
    )


@tenant_router.get("/{request_id}", response_model=UpgradeRequestResponse)
def get_my_upgrade_request(
    request_id: UUID = Path(..., description="Upgrade request ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Get upgrade request details

    **Tenant Admin Only**
    """
    if current_user.role == "super_admin":
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Super admin should use admin endpoints")

    service = PaymentService(db)
    upgrade_request = service.get_upgrade_request_by_id(request_id, tenant.id)

    return _build_upgrade_response(db, upgrade_request)


@tenant_router.post("/{request_id}/proof", response_model=UpgradeRequestResponse)
def upload_payment_proof(
    request_id: UUID = Path(..., description="Upgrade request ID"),
    file_id: UUID = Query(..., description="File ID of uploaded payment proof"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Upload payment proof for an upgrade request

    **Tenant Admin Only**

    Note: The file must be uploaded first via /api/v1/files/upload endpoint.
    """
    if current_user.role == "super_admin":
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Super admin should use admin endpoints")

    service = PaymentService(db)
    upgrade_request = service.upload_payment_proof(
        request_id=request_id,
        tenant_id=tenant.id,
        file_id=file_id,
        user_id=current_user.id,
        request=request,
    )

    return _build_upgrade_response(db, upgrade_request)


@tenant_router.post("/{request_id}/cancel", response_model=UpgradeRequestResponse)
def cancel_upgrade_request(
    request_id: UUID = Path(..., description="Upgrade request ID"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Cancel an upgrade request

    **Tenant Admin Only**

    Note: Can only cancel requests in pending or payment_uploaded status.
    """
    if current_user.role == "super_admin":
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Super admin should use admin endpoints")

    service = PaymentService(db)
    upgrade_request = service.cancel_upgrade_request(
        request_id=request_id,
        tenant_id=tenant.id,
        user_id=current_user.id,
        request=request,
    )

    return _build_upgrade_response(db, upgrade_request)


@tenant_router.put("/{request_id}", response_model=UpgradeRequestResponse)
def update_upgrade_request(
    data: UpgradeRequestCreate,
    request_id: UUID = Path(..., description="Upgrade request ID"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Update a pending upgrade request

    **Tenant Admin Only**

    Note: Can only update requests in pending status (before payment proof uploaded).
    """
    if current_user.role == "super_admin":
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Super admin should use admin endpoints")

    service = PaymentService(db)
    upgrade_request = service.update_upgrade_request(
        request_id=request_id,
        tenant_id=tenant.id,
        user_id=current_user.id,
        target_tier_code=data.target_tier_code,
        billing_period=data.billing_period,
        payment_method_id=data.payment_method_id,
        request=request,
    )

    return _build_upgrade_response(db, upgrade_request)


@tenant_router.get("/{request_id}/invoice")
def get_invoice_data(
    request_id: UUID = Path(..., description="Upgrade request ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Get invoice data for an upgrade request

    **Tenant Admin Only**

    Returns data needed to generate/display an invoice.
    """
    if current_user.role == "super_admin":
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Super admin should use admin endpoints")

    from app.schemas.payment import InvoiceData

    service = PaymentService(db)
    upgrade_request = service.get_upgrade_request_by_id(request_id, tenant.id)

    # Get payment method name
    payment_method_name = None
    if upgrade_request.payment_method:
        payment_method_name = upgrade_request.payment_method.name

    # Build description
    description = f"Subscription upgrade: {upgrade_request.current_tier_code} → {upgrade_request.target_tier_code}"

    # Determine status
    if upgrade_request.status == "approved":
        invoice_status = "paid"
    elif upgrade_request.status in ["rejected", "cancelled", "expired"]:
        invoice_status = "cancelled"
    else:
        invoice_status = "pending"

    return InvoiceData(
        transaction_number=upgrade_request.transaction.transaction_number if upgrade_request.transaction else upgrade_request.request_number,
        invoice_date=upgrade_request.created_at,
        status=invoice_status,
        paid_at=upgrade_request.applied_at,
        seller_name="Harmony SaaS",
        buyer_name=tenant.name,
        buyer_email=None,
        description=description,
        billing_period=upgrade_request.billing_period,
        amount=upgrade_request.amount,
        currency=upgrade_request.currency,
        payment_method_name=payment_method_name,
    )


# ============================================================================
# ADMIN ROUTES (Super Admin Only)
# ============================================================================

admin_router = APIRouter(prefix="/admin/upgrade-requests", tags=["Upgrade Requests (Admin)"])


@admin_router.get("/", response_model=UpgradeRequestListResponse)
def list_all_upgrade_requests(
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    List all upgrade requests

    **Super Admin Only**

    Statuses:
    - pending: Awaiting payment
    - payment_uploaded: Payment proof uploaded, ready for review
    - under_review: Being reviewed
    - approved: Approved and applied
    - rejected: Rejected
    - cancelled: Cancelled by tenant
    - expired: Expired without payment
    """
    service = PaymentService(db)
    requests, total = service.get_all_upgrade_requests(
        status=status,
        skip=skip,
        limit=limit,
    )

    items = []
    for req in requests:
        # Get tenant name
        tenant = db.query(Tenant).filter(Tenant.id == req.tenant_id).first()
        items.append(
            UpgradeRequestSummary(
                id=req.id,
                request_number=req.request_number,
                tenant_id=req.tenant_id,
                tenant_name=tenant.name if tenant else None,
                current_tier_code=req.current_tier_code,
                target_tier_code=req.target_tier_code,
                billing_period=req.billing_period,
                amount=req.amount,
                currency=req.currency,
                status=req.status,
                has_payment_proof=req.payment_proof_file_id is not None,
                expires_at=req.expires_at,
                created_at=req.created_at,
            )
        )

    return UpgradeRequestListResponse(
        items=items,
        total=total,
        page=skip // limit + 1 if limit > 0 else 1,
        page_size=limit,
    )


@admin_router.get("/stats", response_model=UpgradeRequestStats)
def get_upgrade_request_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get upgrade request statistics

    **Super Admin Only**
    """
    service = PaymentService(db)
    return service.get_upgrade_request_stats()


@admin_router.get("/pending-count")
def get_pending_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get count of requests awaiting review

    **Super Admin Only**

    Useful for sidebar badge showing pending review count.
    """
    service = PaymentService(db)
    count = service.get_pending_count()
    return {"pending_count": count}


@admin_router.get("/{request_id}", response_model=UpgradeRequestResponse)
def get_upgrade_request_admin(
    request_id: UUID = Path(..., description="Upgrade request ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get upgrade request details

    **Super Admin Only**
    """
    service = PaymentService(db)
    upgrade_request = service.get_upgrade_request_by_id(request_id)

    return _build_upgrade_response(db, upgrade_request)


@admin_router.post("/{request_id}/review", response_model=UpgradeRequestResponse)
def review_upgrade_request(
    data: UpgradeRequestReview,
    request_id: UUID = Path(..., description="Upgrade request ID"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Review (approve or reject) an upgrade request

    **Super Admin Only**

    Actions:
    - approve: Applies the tier upgrade immediately
    - reject: Requires rejection_reason
    """
    service = PaymentService(db)
    upgrade_request = service.review_upgrade_request(
        request_id=request_id,
        reviewer_id=current_user.id,
        data=data,
        request=request,
    )

    return _build_upgrade_response(db, upgrade_request)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _build_upgrade_response(db: Session, req) -> UpgradeRequestResponse:
    """Build full upgrade request response with related data"""
    tier_service = SubscriptionTierService(db)

    # Get tier names
    current_tier = tier_service.get_tier_by_code(req.current_tier_code)
    target_tier = tier_service.get_tier_by_code(req.target_tier_code)

    # Get payment method name
    payment_method_name = None
    if req.payment_method:
        payment_method_name = req.payment_method.name

    # Get reviewer name
    reviewer_name = None
    if req.reviewed_by:
        reviewer_name = req.reviewed_by.full_name or f"{req.reviewed_by.first_name} {req.reviewed_by.last_name}"

    # Get requestor name
    requestor_name = None
    if req.requested_by:
        requestor_name = req.requested_by.full_name or f"{req.requested_by.first_name} {req.requested_by.last_name}"

    return UpgradeRequestResponse(
        id=req.id,
        request_number=req.request_number,
        tenant_id=req.tenant_id,
        current_tier_code=req.current_tier_code,
        target_tier_code=req.target_tier_code,
        current_tier_name=current_tier.display_name if current_tier else req.current_tier_code,
        target_tier_name=target_tier.display_name if target_tier else req.target_tier_code,
        billing_period=req.billing_period,
        amount=req.amount,
        currency=req.currency,
        payment_method_id=req.payment_method_id,
        payment_method_name=payment_method_name,
        payment_proof_file_id=req.payment_proof_file_id,
        payment_proof_url=None,  # TODO: Get URL from file service
        payment_proof_uploaded_at=req.payment_proof_uploaded_at,
        status=req.status,
        reviewed_by_id=req.reviewed_by_id,
        reviewed_by_name=reviewer_name,
        reviewed_at=req.reviewed_at,
        review_notes=req.review_notes,
        rejection_reason=req.rejection_reason,
        expires_at=req.expires_at,
        applied_at=req.applied_at,
        requested_by_id=req.requested_by_id,
        requested_by_name=requestor_name,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )
