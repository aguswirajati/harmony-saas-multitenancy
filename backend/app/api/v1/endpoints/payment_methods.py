"""
Payment Method Endpoints
Admin endpoints for payment method management
"""
from fastapi import APIRouter, Depends, Query, Path, Request
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_super_admin_user, get_current_active_user
from app.models.user import User
from app.services.payment_service import PaymentService
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction, AuditStatus
from app.schemas.payment import (
    PaymentMethodCreate,
    PaymentMethodUpdate,
    PaymentMethodResponse,
    PaymentMethodListResponse,
    PublicPaymentMethodResponse,
)


# ============================================================================
# ADMIN ROUTES (Super Admin Only)
# ============================================================================

admin_router = APIRouter(prefix="/admin/payment-methods", tags=["Payment Methods (Admin)"])


@admin_router.post("/", response_model=PaymentMethodResponse, status_code=201)
def create_payment_method(
    data: PaymentMethodCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Create a new payment method

    **Super Admin Only**

    Types:
    - bank_transfer: Requires bank_name, account_number, account_name
    - qris: Use separate endpoint to upload QRIS image
    """
    service = PaymentService(db)
    payment_method = service.create_payment_method(data)

    # Log audit
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action=AuditAction.PAYMENT_METHOD_CREATED,
        resource="payment_method",
        resource_id=payment_method.id,
        details={
            "code": payment_method.code,
            "name": payment_method.name,
            "type": payment_method.type,
        },
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return payment_method


@admin_router.get("/", response_model=PaymentMethodListResponse)
def list_payment_methods(
    include_inactive: bool = Query(False, description="Include inactive methods"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    List all payment methods

    **Super Admin Only**
    """
    service = PaymentService(db)
    methods = service.get_all_payment_methods(include_inactive=include_inactive)
    return PaymentMethodListResponse(items=methods, total=len(methods))


@admin_router.get("/{method_id}", response_model=PaymentMethodResponse)
def get_payment_method(
    method_id: UUID = Path(..., description="Payment method ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get payment method by ID

    **Super Admin Only**
    """
    service = PaymentService(db)
    return service.get_payment_method_by_id(method_id)


@admin_router.put("/{method_id}", response_model=PaymentMethodResponse)
def update_payment_method(
    data: PaymentMethodUpdate,
    request: Request,
    method_id: UUID = Path(..., description="Payment method ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Update payment method

    **Super Admin Only**
    """
    service = PaymentService(db)

    # Get old values before update for audit trail
    old_method = service.get_payment_method_by_id(method_id)
    old_values = {
        "name": old_method.name,
        "bank_name": old_method.bank_name,
        "account_number": old_method.account_number,
        "account_name": old_method.account_name,
        "instructions": old_method.instructions,
        "is_active": old_method.is_active,
    }

    payment_method = service.update_payment_method(method_id, data)

    # Build detailed changes dict
    changes = {}
    update_data = data.model_dump(exclude_unset=True)
    for field, new_value in update_data.items():
        if field in old_values and old_values[field] != new_value:
            changes[field] = {"from": old_values[field], "to": new_value}

    # Log audit
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action=AuditAction.PAYMENT_METHOD_UPDATED,
        resource="payment_method",
        resource_id=payment_method.id,
        details={
            "code": payment_method.code,
            "name": payment_method.name,
            "changes": changes,
        },
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return payment_method


@admin_router.delete("/{method_id}", status_code=204)
def delete_payment_method(
    request: Request,
    method_id: UUID = Path(..., description="Payment method ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Delete payment method (soft delete)

    **Super Admin Only**

    Note: Cannot delete methods that have pending upgrade requests.
    """
    service = PaymentService(db)
    method = service.get_payment_method_by_id(method_id)
    method_code = method.code

    service.delete_payment_method(method_id)

    # Log audit
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action=AuditAction.PAYMENT_METHOD_DELETED,
        resource="payment_method",
        resource_id=method_id,
        details={"code": method_code},
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return None


@admin_router.post("/{method_id}/qris", response_model=PaymentMethodResponse)
def set_qris_image(
    request: Request,
    method_id: UUID = Path(..., description="Payment method ID"),
    file_id: UUID = Query(..., description="File ID of uploaded QRIS image"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Set QRIS image for a payment method

    **Super Admin Only**

    Note: The file must be uploaded first via /api/v1/files/upload endpoint.
    Only applicable for QRIS type payment methods.
    """
    service = PaymentService(db)
    return service.set_qris_image(method_id, file_id)


# ============================================================================
# PUBLIC ROUTES (Authenticated)
# ============================================================================

public_router = APIRouter(prefix="/payment-methods", tags=["Payment Methods"])


@public_router.get("/", response_model=List[PublicPaymentMethodResponse])
def list_available_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List available payment methods for upgrade flow

    **Authenticated Users**
    """
    service = PaymentService(db)
    methods = service.get_public_payment_methods()

    # Add QRIS image URLs if file service is available
    result = []
    for method in methods:
        response = PublicPaymentMethodResponse(
            id=method.id,
            code=method.code,
            name=method.name,
            type=method.type,
            bank_name=method.bank_name,
            account_number=method.account_number,
            account_name=method.account_name,
            qris_image_url=None,  # TODO: Get URL from file service
            instructions=method.instructions,
        )
        result.append(response)

    return result
