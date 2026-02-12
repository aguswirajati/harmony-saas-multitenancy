"""
Subscription Tier Endpoints
Admin endpoints for tier management and public endpoints for pricing
"""
from fastapi import APIRouter, Depends, Query, Path, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_super_admin_user, get_current_active_user
from app.models.user import User
from app.services.subscription_tier_service import SubscriptionTierService
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction, AuditStatus
from app.schemas.subscription_tier import (
    SubscriptionTierCreate,
    SubscriptionTierUpdate,
    SubscriptionTierResponse,
    SubscriptionTierListResponse,
    PublicTierResponse,
    PublicTierListResponse,
)


# ============================================================================
# ADMIN ROUTES (Super Admin Only)
# ============================================================================

admin_router = APIRouter(prefix="/admin/tiers", tags=["Subscription Tiers (Admin)"])


@admin_router.post("/", response_model=SubscriptionTierResponse, status_code=201)
def create_tier(
    data: SubscriptionTierCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Create a new subscription tier

    **Super Admin Only**
    """
    service = SubscriptionTierService(db)
    tier = service.create_tier(data)

    # Log audit
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action=AuditAction.TIER_CREATED,
        resource="subscription_tier",
        resource_id=tier.id,
        details={
            "code": tier.code,
            "display_name": tier.display_name,
            "price_monthly": tier.price_monthly,
        },
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return tier


@admin_router.get("/", response_model=SubscriptionTierListResponse)
def list_tiers(
    include_inactive: bool = Query(False, description="Include inactive tiers"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    List all subscription tiers

    **Super Admin Only**
    """
    service = SubscriptionTierService(db)
    tiers = service.get_all_tiers(include_inactive=include_inactive)
    return SubscriptionTierListResponse(items=tiers, total=len(tiers))


@admin_router.get("/{tier_id}", response_model=SubscriptionTierResponse)
def get_tier(
    tier_id: UUID = Path(..., description="Tier ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get subscription tier by ID

    **Super Admin Only**
    """
    service = SubscriptionTierService(db)
    return service.get_tier_by_id(tier_id)


@admin_router.put("/{tier_id}", response_model=SubscriptionTierResponse)
def update_tier(
    data: SubscriptionTierUpdate,
    request: Request,
    tier_id: UUID = Path(..., description="Tier ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Update subscription tier

    **Super Admin Only**
    """
    service = SubscriptionTierService(db)

    # Get old values before update for audit trail
    old_tier = service.get_tier_by_id(tier_id)
    old_values = {
        "display_name": old_tier.display_name,
        "price_monthly": old_tier.price_monthly,
        "price_yearly": old_tier.price_yearly,
        "max_users": old_tier.max_users,
        "max_branches": old_tier.max_branches,
        "max_storage_gb": old_tier.max_storage_gb,
        "is_public": old_tier.is_public,
        "is_recommended": old_tier.is_recommended,
    }

    tier = service.update_tier(tier_id, data)

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
        action=AuditAction.TIER_UPDATED,
        resource="subscription_tier",
        resource_id=tier.id,
        details={
            "code": tier.code,
            "display_name": tier.display_name,
            "changes": changes,
        },
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return tier


@admin_router.delete("/{tier_id}", status_code=204)
def delete_tier(
    request: Request,
    tier_id: UUID = Path(..., description="Tier ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Delete subscription tier (soft delete)

    **Super Admin Only**

    Note: Cannot delete tiers that are in use by tenants.
    """
    service = SubscriptionTierService(db)
    tier = service.get_tier_by_id(tier_id)
    tier_code = tier.code

    service.delete_tier(tier_id)

    # Log audit
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=None,
        action=AuditAction.TIER_DELETED,
        resource="subscription_tier",
        resource_id=tier_id,
        details={"code": tier_code},
        status=AuditStatus.SUCCESS,
        request=request,
    )

    return None


@admin_router.post("/reorder", response_model=SubscriptionTierListResponse)
def reorder_tiers(
    tier_order: List[UUID],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    Reorder subscription tiers by providing ordered list of tier IDs

    **Super Admin Only**
    """
    service = SubscriptionTierService(db)
    tiers = service.reorder_tiers(tier_order)
    return SubscriptionTierListResponse(items=tiers, total=len(tiers))


# ============================================================================
# PUBLIC ROUTES
# ============================================================================

public_router = APIRouter(prefix="/tiers", tags=["Subscription Tiers (Public)"])


@public_router.get("/", response_model=PublicTierListResponse)
def list_public_tiers(
    db: Session = Depends(get_db),
):
    """
    List public subscription tiers for pricing page

    **Public Endpoint** (no auth required)
    """
    service = SubscriptionTierService(db)
    tiers = service.get_public_tiers()
    return PublicTierListResponse(
        tiers=[PublicTierResponse.from_tier(t) for t in tiers]
    )


@public_router.get("/{code}", response_model=PublicTierResponse)
def get_public_tier(
    code: str = Path(..., description="Tier code"),
    db: Session = Depends(get_db),
):
    """
    Get public tier information by code

    **Public Endpoint** (no auth required)
    """
    service = SubscriptionTierService(db)
    tier = service.get_tier_by_code(code)
    if not tier or not tier.is_public:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(f"Tier '{code}' not found")
    return PublicTierResponse.from_tier(tier)
