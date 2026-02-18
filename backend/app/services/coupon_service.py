"""
Coupon Service for managing promotional discounts.
Handles coupon validation, application, and redemption tracking.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple
from uuid import UUID
from decimal import Decimal

from app.models.coupon import Coupon, CouponRedemption, DiscountType
from app.models.tenant import Tenant
from app.models.upgrade_request import UpgradeRequest
from app.schemas.coupon import (
    CouponCreate,
    CouponUpdate,
    CouponValidateResponse,
    CouponStatistics,
    CouponOverviewStats,
)


class CouponService:
    """Service for coupon management and validation"""

    @staticmethod
    def create_coupon(
        db: Session,
        data: CouponCreate,
        created_by_id: Optional[UUID] = None
    ) -> Coupon:
        """Create a new coupon"""
        coupon = Coupon(
            code=data.code.upper(),
            name=data.name,
            description=data.description,
            discount_type=data.discount_type,
            discount_value=data.discount_value,
            currency=data.currency,
            max_redemptions=data.max_redemptions,
            max_redemptions_per_tenant=data.max_redemptions_per_tenant,
            valid_for_tiers=data.valid_for_tiers,
            valid_for_billing_periods=data.valid_for_billing_periods,
            valid_from=data.valid_from,
            valid_until=data.valid_until,
            first_time_only=data.first_time_only,
            new_customers_only=data.new_customers_only,
            duration_months=data.duration_months,
            minimum_amount=data.minimum_amount,
            created_by_id=created_by_id,
        )
        db.add(coupon)
        db.commit()
        db.refresh(coupon)
        return coupon

    @staticmethod
    def get_coupon_by_id(db: Session, coupon_id: UUID) -> Optional[Coupon]:
        """Get coupon by ID"""
        return db.query(Coupon).filter(
            Coupon.id == coupon_id,
            Coupon.is_active == True,
            Coupon.deleted_at.is_(None)
        ).first()

    @staticmethod
    def get_coupon_by_code(db: Session, code: str) -> Optional[Coupon]:
        """Get coupon by code"""
        return db.query(Coupon).filter(
            Coupon.code == code.upper(),
            Coupon.is_active == True,
            Coupon.deleted_at.is_(None)
        ).first()

    @staticmethod
    def get_coupons(
        db: Session,
        page: int = 1,
        page_size: int = 20,
        is_active: Optional[bool] = None,
        discount_type: Optional[str] = None,
        include_expired: bool = False
    ) -> Tuple[List[Coupon], int]:
        """Get paginated list of coupons"""
        query = db.query(Coupon).filter(Coupon.deleted_at.is_(None))

        if is_active is not None:
            query = query.filter(Coupon.is_active == is_active)

        if discount_type:
            query = query.filter(Coupon.discount_type == discount_type)

        if not include_expired:
            now = datetime.now(timezone.utc)
            query = query.filter(
                (Coupon.valid_until.is_(None)) | (Coupon.valid_until > now)
            )

        total = query.count()
        coupons = query.order_by(Coupon.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return coupons, total

    @staticmethod
    def update_coupon(
        db: Session,
        coupon_id: UUID,
        data: CouponUpdate,
        updated_by_id: Optional[UUID] = None
    ) -> Optional[Coupon]:
        """Update a coupon"""
        coupon = CouponService.get_coupon_by_id(db, coupon_id)
        if not coupon:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(coupon, field, value)

        coupon.updated_by_id = updated_by_id
        coupon.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(coupon)
        return coupon

    @staticmethod
    def delete_coupon(
        db: Session,
        coupon_id: UUID,
        deleted_by_id: Optional[UUID] = None
    ) -> bool:
        """Soft delete a coupon"""
        coupon = CouponService.get_coupon_by_id(db, coupon_id)
        if not coupon:
            return False

        coupon.is_active = False
        coupon.deleted_at = datetime.now(timezone.utc)
        coupon.deleted_by_id = deleted_by_id
        db.commit()
        return True

    @staticmethod
    def validate_coupon(
        db: Session,
        code: str,
        tenant_id: UUID,
        tier_code: Optional[str] = None,
        billing_period: Optional[str] = None,
        amount: Optional[int] = None
    ) -> CouponValidateResponse:
        """
        Validate a coupon code for a tenant.
        Returns validation result with discount details.
        """
        coupon = CouponService.get_coupon_by_code(db, code)

        if not coupon:
            return CouponValidateResponse(
                valid=False,
                error_message="Coupon code not found"
            )

        # Check if coupon is valid (active, not expired, not maxed out)
        if not coupon.is_valid:
            if coupon.is_expired:
                return CouponValidateResponse(
                    valid=False,
                    error_message="This coupon has expired"
                )
            if coupon.is_maxed_out:
                return CouponValidateResponse(
                    valid=False,
                    error_message="This coupon has reached its maximum redemptions"
                )
            return CouponValidateResponse(
                valid=False,
                error_message="This coupon is not currently valid"
            )

        # Check tier restriction
        if tier_code and not coupon.is_valid_for_tier(tier_code):
            return CouponValidateResponse(
                valid=False,
                error_message=f"This coupon is not valid for the {tier_code} tier"
            )

        # Check billing period restriction
        if billing_period and not coupon.is_valid_for_billing_period(billing_period):
            return CouponValidateResponse(
                valid=False,
                error_message=f"This coupon is not valid for {billing_period} billing"
            )

        # Check minimum amount
        if coupon.minimum_amount and amount and amount < coupon.minimum_amount:
            return CouponValidateResponse(
                valid=False,
                error_message=f"Minimum purchase of {coupon.minimum_amount} required"
            )

        # Check tenant redemption limit
        tenant_redemptions = db.query(CouponRedemption).filter(
            CouponRedemption.coupon_id == coupon.id,
            CouponRedemption.tenant_id == tenant_id,
            CouponRedemption.is_active == True
        ).count()

        if tenant_redemptions >= coupon.max_redemptions_per_tenant:
            return CouponValidateResponse(
                valid=False,
                error_message="You have already used this coupon"
            )

        # Check first_time_only restriction
        if coupon.first_time_only:
            existing_subscriptions = db.query(UpgradeRequest).filter(
                UpgradeRequest.tenant_id == tenant_id,
                UpgradeRequest.status == "approved"
            ).count()
            if existing_subscriptions > 0:
                return CouponValidateResponse(
                    valid=False,
                    error_message="This coupon is only valid for first-time subscriptions"
                )

        # Check new_customers_only restriction
        if coupon.new_customers_only:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if tenant:
                # Consider tenant "new" if created within last 30 days
                cutoff = datetime.now(timezone.utc) - timedelta(days=30)
                if tenant.created_at < cutoff:
                    return CouponValidateResponse(
                        valid=False,
                        error_message="This coupon is only valid for new customers"
                    )

        # Calculate discount amount
        discount_amount = None
        discount_description = None

        if amount:
            if coupon.discount_type == DiscountType.PERCENTAGE:
                discount_amount = int(amount * float(coupon.discount_value) / 100)
                discount_description = f"{coupon.discount_value}% off"
            elif coupon.discount_type == DiscountType.FIXED_AMOUNT:
                discount_amount = min(int(coupon.discount_value), amount)
                discount_description = f"{coupon.currency} {coupon.discount_value} off"
            elif coupon.discount_type == DiscountType.TRIAL_EXTENSION:
                discount_amount = 0
                discount_description = f"{int(coupon.discount_value)} extra trial days"
        else:
            if coupon.discount_type == DiscountType.PERCENTAGE:
                discount_description = f"{coupon.discount_value}% off"
            elif coupon.discount_type == DiscountType.FIXED_AMOUNT:
                discount_description = f"{coupon.currency} {coupon.discount_value} off"
            elif coupon.discount_type == DiscountType.TRIAL_EXTENSION:
                discount_description = f"{int(coupon.discount_value)} extra trial days"

        return CouponValidateResponse(
            valid=True,
            coupon=coupon,
            discount_amount=discount_amount,
            discount_description=discount_description
        )

    @staticmethod
    def apply_coupon(
        db: Session,
        coupon_id: UUID,
        tenant_id: UUID,
        upgrade_request_id: UUID,
        original_amount: int,
        created_by_id: Optional[UUID] = None
    ) -> Tuple[Optional[CouponRedemption], int, str]:
        """
        Apply a coupon to an upgrade request.
        Returns: (redemption, discount_amount, description)
        """
        coupon = CouponService.get_coupon_by_id(db, coupon_id)
        if not coupon:
            return None, 0, "Coupon not found"

        # Calculate discount
        discount_amount = 0
        description = ""

        if coupon.discount_type == DiscountType.PERCENTAGE:
            discount_amount = int(original_amount * float(coupon.discount_value) / 100)
            description = f"{coupon.discount_value}% discount"
        elif coupon.discount_type == DiscountType.FIXED_AMOUNT:
            discount_amount = min(int(coupon.discount_value), original_amount)
            description = f"{coupon.currency} {coupon.discount_value} discount"
        elif coupon.discount_type == DiscountType.TRIAL_EXTENSION:
            discount_amount = 0
            description = f"{int(coupon.discount_value)} extra trial days"

        # Calculate expiration for duration-based coupons
        expires_at = None
        if coupon.duration_months:
            expires_at = datetime.now(timezone.utc) + timedelta(days=coupon.duration_months * 30)

        # Create redemption record
        redemption = CouponRedemption(
            coupon_id=coupon.id,
            tenant_id=tenant_id,
            upgrade_request_id=upgrade_request_id,
            discount_type=coupon.discount_type,
            discount_value=coupon.discount_value,
            discount_applied=discount_amount,
            expires_at=expires_at,
            created_by_id=created_by_id,
        )
        db.add(redemption)

        # Increment coupon redemption count
        coupon.increment_redemption()

        db.commit()
        db.refresh(redemption)

        return redemption, discount_amount, description

    @staticmethod
    def get_tenant_redemptions(
        db: Session,
        tenant_id: UUID,
        page: int = 1,
        page_size: int = 20,
        include_expired: bool = False
    ) -> Tuple[List[CouponRedemption], int]:
        """Get coupon redemptions for a tenant"""
        query = db.query(CouponRedemption).filter(
            CouponRedemption.tenant_id == tenant_id,
            CouponRedemption.is_active == True
        )

        if not include_expired:
            query = query.filter(CouponRedemption.is_expired == False)

        total = query.count()
        redemptions = query.order_by(
            CouponRedemption.applied_at.desc()
        ).offset((page - 1) * page_size).limit(page_size).all()

        return redemptions, total

    @staticmethod
    def get_active_tenant_discount(
        db: Session,
        tenant_id: UUID
    ) -> Optional[CouponRedemption]:
        """Get currently active discount for a tenant (for recurring billing)"""
        now = datetime.now(timezone.utc)
        return db.query(CouponRedemption).filter(
            CouponRedemption.tenant_id == tenant_id,
            CouponRedemption.is_active == True,
            CouponRedemption.is_expired == False,
            (CouponRedemption.expires_at.is_(None)) | (CouponRedemption.expires_at > now)
        ).first()

    @staticmethod
    def expire_redemption(
        db: Session,
        redemption_id: UUID
    ) -> bool:
        """Mark a redemption as expired"""
        redemption = db.query(CouponRedemption).filter(
            CouponRedemption.id == redemption_id
        ).first()

        if not redemption:
            return False

        redemption.mark_expired()
        db.commit()
        return True

    @staticmethod
    def get_coupon_statistics(
        db: Session,
        coupon_id: UUID
    ) -> Optional[CouponStatistics]:
        """Get statistics for a single coupon"""
        coupon = CouponService.get_coupon_by_id(db, coupon_id)
        if not coupon:
            return None

        redemptions = db.query(CouponRedemption).filter(
            CouponRedemption.coupon_id == coupon_id,
            CouponRedemption.is_active == True
        )

        total_redemptions = redemptions.count()
        total_discount = db.query(
            func.coalesce(func.sum(CouponRedemption.discount_applied), 0)
        ).filter(
            CouponRedemption.coupon_id == coupon_id,
            CouponRedemption.is_active == True
        ).scalar()

        unique_tenants = db.query(
            func.count(func.distinct(CouponRedemption.tenant_id))
        ).filter(
            CouponRedemption.coupon_id == coupon_id,
            CouponRedemption.is_active == True
        ).scalar()

        active_redemptions = redemptions.filter(
            CouponRedemption.is_expired == False
        ).count()

        expired_redemptions = redemptions.filter(
            CouponRedemption.is_expired == True
        ).count()

        return CouponStatistics(
            coupon_id=coupon.id,
            code=coupon.code,
            name=coupon.name,
            total_redemptions=total_redemptions,
            total_discount_given=int(total_discount or 0),
            unique_tenants=unique_tenants or 0,
            active_redemptions=active_redemptions,
            expired_redemptions=expired_redemptions
        )

    @staticmethod
    def get_overview_stats(db: Session) -> CouponOverviewStats:
        """Get overall coupon statistics"""
        now = datetime.now(timezone.utc)

        total_coupons = db.query(Coupon).filter(
            Coupon.deleted_at.is_(None)
        ).count()

        active_coupons = db.query(Coupon).filter(
            Coupon.is_active == True,
            Coupon.deleted_at.is_(None),
            (Coupon.valid_until.is_(None)) | (Coupon.valid_until > now)
        ).count()

        expired_coupons = db.query(Coupon).filter(
            Coupon.deleted_at.is_(None),
            Coupon.valid_until.isnot(None),
            Coupon.valid_until <= now
        ).count()

        total_redemptions = db.query(CouponRedemption).filter(
            CouponRedemption.is_active == True
        ).count()

        total_discount_given = db.query(
            func.coalesce(func.sum(CouponRedemption.discount_applied), 0)
        ).filter(
            CouponRedemption.is_active == True
        ).scalar()

        # Get top 5 coupons by redemption count
        top_coupon_ids = db.query(
            CouponRedemption.coupon_id,
            func.count(CouponRedemption.id).label('count')
        ).filter(
            CouponRedemption.is_active == True
        ).group_by(
            CouponRedemption.coupon_id
        ).order_by(
            func.count(CouponRedemption.id).desc()
        ).limit(5).all()

        top_coupons = []
        for coupon_id, _ in top_coupon_ids:
            stats = CouponService.get_coupon_statistics(db, coupon_id)
            if stats:
                top_coupons.append(stats)

        return CouponOverviewStats(
            total_coupons=total_coupons,
            active_coupons=active_coupons,
            expired_coupons=expired_coupons,
            total_redemptions=total_redemptions,
            total_discount_given=int(total_discount_given or 0),
            top_coupons=top_coupons
        )
