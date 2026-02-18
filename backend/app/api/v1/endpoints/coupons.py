"""
Coupon API endpoints for managing promotional discounts.
Includes admin CRUD operations and tenant-facing validation/redemption.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import math

from app.api.deps import (
    get_db,
    get_current_active_user,
    get_super_admin_user,
    get_tenant_context,
)
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.coupon import (
    CouponCreate,
    CouponUpdate,
    CouponResponse,
    CouponListResponse,
    CouponValidateRequest,
    CouponValidateResponse,
    ApplyCouponRequest,
    ApplyCouponResponse,
    CouponRedemptionResponse,
    CouponRedemptionListResponse,
    CouponStatistics,
    CouponOverviewStats,
)
from app.services.coupon_service import CouponService
from app.models.upgrade_request import UpgradeRequest

router = APIRouter()


# ============== Admin Coupon Management ==============

@router.post("/admin/coupons/", response_model=CouponResponse)
async def create_coupon(
    data: CouponCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Create a new coupon (super admin only)"""
    # Check if code already exists
    existing = CouponService.get_coupon_by_code(db, data.code)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Coupon code '{data.code}' already exists"
        )

    coupon = CouponService.create_coupon(db, data, current_user.id)
    return coupon


@router.get("/admin/coupons/", response_model=CouponListResponse)
async def list_coupons(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = None,
    discount_type: Optional[str] = None,
    include_expired: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """List all coupons with pagination (super admin only)"""
    coupons, total = CouponService.get_coupons(
        db,
        page=page,
        page_size=page_size,
        is_active=is_active,
        discount_type=discount_type,
        include_expired=include_expired
    )

    return CouponListResponse(
        items=coupons,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.get("/admin/coupons/stats", response_model=CouponOverviewStats)
async def get_coupon_overview_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Get overall coupon statistics (super admin only)"""
    return CouponService.get_overview_stats(db)


@router.get("/admin/coupons/{coupon_id}", response_model=CouponResponse)
async def get_coupon(
    coupon_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Get coupon details (super admin only)"""
    coupon = CouponService.get_coupon_by_id(db, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return coupon


@router.get("/admin/coupons/{coupon_id}/stats", response_model=CouponStatistics)
async def get_coupon_stats(
    coupon_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Get statistics for a specific coupon (super admin only)"""
    stats = CouponService.get_coupon_statistics(db, coupon_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return stats


@router.put("/admin/coupons/{coupon_id}", response_model=CouponResponse)
async def update_coupon(
    coupon_id: UUID,
    data: CouponUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Update a coupon (super admin only)"""
    coupon = CouponService.update_coupon(db, coupon_id, data, current_user.id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return coupon


@router.delete("/admin/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Delete a coupon (super admin only)"""
    success = CouponService.delete_coupon(db, coupon_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Coupon deleted successfully"}


@router.get("/admin/coupons/{coupon_id}/redemptions", response_model=CouponRedemptionListResponse)
async def get_coupon_redemptions(
    coupon_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Get redemptions for a specific coupon (super admin only)"""
    from app.models.coupon import CouponRedemption

    coupon = CouponService.get_coupon_by_id(db, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    query = db.query(CouponRedemption).filter(
        CouponRedemption.coupon_id == coupon_id,
        CouponRedemption.is_active == True
    )

    total = query.count()
    redemptions = query.order_by(
        CouponRedemption.applied_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()

    # Enrich with coupon info
    items = []
    for r in redemptions:
        item = CouponRedemptionResponse(
            id=r.id,
            coupon_id=r.coupon_id,
            tenant_id=r.tenant_id,
            upgrade_request_id=r.upgrade_request_id,
            discount_type=r.discount_type,
            discount_value=r.discount_value,
            discount_applied=r.discount_applied,
            applied_at=r.applied_at,
            expires_at=r.expires_at,
            is_expired=r.is_expired,
            coupon_code=coupon.code,
            coupon_name=coupon.name,
            created_at=r.created_at
        )
        items.append(item)

    return CouponRedemptionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


# ============== Tenant-facing Coupon Endpoints ==============

@router.post("/coupons/validate", response_model=CouponValidateResponse)
async def validate_coupon(
    data: CouponValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """Validate a coupon code for the current tenant"""
    return CouponService.validate_coupon(
        db,
        code=data.code,
        tenant_id=tenant.id,
        tier_code=data.tier_code,
        billing_period=data.billing_period,
        amount=data.amount
    )


@router.post("/coupons/apply", response_model=ApplyCouponResponse)
async def apply_coupon(
    data: ApplyCouponRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """Apply a coupon to an upgrade request"""
    # Get the coupon
    coupon = CouponService.get_coupon_by_code(db, data.code)
    if not coupon:
        return ApplyCouponResponse(
            success=False,
            original_amount=0,
            discount_amount=0,
            final_amount=0,
            discount_description="",
            error_message="Coupon not found"
        )

    # Get the upgrade request
    upgrade_request = db.query(UpgradeRequest).filter(
        UpgradeRequest.id == data.upgrade_request_id,
        UpgradeRequest.tenant_id == tenant.id
    ).first()

    if not upgrade_request:
        raise HTTPException(status_code=404, detail="Upgrade request not found")

    if upgrade_request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Can only apply coupons to pending upgrade requests"
        )

    # Validate the coupon
    validation = CouponService.validate_coupon(
        db,
        code=data.code,
        tenant_id=tenant.id,
        tier_code=upgrade_request.target_tier,
        billing_period=upgrade_request.billing_period,
        amount=upgrade_request.amount
    )

    if not validation.valid:
        return ApplyCouponResponse(
            success=False,
            original_amount=upgrade_request.amount,
            discount_amount=0,
            final_amount=upgrade_request.amount,
            discount_description="",
            error_message=validation.error_message
        )

    # Apply the coupon
    redemption, discount_amount, description = CouponService.apply_coupon(
        db,
        coupon_id=coupon.id,
        tenant_id=tenant.id,
        upgrade_request_id=upgrade_request.id,
        original_amount=upgrade_request.amount,
        created_by_id=current_user.id
    )

    if not redemption:
        return ApplyCouponResponse(
            success=False,
            original_amount=upgrade_request.amount,
            discount_amount=0,
            final_amount=upgrade_request.amount,
            discount_description="",
            error_message=description
        )

    # Update the upgrade request with the discount
    final_amount = upgrade_request.amount - discount_amount
    upgrade_request.coupon_code = coupon.code
    upgrade_request.discount_amount = discount_amount
    upgrade_request.final_amount = final_amount
    db.commit()

    return ApplyCouponResponse(
        success=True,
        redemption=CouponRedemptionResponse(
            id=redemption.id,
            coupon_id=redemption.coupon_id,
            tenant_id=redemption.tenant_id,
            upgrade_request_id=redemption.upgrade_request_id,
            discount_type=redemption.discount_type,
            discount_value=redemption.discount_value,
            discount_applied=redemption.discount_applied,
            applied_at=redemption.applied_at,
            expires_at=redemption.expires_at,
            is_expired=redemption.is_expired,
            coupon_code=coupon.code,
            coupon_name=coupon.name,
            created_at=redemption.created_at
        ),
        original_amount=upgrade_request.amount,
        discount_amount=discount_amount,
        final_amount=final_amount,
        discount_description=description
    )


@router.get("/coupons/my-redemptions", response_model=CouponRedemptionListResponse)
async def get_my_redemptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    include_expired: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """Get coupon redemptions for the current tenant"""
    from app.models.coupon import CouponRedemption, Coupon

    redemptions, total = CouponService.get_tenant_redemptions(
        db,
        tenant_id=tenant.id,
        page=page,
        page_size=page_size,
        include_expired=include_expired
    )

    # Enrich with coupon info
    items = []
    for r in redemptions:
        coupon = db.query(Coupon).filter(Coupon.id == r.coupon_id).first()
        item = CouponRedemptionResponse(
            id=r.id,
            coupon_id=r.coupon_id,
            tenant_id=r.tenant_id,
            upgrade_request_id=r.upgrade_request_id,
            discount_type=r.discount_type,
            discount_value=r.discount_value,
            discount_applied=r.discount_applied,
            applied_at=r.applied_at,
            expires_at=r.expires_at,
            is_expired=r.is_expired,
            coupon_code=coupon.code if coupon else None,
            coupon_name=coupon.name if coupon else None,
            created_at=r.created_at
        )
        items.append(item)

    return CouponRedemptionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.get("/coupons/active-discount")
async def get_active_discount(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
):
    """Get currently active discount for the tenant (for recurring billing)"""
    from app.models.coupon import Coupon

    redemption = CouponService.get_active_tenant_discount(db, tenant.id)

    if not redemption:
        return {"has_active_discount": False}

    coupon = db.query(Coupon).filter(Coupon.id == redemption.coupon_id).first()

    return {
        "has_active_discount": True,
        "discount_type": redemption.discount_type,
        "discount_value": float(redemption.discount_value),
        "discount_applied": redemption.discount_applied,
        "coupon_code": coupon.code if coupon else None,
        "coupon_name": coupon.name if coupon else None,
        "expires_at": redemption.expires_at.isoformat() if redemption.expires_at else None
    }
