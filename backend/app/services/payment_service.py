"""
Payment Service
Business logic for payment methods and upgrade requests
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_ as sa_or
import sqlalchemy as sa
from typing import Optional, List, Tuple
from datetime import datetime, timedelta, timezone
from uuid import UUID
import logging
import json

from app.models.payment_method import PaymentMethod, PaymentMethodType
from app.models.upgrade_request import (
    UpgradeRequest,
    UpgradeRequestStatus,
    BillingPeriod,
    RequestType,
)
from app.models.billing_transaction import BillingTransaction, TransactionStatus, TransactionType
from app.models.tenant import Tenant
from app.models.user import User
from app.models.subscription_tier import SubscriptionTier
from app.schemas.payment import (
    PaymentMethodCreate,
    PaymentMethodUpdate,
    UpgradeRequestCreate,
    UpgradeRequestReview,
    UpgradeRequestStats,
    BillingStats,
    UpgradePreview,
    SubscriptionInfo,
    ScheduledChange,
    TransactionApprove,
    TransactionReject,
    TransactionApplyCoupon,
    TransactionApplyDiscount,
    TransactionAddBonus,
    ManualTransactionCreate,
)
from app.services.coupon_service import CouponService
from app.models.coupon import Coupon, DiscountType
from app.core.exceptions import (
    NotFoundException,
    ConflictException,
    BadRequestException,
    ForbiddenException,
)
from app.services.audit_service import AuditService
from app.services.proration_service import ProrationService
from app.models.audit_log import AuditAction, AuditStatus
from fastapi import Request

logger = logging.getLogger(__name__)


class PaymentService:
    """Service for payment method and upgrade request management"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # PAYMENT METHOD OPERATIONS (Super Admin)
    # ========================================================================

    def create_payment_method(self, data: PaymentMethodCreate) -> PaymentMethod:
        """Create a new payment method"""
        # Check code uniqueness (only among active records)
        existing = self.db.query(PaymentMethod).filter(
            PaymentMethod.code == data.code,
            PaymentMethod.is_active == True
        ).first()
        if existing:
            raise ConflictException(f"Payment method with code '{data.code}' already exists")

        payment_method = PaymentMethod(
            code=data.code,
            name=data.name,
            type=data.type,
            bank_name=data.bank_name,
            account_number=data.account_number,
            account_name=data.account_name,
            wallet_type=data.wallet_type,
            instructions=data.instructions,
            sort_order=data.sort_order,
            is_public=data.is_public,
        )

        self.db.add(payment_method)
        self.db.commit()
        self.db.refresh(payment_method)

        logger.info(f"Created payment method: {payment_method.code}")
        return payment_method

    def get_payment_method_by_id(self, method_id: UUID) -> PaymentMethod:
        """Get payment method by ID"""
        method = self.db.query(PaymentMethod).filter(
            PaymentMethod.id == method_id
        ).first()
        if not method:
            raise NotFoundException(f"Payment method with ID {method_id} not found")
        return method

    def get_all_payment_methods(
        self,
        include_inactive: bool = False
    ) -> List[PaymentMethod]:
        """Get all payment methods (for admin)"""
        query = self.db.query(PaymentMethod)

        if not include_inactive:
            query = query.filter(PaymentMethod.is_active == True)

        return query.order_by(PaymentMethod.sort_order).all()

    def get_public_payment_methods(self) -> List[PaymentMethod]:
        """Get public payment methods for upgrade flow"""
        return self.db.query(PaymentMethod).filter(
            PaymentMethod.is_active == True,
            PaymentMethod.is_public == True
        ).order_by(PaymentMethod.sort_order).all()

    def update_payment_method(
        self,
        method_id: UUID,
        data: PaymentMethodUpdate
    ) -> PaymentMethod:
        """Update payment method"""
        method = self.get_payment_method_by_id(method_id)

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(method, key, value)

        self.db.commit()
        self.db.refresh(method)

        logger.info(f"Updated payment method: {method.code}")
        return method

    def set_qris_image(self, method_id: UUID, file_id: UUID) -> PaymentMethod:
        """Set QRIS image for a payment method"""
        method = self.get_payment_method_by_id(method_id)

        if method.type != PaymentMethodType.QRIS:
            raise BadRequestException("QRIS image can only be set for QRIS payment methods")

        method.qris_image_file_id = file_id

        self.db.commit()
        self.db.refresh(method)

        logger.info(f"Set QRIS image for payment method: {method.code}")
        return method

    def delete_payment_method(self, method_id: UUID) -> bool:
        """Soft delete a payment method"""
        method = self.get_payment_method_by_id(method_id)

        # Check if method is in use by pending requests
        in_use = self.db.query(func.count(UpgradeRequest.id)).filter(
            UpgradeRequest.payment_method_id == method_id,
            UpgradeRequest.status.in_([
                UpgradeRequestStatus.PENDING,
                UpgradeRequestStatus.PAYMENT_UPLOADED,
            ])
        ).scalar() or 0

        if in_use > 0:
            raise ConflictException(
                f"Cannot delete payment method: {in_use} pending request(s) are using it"
            )

        method.is_active = False

        self.db.commit()

        logger.info(f"Soft deleted payment method: {method.code}")
        return True

    def hard_delete_payment_method(self, method_id: UUID) -> bool:
        """
        Permanently delete a payment method (DEV_MODE only).
        Only works on inactive (soft-deleted) records.
        """
        method = self.db.query(PaymentMethod).filter(
            PaymentMethod.id == method_id
        ).first()

        if not method:
            raise NotFoundException(f"Payment method with ID {method_id} not found")

        if method.is_active:
            raise BadRequestException(
                "Cannot permanently delete an active payment method. "
                "Soft delete it first."
            )

        # Check if method is referenced by any upgrade requests
        in_use = self.db.query(func.count(UpgradeRequest.id)).filter(
            UpgradeRequest.payment_method_id == method_id
        ).scalar() or 0

        if in_use > 0:
            raise ConflictException(
                f"Cannot permanently delete: {in_use} upgrade request(s) reference this method"
            )

        code = method.code
        self.db.delete(method)
        self.db.commit()

        logger.info(f"Permanently deleted payment method: {code}")
        return True

    # ========================================================================
    # UPGRADE REQUEST OPERATIONS (Tenant)
    # ========================================================================

    def create_upgrade_request(
        self,
        tenant_id: UUID,
        user_id: UUID,
        data: UpgradeRequestCreate,
        request: Request = None,
    ) -> UpgradeRequest:
        """
        Create a new upgrade or downgrade request.

        For upgrades: Calculates prorated charge, requires payment
        For downgrades: Schedules for end of period, no payment required
        """
        # Get tenant
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise NotFoundException(f"Tenant with ID {tenant_id} not found")

        # Check for existing pending request
        existing = self.db.query(UpgradeRequest).filter(
            UpgradeRequest.tenant_id == tenant_id,
            UpgradeRequest.status.in_([
                UpgradeRequestStatus.PENDING,
                UpgradeRequestStatus.PAYMENT_UPLOADED,
                UpgradeRequestStatus.UNDER_REVIEW,
            ])
        ).first()
        if existing:
            raise ConflictException(
                f"You already have a pending request ({existing.request_number})"
            )

        # Validate target tier exists and is different
        target_tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.code == data.target_tier_code,
            SubscriptionTier.is_active == True
        ).first()
        if not target_tier:
            raise NotFoundException(f"Tier '{data.target_tier_code}' not found")

        if tenant.tier == data.target_tier_code:
            raise BadRequestException("Target tier is the same as current tier")

        # Get current tier for price comparison
        current_tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.code == tenant.tier,
            SubscriptionTier.is_active == True
        ).first()

        # Calculate tier prices for the billing period
        if data.billing_period == BillingPeriod.YEARLY:
            current_price = current_tier.price_yearly if current_tier else 0
            target_price = target_tier.price_yearly
        else:
            current_price = current_tier.price_monthly if current_tier else 0
            target_price = target_tier.price_monthly

        # Determine if this is an upgrade or downgrade
        is_upgrade = ProrationService.is_upgrade(current_price, target_price)

        if is_upgrade:
            return self._create_upgrade_request(
                tenant=tenant,
                user_id=user_id,
                data=data,
                target_tier=target_tier,
                current_tier=current_tier,
                current_price=current_price,
                target_price=target_price,
                request=request,
            )
        else:
            return self._create_downgrade_request(
                tenant=tenant,
                user_id=user_id,
                data=data,
                target_tier=target_tier,
                current_tier=current_tier,
                current_price=current_price,
                target_price=target_price,
                request=request,
            )

    def _create_upgrade_request(
        self,
        tenant: Tenant,
        user_id: UUID,
        data: UpgradeRequestCreate,
        target_tier: SubscriptionTier,
        current_tier: Optional[SubscriptionTier],
        current_price: int,
        target_price: int,
        request: Request = None,
    ) -> UpgradeRequest:
        """Create an upgrade request with proration."""
        # Validate payment method is required for upgrades
        if not data.payment_method_id:
            raise BadRequestException("Payment method is required for upgrades")

        payment_method = self.get_payment_method_by_id(data.payment_method_id)
        if not payment_method.is_public or not payment_method.is_active:
            raise BadRequestException("Selected payment method is not available")

        # Calculate proration
        proration = ProrationService.calculate_upgrade_proration(
            current_tier_price=current_price,
            new_tier_price=target_price,
            billing_period=data.billing_period,
            subscription_ends_at=tenant.subscription_ends_at,
            credit_balance=tenant.credit_balance or 0,
        )

        # Create snapshot of tier details
        tier_snapshot = json.dumps({
            "max_users": target_tier.max_users,
            "max_branches": target_tier.max_branches,
            "max_storage_gb": target_tier.max_storage_gb,
            "features": target_tier.features,
        })

        now = datetime.now(timezone.utc)

        upgrade_request = UpgradeRequest(
            tenant_id=tenant.id,
            requested_by_id=user_id,
            request_type=RequestType.UPGRADE,
            current_tier_code=tenant.tier,
            target_tier_code=data.target_tier_code,
            billing_period=data.billing_period,
            amount=proration.amount_due,  # Prorated amount to pay
            original_amount=proration.original_amount,
            proration_credit=proration.proration_credit,
            proration_charge=proration.proration_charge,
            days_remaining=proration.days_remaining,
            currency=target_tier.currency,
            tier_snapshot=tier_snapshot,
            payment_method_id=data.payment_method_id,
            effective_date=now,  # Immediate for upgrades
            expires_at=UpgradeRequest.calculate_expiry(days=3),
        )

        self.db.add(upgrade_request)
        self.db.flush()

        # Create billing transaction with proration details
        transaction = BillingTransaction(
            tenant_id=tenant.id,
            transaction_number=BillingTransaction.generate_transaction_number(),
            upgrade_request_id=upgrade_request.id,
            transaction_type=TransactionType.UPGRADE,
            amount=proration.amount_due,
            original_amount=proration.original_amount,
            credit_applied=proration.credit_to_apply,
            currency=target_tier.currency,
            billing_period=data.billing_period,
            payment_method_id=data.payment_method_id,
            status=TransactionStatus.PENDING,
            description=f"Upgrade: {tenant.tier} → {data.target_tier_code} ({data.billing_period})",
            proration_details=ProrationService.format_proration_details(proration),
            period_start=tenant.subscription_started_at,
            period_end=tenant.subscription_ends_at,
        )
        self.db.add(transaction)

        self.db.commit()
        self.db.refresh(upgrade_request)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=user_id,
            tenant_id=tenant.id,
            action=AuditAction.UPGRADE_REQUESTED,
            resource="upgrade_request",
            resource_id=upgrade_request.id,
            details={
                "request_number": upgrade_request.request_number,
                "transaction_number": transaction.transaction_number,
                "request_type": "upgrade",
                "current_tier": tenant.tier,
                "target_tier": data.target_tier_code,
                "amount_due": proration.amount_due,
                "proration_credit": proration.proration_credit,
                "proration_charge": proration.proration_charge,
                "days_remaining": proration.days_remaining,
                "billing_period": data.billing_period,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Created upgrade request: {upgrade_request.request_number}")
        return upgrade_request

    def _create_downgrade_request(
        self,
        tenant: Tenant,
        user_id: UUID,
        data: UpgradeRequestCreate,
        target_tier: SubscriptionTier,
        current_tier: Optional[SubscriptionTier],
        current_price: int,
        target_price: int,
        request: Request = None,
    ) -> UpgradeRequest:
        """Create a downgrade request scheduled for end of period."""
        # Calculate proration (for reference, no payment required)
        proration = ProrationService.calculate_downgrade_proration(
            current_tier_price=current_price,
            new_tier_price=target_price,
            billing_period=data.billing_period,
            subscription_ends_at=tenant.subscription_ends_at,
        )

        # Effective date is end of current billing period
        effective_date = tenant.subscription_ends_at or datetime.now(timezone.utc)

        # Create snapshot of tier details
        tier_snapshot = json.dumps({
            "max_users": target_tier.max_users,
            "max_branches": target_tier.max_branches,
            "max_storage_gb": target_tier.max_storage_gb,
            "features": target_tier.features,
        })

        # For downgrades, we auto-approve immediately (no payment needed)
        upgrade_request = UpgradeRequest(
            tenant_id=tenant.id,
            requested_by_id=user_id,
            request_type=RequestType.DOWNGRADE,
            current_tier_code=tenant.tier,
            target_tier_code=data.target_tier_code,
            billing_period=data.billing_period,
            amount=0,  # No payment required for downgrade
            original_amount=proration.original_amount,
            proration_credit=proration.proration_credit,
            proration_charge=0,
            days_remaining=proration.days_remaining,
            currency=target_tier.currency,
            tier_snapshot=tier_snapshot,
            payment_method_id=data.payment_method_id,  # Optional for downgrades
            effective_date=effective_date,
            status=UpgradeRequestStatus.APPROVED,  # Auto-approved
            applied_at=datetime.now(timezone.utc),
        )

        self.db.add(upgrade_request)
        self.db.flush()

        # Schedule the tier change on the tenant
        tenant.scheduled_tier_code = data.target_tier_code
        tenant.scheduled_tier_effective_at = effective_date

        # Create billing transaction for record keeping
        transaction = BillingTransaction(
            tenant_id=tenant.id,
            transaction_number=BillingTransaction.generate_transaction_number(),
            upgrade_request_id=upgrade_request.id,
            transaction_type=TransactionType.DOWNGRADE,
            amount=0,
            original_amount=proration.original_amount,
            credit_applied=0,
            credit_generated=0,  # Could optionally generate credit
            currency=target_tier.currency,
            billing_period=data.billing_period,
            payment_method_id=data.payment_method_id,
            status=TransactionStatus.PAID,  # No payment needed
            description=f"Downgrade scheduled: {tenant.tier} → {data.target_tier_code} (effective {effective_date.strftime('%Y-%m-%d')})",
            proration_details=ProrationService.format_proration_details(proration),
            period_start=tenant.subscription_started_at,
            period_end=tenant.subscription_ends_at,
            paid_at=datetime.now(timezone.utc),
        )
        self.db.add(transaction)

        self.db.commit()
        self.db.refresh(upgrade_request)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=user_id,
            tenant_id=tenant.id,
            action=AuditAction.UPGRADE_REQUESTED,
            resource="upgrade_request",
            resource_id=upgrade_request.id,
            details={
                "request_number": upgrade_request.request_number,
                "transaction_number": transaction.transaction_number,
                "request_type": "downgrade",
                "current_tier": tenant.tier,
                "target_tier": data.target_tier_code,
                "effective_date": effective_date.isoformat(),
                "days_remaining": proration.days_remaining,
                "billing_period": data.billing_period,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Created downgrade request: {upgrade_request.request_number} (scheduled for {effective_date})")
        return upgrade_request

    def get_upgrade_request_by_id(
        self,
        request_id: UUID,
        tenant_id: UUID = None
    ) -> UpgradeRequest:
        """Get upgrade request by ID, optionally filtered by tenant"""
        query = self.db.query(UpgradeRequest).filter(
            UpgradeRequest.id == request_id
        )
        if tenant_id:
            query = query.filter(UpgradeRequest.tenant_id == tenant_id)

        upgrade_request = query.first()
        if not upgrade_request:
            raise NotFoundException(f"Upgrade request with ID {request_id} not found")
        return upgrade_request

    def get_tenant_upgrade_requests(
        self,
        tenant_id: UUID,
        status: Optional[str] = None
    ) -> List[UpgradeRequest]:
        """Get all upgrade requests for a tenant"""
        query = self.db.query(UpgradeRequest).filter(
            UpgradeRequest.tenant_id == tenant_id
        )

        if status:
            query = query.filter(UpgradeRequest.status == status)

        return query.order_by(UpgradeRequest.created_at.desc()).all()

    def upload_payment_proof(
        self,
        request_id: UUID,
        tenant_id: UUID,
        file_id: UUID,
        user_id: UUID,
        request: Request = None,
    ) -> UpgradeRequest:
        """Upload payment proof for an upgrade request"""
        upgrade_request = self.get_upgrade_request_by_id(request_id, tenant_id)

        if not upgrade_request.can_upload_proof:
            raise BadRequestException(
                f"Cannot upload proof for request in status '{upgrade_request.status}'"
            )

        # Check if expired
        if upgrade_request.is_expired:
            upgrade_request.status = UpgradeRequestStatus.EXPIRED
            self.db.commit()
            raise BadRequestException("This upgrade request has expired")

        upgrade_request.payment_proof_file_id = file_id
        upgrade_request.payment_proof_uploaded_at = datetime.now(timezone.utc)
        upgrade_request.status = UpgradeRequestStatus.PAYMENT_UPLOADED

        self.db.commit()
        self.db.refresh(upgrade_request)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=user_id,
            tenant_id=tenant_id,
            action=AuditAction.UPGRADE_PROOF_UPLOADED,
            resource="upgrade_request",
            resource_id=upgrade_request.id,
            details={
                "request_number": upgrade_request.request_number,
                "file_id": str(file_id),
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Payment proof uploaded for: {upgrade_request.request_number}")
        return upgrade_request

    def cancel_upgrade_request(
        self,
        request_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        request: Request = None,
    ) -> UpgradeRequest:
        """Cancel an upgrade request"""
        upgrade_request = self.get_upgrade_request_by_id(request_id, tenant_id)

        if not upgrade_request.can_cancel:
            raise BadRequestException(
                f"Cannot cancel request in status '{upgrade_request.status}'"
            )

        upgrade_request.status = UpgradeRequestStatus.CANCELLED

        # Mark transaction as cancelled
        if upgrade_request.transaction:
            upgrade_request.transaction.mark_as_cancelled()

        self.db.commit()
        self.db.refresh(upgrade_request)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=user_id,
            tenant_id=tenant_id,
            action=AuditAction.UPGRADE_CANCELLED,
            resource="upgrade_request",
            resource_id=upgrade_request.id,
            details={"request_number": upgrade_request.request_number},
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Upgrade request cancelled: {upgrade_request.request_number}")
        return upgrade_request

    def update_upgrade_request(
        self,
        request_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        target_tier_code: str,
        billing_period: str,
        payment_method_id: UUID,
        request: Request = None,
    ) -> UpgradeRequest:
        """Update an existing pending upgrade request"""
        upgrade_request = self.get_upgrade_request_by_id(request_id, tenant_id)

        if upgrade_request.status != UpgradeRequestStatus.PENDING:
            raise BadRequestException(
                f"Cannot edit request in status '{upgrade_request.status}'"
            )

        # Validate target tier exists and is different from current
        target_tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.code == target_tier_code,
            SubscriptionTier.is_active == True
        ).first()
        if not target_tier:
            raise NotFoundException(f"Tier '{target_tier_code}' not found")

        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant.tier == target_tier_code:
            raise BadRequestException("Target tier is the same as current tier")

        # Validate payment method
        payment_method = self.get_payment_method_by_id(payment_method_id)
        if not payment_method.is_public or not payment_method.is_active:
            raise BadRequestException("Selected payment method is not available")

        # Calculate amount
        if billing_period == BillingPeriod.YEARLY:
            amount = target_tier.price_yearly
        else:
            amount = target_tier.price_monthly

        # Update request
        upgrade_request.target_tier_code = target_tier_code
        upgrade_request.billing_period = billing_period
        upgrade_request.amount = amount
        upgrade_request.currency = target_tier.currency
        upgrade_request.payment_method_id = payment_method_id

        # Update transaction
        if upgrade_request.transaction:
            upgrade_request.transaction.amount = amount
            upgrade_request.transaction.currency = target_tier.currency
            upgrade_request.transaction.billing_period = billing_period
            upgrade_request.transaction.payment_method_id = payment_method_id
            upgrade_request.transaction.description = f"Upgrade from {tenant.tier} to {target_tier_code} ({billing_period})"

        self.db.commit()
        self.db.refresh(upgrade_request)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=user_id,
            tenant_id=tenant_id,
            action=AuditAction.UPGRADE_UPDATED,
            resource="upgrade_request",
            resource_id=upgrade_request.id,
            details={
                "request_number": upgrade_request.request_number,
                "target_tier": target_tier_code,
                "amount": amount,
                "billing_period": billing_period,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Updated upgrade request: {upgrade_request.request_number}")
        return upgrade_request

    # ========================================================================
    # UPGRADE REQUEST OPERATIONS (Super Admin)
    # ========================================================================

    def get_all_upgrade_requests(
        self,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[UpgradeRequest], int]:
        """Get all upgrade requests (for admin)"""
        query = self.db.query(UpgradeRequest)

        if status:
            query = query.filter(UpgradeRequest.status == status)

        total = query.count()
        requests = query.order_by(
            UpgradeRequest.created_at.desc()
        ).offset(skip).limit(limit).all()

        return requests, total

    def review_upgrade_request(
        self,
        request_id: UUID,
        reviewer_id: UUID,
        data: UpgradeRequestReview,
        request: Request = None,
    ) -> UpgradeRequest:
        """Review (approve/reject) an upgrade request"""
        upgrade_request = self.get_upgrade_request_by_id(request_id)

        if not upgrade_request.can_review:
            raise BadRequestException(
                f"Cannot review request in status '{upgrade_request.status}'"
            )

        upgrade_request.reviewed_by_id = reviewer_id
        upgrade_request.reviewed_at = datetime.now(timezone.utc)
        upgrade_request.review_notes = data.notes

        if data.action == "approve":
            upgrade_request.status = UpgradeRequestStatus.APPROVED
            upgrade_request.applied_at = datetime.now(timezone.utc)

            # Apply the upgrade
            self._apply_upgrade(upgrade_request)

            # Mark transaction as paid
            if upgrade_request.transaction:
                upgrade_request.transaction.mark_as_paid()

            audit_action = AuditAction.UPGRADE_APPROVED
        else:
            upgrade_request.status = UpgradeRequestStatus.REJECTED
            upgrade_request.rejection_reason = data.rejection_reason

            # Mark transaction as cancelled
            if upgrade_request.transaction:
                upgrade_request.transaction.mark_as_cancelled()

            audit_action = AuditAction.UPGRADE_REJECTED

        self.db.commit()
        self.db.refresh(upgrade_request)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=reviewer_id,
            tenant_id=upgrade_request.tenant_id,
            action=audit_action,
            resource="upgrade_request",
            resource_id=upgrade_request.id,
            details={
                "request_number": upgrade_request.request_number,
                "action": data.action,
                "target_tier": upgrade_request.target_tier_code,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(
            f"Upgrade request {data.action}d: {upgrade_request.request_number}"
        )
        return upgrade_request

    def _apply_upgrade(self, upgrade_request: UpgradeRequest) -> None:
        """
        Apply the tier upgrade to the tenant.

        For mid-cycle upgrades, we keep the same subscription end date
        but update the tier and limits immediately.
        """
        tenant = self.db.query(Tenant).filter(
            Tenant.id == upgrade_request.tenant_id
        ).first()
        if not tenant:
            raise NotFoundException("Tenant not found")

        target_tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.code == upgrade_request.target_tier_code,
            SubscriptionTier.is_active == True
        ).first()
        if not target_tier:
            raise NotFoundException("Target tier not found")

        now = datetime.now(timezone.utc)

        # Update tenant tier and limits
        tenant.tier = target_tier.code
        tenant.max_users = target_tier.max_users
        tenant.max_branches = target_tier.max_branches
        tenant.max_storage_gb = target_tier.max_storage_gb

        # Apply credit balance reduction if credits were used
        if upgrade_request.transaction and upgrade_request.transaction.credit_applied > 0:
            tenant.credit_balance = max(
                0,
                (tenant.credit_balance or 0) - upgrade_request.transaction.credit_applied
            )

        # For mid-cycle upgrades, keep the same end date (proration covers the difference)
        # Only set new end date if no existing subscription
        if not tenant.subscription_ends_at or tenant.subscription_ends_at < now:
            # New subscription or expired - set full period
            if upgrade_request.billing_period == BillingPeriod.YEARLY:
                tenant.subscription_ends_at = now + timedelta(days=365)
            else:
                tenant.subscription_ends_at = now + timedelta(days=30)
            tenant.subscription_started_at = now
        # Else: Keep existing end date (proration covers the remaining days)

        # Update billing period
        tenant.billing_period = upgrade_request.billing_period
        tenant.subscription_status = "active"

        # Clear any scheduled changes (upgrade overrides scheduled downgrade)
        tenant.clear_scheduled_change()

        # Update transaction period dates with the actual subscription period
        if upgrade_request.transaction:
            upgrade_request.transaction.period_start = tenant.subscription_started_at

            # Apply bonus days from transaction to subscription end date
            bonus_days = upgrade_request.transaction.bonus_days or 0
            if bonus_days > 0:
                tenant.subscription_ends_at = tenant.subscription_ends_at + timedelta(days=bonus_days)
                logger.info(f"Applied {bonus_days} bonus days to tenant {tenant.subdomain}")

            upgrade_request.transaction.period_end = tenant.subscription_ends_at

        logger.info(
            f"Applied upgrade for tenant {tenant.subdomain}: "
            f"{upgrade_request.current_tier_code} -> {upgrade_request.target_tier_code}"
        )

    def apply_scheduled_downgrades(self) -> int:
        """
        Apply scheduled tier downgrades that have reached their effective date.

        This should be called by a cron job or scheduled task.
        Returns the number of downgrades applied.
        """
        now = datetime.now(timezone.utc)

        tenants_to_downgrade = self.db.query(Tenant).filter(
            Tenant.scheduled_tier_code.isnot(None),
            Tenant.scheduled_tier_effective_at <= now,
            Tenant.is_active == True,
        ).all()

        count = 0
        for tenant in tenants_to_downgrade:
            try:
                self._apply_scheduled_downgrade(tenant)
                count += 1
            except Exception as e:
                logger.error(f"Failed to apply scheduled downgrade for tenant {tenant.subdomain}: {e}")

        if count > 0:
            self.db.commit()
            logger.info(f"Applied {count} scheduled downgrades")

        return count

    def _apply_scheduled_downgrade(self, tenant: Tenant) -> None:
        """Apply a scheduled downgrade to a tenant."""
        if not tenant.scheduled_tier_code:
            return

        target_tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.code == tenant.scheduled_tier_code,
            SubscriptionTier.is_active == True
        ).first()

        if not target_tier:
            logger.warning(
                f"Scheduled tier {tenant.scheduled_tier_code} not found for tenant {tenant.subdomain}"
            )
            tenant.clear_scheduled_change()
            return

        old_tier = tenant.tier
        now = datetime.now(timezone.utc)

        # Apply the downgrade
        tenant.tier = target_tier.code
        tenant.max_users = target_tier.max_users
        tenant.max_branches = target_tier.max_branches
        tenant.max_storage_gb = target_tier.max_storage_gb

        # Start a new billing period
        tenant.subscription_started_at = now
        if tenant.billing_period == BillingPeriod.YEARLY:
            tenant.subscription_ends_at = now + timedelta(days=365)
        else:
            tenant.subscription_ends_at = now + timedelta(days=30)

        # Clear the scheduled change
        tenant.clear_scheduled_change()

        logger.info(
            f"Applied scheduled downgrade for tenant {tenant.subdomain}: "
            f"{old_tier} -> {target_tier.code}"
        )

    # ========================================================================
    # STATISTICS
    # ========================================================================

    def get_upgrade_request_stats(self) -> UpgradeRequestStats:
        """Get upgrade request statistics for admin dashboard"""
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        pending_count = self.db.query(func.count(UpgradeRequest.id)).filter(
            UpgradeRequest.status == UpgradeRequestStatus.PENDING
        ).scalar() or 0

        payment_uploaded_count = self.db.query(func.count(UpgradeRequest.id)).filter(
            UpgradeRequest.status == UpgradeRequestStatus.PAYMENT_UPLOADED
        ).scalar() or 0

        under_review_count = self.db.query(func.count(UpgradeRequest.id)).filter(
            UpgradeRequest.status == UpgradeRequestStatus.UNDER_REVIEW
        ).scalar() or 0

        approved_this_month = self.db.query(func.count(UpgradeRequest.id)).filter(
            UpgradeRequest.status == UpgradeRequestStatus.APPROVED,
            UpgradeRequest.applied_at >= month_start
        ).scalar() or 0

        rejected_this_month = self.db.query(func.count(UpgradeRequest.id)).filter(
            UpgradeRequest.status == UpgradeRequestStatus.REJECTED,
            UpgradeRequest.reviewed_at >= month_start
        ).scalar() or 0

        total_revenue = self.db.query(func.sum(UpgradeRequest.amount)).filter(
            UpgradeRequest.status == UpgradeRequestStatus.APPROVED,
            UpgradeRequest.applied_at >= month_start
        ).scalar() or 0

        return UpgradeRequestStats(
            pending_count=pending_count,
            payment_uploaded_count=payment_uploaded_count,
            under_review_count=under_review_count,
            approved_this_month=approved_this_month,
            rejected_this_month=rejected_this_month,
            total_revenue_this_month=total_revenue,
            currency="IDR",
        )

    def get_pending_count(self) -> int:
        """Get count of requests awaiting review"""
        return self.db.query(func.count(UpgradeRequest.id)).filter(
            UpgradeRequest.status == UpgradeRequestStatus.PAYMENT_UPLOADED
        ).scalar() or 0

    # ========================================================================
    # SUBSCRIPTION INFO
    # ========================================================================

    def get_subscription_info(self, tenant_id: UUID) -> SubscriptionInfo:
        """Get subscription information for a tenant"""
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise NotFoundException(f"Tenant with ID {tenant_id} not found")

        # Get tier name
        tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.code == tenant.tier,
            SubscriptionTier.is_active == True
        ).first()
        tier_name = tier.display_name if tier else tenant.tier

        # Calculate days remaining
        days_remaining = ProrationService.calculate_days_remaining(
            tenant.subscription_ends_at
        )

        # Get scheduled change info
        scheduled_change = None
        if tenant.scheduled_tier_code:
            scheduled_tier = self.db.query(SubscriptionTier).filter(
                SubscriptionTier.code == tenant.scheduled_tier_code,
                SubscriptionTier.is_active == True
            ).first()

            days_until = 0
            if tenant.scheduled_tier_effective_at:
                days_until = ProrationService.calculate_days_remaining(
                    tenant.scheduled_tier_effective_at
                )

            scheduled_change = ScheduledChange(
                tier_code=tenant.scheduled_tier_code,
                tier_name=scheduled_tier.display_name if scheduled_tier else tenant.scheduled_tier_code,
                effective_at=tenant.scheduled_tier_effective_at,
                days_until=days_until,
            )

        return SubscriptionInfo(
            tier_code=tenant.tier,
            tier_name=tier_name,
            billing_period=tenant.billing_period or "monthly",
            subscription_started_at=tenant.subscription_started_at,
            subscription_ends_at=tenant.subscription_ends_at,
            days_remaining=days_remaining,
            credit_balance=tenant.credit_balance or 0,
            scheduled_change=scheduled_change,
        )

    def cancel_scheduled_downgrade(
        self,
        tenant_id: UUID,
        user_id: UUID,
        request: Request = None,
    ) -> Tenant:
        """Cancel a scheduled downgrade for a tenant"""
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise NotFoundException(f"Tenant with ID {tenant_id} not found")

        if not tenant.scheduled_tier_code:
            raise BadRequestException("No scheduled tier change to cancel")

        old_scheduled_tier = tenant.scheduled_tier_code
        tenant.clear_scheduled_change()

        self.db.commit()
        self.db.refresh(tenant)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=user_id,
            tenant_id=tenant_id,
            action=AuditAction.UPGRADE_CANCELLED,
            resource="tenant",
            resource_id=tenant_id,
            details={
                "action": "cancel_scheduled_downgrade",
                "cancelled_tier": old_scheduled_tier,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Cancelled scheduled downgrade for tenant {tenant.subdomain}")
        return tenant

    # ========================================================================
    # BILLING TRANSACTIONS
    # ========================================================================

    def get_billing_stats(self) -> BillingStats:
        """Get billing statistics for admin dashboard"""
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Total revenue (all paid transactions)
        total_revenue = self.db.query(func.sum(BillingTransaction.amount)).filter(
            BillingTransaction.status == TransactionStatus.PAID,
            BillingTransaction.is_active == True,
        ).scalar() or 0

        # Revenue this month
        total_revenue_this_month = self.db.query(func.sum(BillingTransaction.amount)).filter(
            BillingTransaction.status == TransactionStatus.PAID,
            BillingTransaction.paid_at >= month_start,
            BillingTransaction.is_active == True,
        ).scalar() or 0

        # Pending amount
        pending_amount = self.db.query(func.sum(BillingTransaction.amount)).filter(
            BillingTransaction.status == TransactionStatus.PENDING,
            BillingTransaction.is_active == True,
        ).scalar() or 0

        # Credits issued
        credits_issued = self.db.query(func.sum(BillingTransaction.credit_generated)).filter(
            BillingTransaction.is_active == True,
        ).scalar() or 0

        # Transaction counts
        transaction_count = self.db.query(func.count(BillingTransaction.id)).filter(
            BillingTransaction.is_active == True,
        ).scalar() or 0

        paid_count = self.db.query(func.count(BillingTransaction.id)).filter(
            BillingTransaction.status == TransactionStatus.PAID,
            BillingTransaction.is_active == True,
        ).scalar() or 0

        pending_count = self.db.query(func.count(BillingTransaction.id)).filter(
            BillingTransaction.status == TransactionStatus.PENDING,
            BillingTransaction.is_active == True,
        ).scalar() or 0

        return BillingStats(
            total_revenue=total_revenue,
            total_revenue_this_month=total_revenue_this_month,
            pending_amount=pending_amount,
            credits_issued=credits_issued,
            transaction_count=transaction_count,
            paid_count=paid_count,
            pending_count=pending_count,
            currency="IDR",
        )

    def get_all_billing_transactions(
        self,
        status: Optional[str] = None,
        transaction_type: Optional[str] = None,
        tenant_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[BillingTransaction], int]:
        """Get all billing transactions (for admin)"""
        query = self.db.query(BillingTransaction).filter(
            BillingTransaction.is_active == True
        )

        if status:
            query = query.filter(BillingTransaction.status == status)
        if transaction_type:
            query = query.filter(BillingTransaction.transaction_type == transaction_type)
        if tenant_id:
            query = query.filter(BillingTransaction.tenant_id == tenant_id)

        total = query.count()
        transactions = query.order_by(
            BillingTransaction.created_at.desc()
        ).offset(skip).limit(limit).all()

        return transactions, total

    def get_billing_transaction_by_id(
        self,
        transaction_id: UUID,
        tenant_id: UUID = None
    ) -> BillingTransaction:
        """Get billing transaction by ID"""
        query = self.db.query(BillingTransaction).filter(
            BillingTransaction.id == transaction_id
        )
        if tenant_id:
            query = query.filter(BillingTransaction.tenant_id == tenant_id)

        transaction = query.first()
        if not transaction:
            raise NotFoundException(f"Transaction with ID {transaction_id} not found")
        return transaction

    def get_tenant_billing_transactions(
        self,
        tenant_id: UUID,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[BillingTransaction], int]:
        """Get billing transactions for a specific tenant"""
        query = self.db.query(BillingTransaction).filter(
            BillingTransaction.tenant_id == tenant_id,
            BillingTransaction.is_active == True,
        )

        if status:
            query = query.filter(BillingTransaction.status == status)

        total = query.count()
        transactions = query.order_by(
            BillingTransaction.created_at.desc()
        ).offset(skip).limit(limit).all()

        return transactions, total

    # ========================================================================
    # TRANSACTION MANAGEMENT (Command Center)
    # ========================================================================

    def approve_transaction(
        self,
        transaction_id: UUID,
        admin_id: UUID,
        data: TransactionApprove,
        request: Request = None,
    ) -> BillingTransaction:
        """
        Approve a transaction and its linked upgrade request.
        This triggers the tier upgrade/downgrade.
        """
        transaction = self.get_billing_transaction_by_id(transaction_id)

        if transaction.status != TransactionStatus.PENDING:
            raise BadRequestException(
                f"Cannot approve transaction in status '{transaction.status}'"
            )

        # If linked to an upgrade request, use the existing review logic
        if transaction.upgrade_request:
            upgrade_request = transaction.upgrade_request

            if not upgrade_request.can_review:
                raise BadRequestException(
                    f"Cannot approve: upgrade request is in status '{upgrade_request.status}'"
                )

            # Apply the upgrade request logic
            review_data = UpgradeRequestReview(action="approve", notes=data.notes)
            self.review_upgrade_request(
                request_id=upgrade_request.id,
                reviewer_id=admin_id,
                data=review_data,
                request=request,
            )

            # Refresh transaction
            self.db.refresh(transaction)
        else:
            # Standalone transaction - just mark as paid
            transaction.mark_as_paid()
            transaction.admin_notes = data.notes
            transaction.adjusted_by_id = admin_id
            transaction.adjusted_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(transaction)

            # Log audit
            AuditService.log_action(
                db=self.db,
                user_id=admin_id,
                tenant_id=transaction.tenant_id,
                action=AuditAction.BILLING_TRANSACTION_APPROVED,
                resource="billing_transaction",
                resource_id=transaction.id,
                details={
                    "transaction_number": transaction.transaction_number,
                    "amount": transaction.amount,
                },
                status=AuditStatus.SUCCESS,
                request=request,
            )

        logger.info(f"Transaction approved: {transaction.transaction_number}")
        return transaction

    def reject_transaction(
        self,
        transaction_id: UUID,
        admin_id: UUID,
        data: TransactionReject,
        request: Request = None,
    ) -> BillingTransaction:
        """
        Reject a transaction and its linked upgrade request.
        """
        transaction = self.get_billing_transaction_by_id(transaction_id)

        if transaction.status != TransactionStatus.PENDING:
            raise BadRequestException(
                f"Cannot reject transaction in status '{transaction.status}'"
            )

        # If linked to an upgrade request, use the existing review logic
        if transaction.upgrade_request:
            upgrade_request = transaction.upgrade_request

            if not upgrade_request.can_review:
                raise BadRequestException(
                    f"Cannot reject: upgrade request is in status '{upgrade_request.status}'"
                )

            # Apply the reject logic
            review_data = UpgradeRequestReview(
                action="reject",
                notes=data.notes,
                rejection_reason=data.rejection_reason
            )
            self.review_upgrade_request(
                request_id=upgrade_request.id,
                reviewer_id=admin_id,
                data=review_data,
                request=request,
            )

            # Refresh transaction
            self.db.refresh(transaction)
        else:
            # Standalone transaction
            transaction.mark_as_rejected(
                rejected_by_id=admin_id,
                reason=data.rejection_reason
            )
            transaction.admin_notes = data.notes

            self.db.commit()
            self.db.refresh(transaction)

            # Log audit
            AuditService.log_action(
                db=self.db,
                user_id=admin_id,
                tenant_id=transaction.tenant_id,
                action=AuditAction.BILLING_TRANSACTION_REJECTED,
                resource="billing_transaction",
                resource_id=transaction.id,
                details={
                    "transaction_number": transaction.transaction_number,
                    "rejection_reason": data.rejection_reason,
                },
                status=AuditStatus.SUCCESS,
                request=request,
            )

        logger.info(f"Transaction rejected: {transaction.transaction_number}")
        return transaction

    def apply_coupon_to_transaction(
        self,
        transaction_id: UUID,
        admin_id: UUID,
        data: TransactionApplyCoupon,
        request: Request = None,
    ) -> BillingTransaction:
        """
        Apply a coupon to a pending transaction.
        Recalculates the transaction amount.
        """
        transaction = self.get_billing_transaction_by_id(transaction_id)

        if transaction.status != TransactionStatus.PENDING:
            raise BadRequestException(
                f"Cannot apply coupon to transaction in status '{transaction.status}'"
            )

        if transaction.coupon_id:
            raise BadRequestException("Transaction already has a coupon applied")

        # Validate the coupon
        validation = CouponService.validate_coupon(
            db=self.db,
            code=data.coupon_code,
            tenant_id=transaction.tenant_id,
            amount=transaction.amount,
        )

        if not validation.valid:
            raise BadRequestException(validation.error_message)

        coupon = validation.coupon
        discount_amount = validation.discount_amount or 0

        # Apply coupon to transaction
        transaction.coupon_id = coupon.id
        transaction.coupon_code = coupon.code
        transaction.discount_amount = discount_amount
        transaction.discount_description = validation.discount_description
        transaction.admin_notes = (
            f"{transaction.admin_notes or ''}\n[Coupon applied by admin: {coupon.code}]"
        ).strip()
        transaction.adjusted_by_id = admin_id
        transaction.adjusted_at = datetime.now(timezone.utc)

        # Recalculate amount
        transaction.amount = max(0, transaction.original_amount - transaction.credit_applied - discount_amount)

        # If linked to upgrade request, update it too
        if transaction.upgrade_request:
            transaction.upgrade_request.coupon_code = coupon.code
            transaction.upgrade_request.discount_amount = discount_amount
            transaction.upgrade_request.final_amount = transaction.amount

        # Create coupon redemption record
        CouponService.apply_coupon(
            db=self.db,
            coupon_id=coupon.id,
            tenant_id=transaction.tenant_id,
            upgrade_request_id=transaction.upgrade_request_id,
            original_amount=transaction.original_amount,
            created_by_id=admin_id,
        )

        self.db.commit()
        self.db.refresh(transaction)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=admin_id,
            tenant_id=transaction.tenant_id,
            action=AuditAction.COUPON_APPLIED,
            resource="billing_transaction",
            resource_id=transaction.id,
            details={
                "transaction_number": transaction.transaction_number,
                "coupon_code": coupon.code,
                "discount_amount": discount_amount,
                "new_amount": transaction.amount,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Coupon {coupon.code} applied to transaction: {transaction.transaction_number}")
        return transaction

    def apply_discount_to_transaction(
        self,
        transaction_id: UUID,
        admin_id: UUID,
        data: TransactionApplyDiscount,
        request: Request = None,
    ) -> BillingTransaction:
        """
        Apply a manual discount to a pending transaction.
        """
        transaction = self.get_billing_transaction_by_id(transaction_id)

        if transaction.status != TransactionStatus.PENDING:
            raise BadRequestException(
                f"Cannot apply discount to transaction in status '{transaction.status}'"
            )

        # Calculate discount
        if data.discount_type == "percentage":
            if data.discount_value > 100:
                raise BadRequestException("Percentage discount cannot exceed 100%")
            discount_amount = int(transaction.original_amount * data.discount_value / 100)
            discount_desc = f"{data.discount_value}% manual discount"
        else:
            discount_amount = min(data.discount_value, transaction.original_amount)
            discount_desc = f"Manual discount: {transaction.currency} {data.discount_value}"

        if data.description:
            discount_desc = data.description

        # Apply discount
        transaction.discount_amount = discount_amount
        transaction.discount_description = discount_desc
        transaction.admin_notes = (
            f"{transaction.admin_notes or ''}\n[Manual discount by admin: {discount_desc}]"
        ).strip()
        transaction.adjusted_by_id = admin_id
        transaction.adjusted_at = datetime.now(timezone.utc)

        # Recalculate amount
        transaction.amount = max(0, transaction.original_amount - transaction.credit_applied - discount_amount)

        # Update linked upgrade request if exists
        if transaction.upgrade_request:
            transaction.upgrade_request.discount_amount = discount_amount
            transaction.upgrade_request.final_amount = transaction.amount

        self.db.commit()
        self.db.refresh(transaction)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=admin_id,
            tenant_id=transaction.tenant_id,
            action=AuditAction.DISCOUNT_APPLIED,
            resource="billing_transaction",
            resource_id=transaction.id,
            details={
                "transaction_number": transaction.transaction_number,
                "discount_type": data.discount_type,
                "discount_value": data.discount_value,
                "discount_amount": discount_amount,
                "new_amount": transaction.amount,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Manual discount applied to transaction: {transaction.transaction_number}")
        return transaction

    def add_bonus_days_to_transaction(
        self,
        transaction_id: UUID,
        admin_id: UUID,
        data: TransactionAddBonus,
        request: Request = None,
    ) -> BillingTransaction:
        """
        Add bonus days to a transaction (applied when transaction is approved).
        """
        transaction = self.get_billing_transaction_by_id(transaction_id)

        if transaction.status not in [TransactionStatus.PENDING, TransactionStatus.PAID]:
            raise BadRequestException(
                f"Cannot add bonus to transaction in status '{transaction.status}'"
            )

        transaction.bonus_days = (transaction.bonus_days or 0) + data.bonus_days
        transaction.admin_notes = (
            f"{transaction.admin_notes or ''}\n[Bonus {data.bonus_days} days added: {data.reason or 'Admin bonus'}]"
        ).strip()
        transaction.adjusted_by_id = admin_id
        transaction.adjusted_at = datetime.now(timezone.utc)

        # Update transaction period_end to include bonus days
        if transaction.period_end:
            transaction.period_end = transaction.period_end + timedelta(days=data.bonus_days)

        # If transaction is already paid, apply bonus immediately to tenant
        if transaction.status == TransactionStatus.PAID:
            tenant = self.db.query(Tenant).filter(Tenant.id == transaction.tenant_id).first()
            if tenant and tenant.subscription_ends_at:
                tenant.subscription_ends_at = tenant.subscription_ends_at + timedelta(days=data.bonus_days)
                logger.info(f"Bonus {data.bonus_days} days applied to tenant {tenant.subdomain}")

        self.db.commit()
        self.db.refresh(transaction)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=admin_id,
            tenant_id=transaction.tenant_id,
            action=AuditAction.BONUS_DAYS_ADDED,
            resource="billing_transaction",
            resource_id=transaction.id,
            details={
                "transaction_number": transaction.transaction_number,
                "bonus_days": data.bonus_days,
                "reason": data.reason,
                "total_bonus_days": transaction.bonus_days,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Bonus {data.bonus_days} days added to transaction: {transaction.transaction_number}")
        return transaction

    def add_note_to_transaction(
        self,
        transaction_id: UUID,
        admin_id: UUID,
        notes: str,
        request: Request = None,
    ) -> BillingTransaction:
        """
        Add admin notes to a transaction.
        """
        transaction = self.get_billing_transaction_by_id(transaction_id)

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        transaction.admin_notes = (
            f"{transaction.admin_notes or ''}\n[{timestamp}] {notes}"
        ).strip()
        transaction.adjusted_by_id = admin_id
        transaction.adjusted_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(transaction)

        logger.info(f"Note added to transaction: {transaction.transaction_number}")
        return transaction

    def create_manual_transaction(
        self,
        admin_id: UUID,
        data: ManualTransactionCreate,
        request: Request = None,
    ) -> BillingTransaction:
        """
        Create a manual transaction (without upgrade request).
        Used for credits, extensions, promos, refunds, etc.
        """
        # Verify tenant exists
        tenant = self.db.query(Tenant).filter(Tenant.id == data.tenant_id).first()
        if not tenant:
            raise NotFoundException(f"Tenant with ID {data.tenant_id} not found")

        now = datetime.now(timezone.utc)

        # Create transaction
        transaction = BillingTransaction(
            tenant_id=data.tenant_id,
            transaction_number=BillingTransaction.generate_transaction_number(),
            transaction_type=data.transaction_type,
            amount=data.amount,
            original_amount=data.amount,
            currency=data.currency,
            billing_period=tenant.billing_period or "monthly",
            description=data.description,
            discount_amount=data.discount_amount or 0,
            bonus_days=data.bonus_days or 0,
            admin_notes=data.notes,
            adjusted_by_id=admin_id,
            adjusted_at=now,
            status=TransactionStatus.PAID,  # Manual transactions are immediately applied
            paid_at=now,
            invoice_date=now,
        )

        self.db.add(transaction)
        self.db.flush()

        # Apply effects based on transaction type
        if data.transaction_type == TransactionType.CREDIT_ADJUSTMENT and data.credit_adjustment:
            tenant.credit_balance = (tenant.credit_balance or 0) + data.credit_adjustment
            transaction.credit_generated = abs(data.credit_adjustment) if data.credit_adjustment > 0 else 0
            logger.info(f"Credit adjusted by {data.credit_adjustment} for tenant {tenant.subdomain}")

        elif data.transaction_type == TransactionType.EXTENSION and data.bonus_days:
            if tenant.subscription_ends_at:
                tenant.subscription_ends_at = tenant.subscription_ends_at + timedelta(days=data.bonus_days)
            else:
                tenant.subscription_ends_at = now + timedelta(days=data.bonus_days)
            logger.info(f"Subscription extended by {data.bonus_days} days for tenant {tenant.subdomain}")

        elif data.transaction_type == TransactionType.REFUND:
            # Refund creates credit balance
            tenant.credit_balance = (tenant.credit_balance or 0) + data.amount
            transaction.credit_generated = data.amount
            logger.info(f"Refund of {data.amount} issued to tenant {tenant.subdomain}")

        self.db.commit()
        self.db.refresh(transaction)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=admin_id,
            tenant_id=data.tenant_id,
            action=AuditAction.MANUAL_TRANSACTION_CREATED,
            resource="billing_transaction",
            resource_id=transaction.id,
            details={
                "transaction_number": transaction.transaction_number,
                "transaction_type": data.transaction_type,
                "amount": data.amount,
                "description": data.description,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Manual transaction created: {transaction.transaction_number}")
        return transaction

    def get_transactions_requiring_review(
        self,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[BillingTransaction], int]:
        """Get transactions that require admin review (pending with payment proof)."""
        query = self.db.query(BillingTransaction).join(
            UpgradeRequest,
            BillingTransaction.upgrade_request_id == UpgradeRequest.id,
            isouter=True
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.status == TransactionStatus.PENDING,
            # Either standalone pending or has payment proof
            sa_or(
                BillingTransaction.upgrade_request_id.is_(None),
                UpgradeRequest.status == UpgradeRequestStatus.PAYMENT_UPLOADED
            )
        )

        total = query.count()
        transactions = query.order_by(
            BillingTransaction.created_at.asc()  # Oldest first
        ).offset(skip).limit(limit).all()

        return transactions, total

    def get_requires_review_count(self) -> int:
        """Get count of transactions requiring review."""
        return self.db.query(func.count(BillingTransaction.id)).join(
            UpgradeRequest,
            BillingTransaction.upgrade_request_id == UpgradeRequest.id,
            isouter=True
        ).filter(
            BillingTransaction.is_active == True,
            BillingTransaction.status == TransactionStatus.PENDING,
            sa_or(
                BillingTransaction.upgrade_request_id.is_(None),
                UpgradeRequest.status == UpgradeRequestStatus.PAYMENT_UPLOADED
            )
        ).scalar() or 0
