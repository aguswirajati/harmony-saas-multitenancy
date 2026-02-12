"""
Payment Service
Business logic for payment methods and upgrade requests
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
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
)
from app.models.tenant import Tenant
from app.models.user import User
from app.models.subscription_tier import SubscriptionTier
from app.schemas.payment import (
    PaymentMethodCreate,
    PaymentMethodUpdate,
    UpgradeRequestCreate,
    UpgradeRequestReview,
    UpgradeRequestStats,
)
from app.core.exceptions import (
    NotFoundException,
    ConflictException,
    BadRequestException,
    ForbiddenException,
)
from app.services.audit_service import AuditService
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

        logger.info(f"Deleted payment method: {method.code}")
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
        """Create a new upgrade request"""
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
                f"You already have a pending upgrade request ({existing.request_number})"
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

        # Validate payment method
        payment_method = self.get_payment_method_by_id(data.payment_method_id)
        if not payment_method.is_public or not payment_method.is_active:
            raise BadRequestException("Selected payment method is not available")

        # Calculate amount
        if data.billing_period == BillingPeriod.YEARLY:
            amount = target_tier.price_yearly
        else:
            amount = target_tier.price_monthly

        # Create snapshot of tier details
        tier_snapshot = json.dumps({
            "max_users": target_tier.max_users,
            "max_branches": target_tier.max_branches,
            "max_storage_gb": target_tier.max_storage_gb,
            "features": target_tier.features,
        })

        upgrade_request = UpgradeRequest(
            tenant_id=tenant_id,
            requested_by_id=user_id,
            current_tier_code=tenant.tier,
            target_tier_code=data.target_tier_code,
            billing_period=data.billing_period,
            amount=amount,
            currency=target_tier.currency,
            tier_snapshot=tier_snapshot,
            payment_method_id=data.payment_method_id,
            expires_at=UpgradeRequest.calculate_expiry(days=3),
        )

        self.db.add(upgrade_request)
        self.db.commit()
        self.db.refresh(upgrade_request)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=user_id,
            tenant_id=tenant_id,
            action=AuditAction.UPGRADE_REQUESTED,
            resource="upgrade_request",
            resource_id=upgrade_request.id,
            details={
                "request_number": upgrade_request.request_number,
                "current_tier": tenant.tier,
                "target_tier": data.target_tier_code,
                "amount": amount,
                "billing_period": data.billing_period,
            },
            status=AuditStatus.SUCCESS,
            request=request,
        )

        logger.info(f"Created upgrade request: {upgrade_request.request_number}")
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

            audit_action = AuditAction.UPGRADE_APPROVED
        else:
            upgrade_request.status = UpgradeRequestStatus.REJECTED
            upgrade_request.rejection_reason = data.rejection_reason
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
        """Apply the tier upgrade to the tenant"""
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

        # Update tenant
        tenant.tier = target_tier.code
        tenant.max_users = target_tier.max_users
        tenant.max_branches = target_tier.max_branches
        tenant.max_storage_gb = target_tier.max_storage_gb

        # Set subscription end date based on billing period
        now = datetime.now(timezone.utc)
        if upgrade_request.billing_period == BillingPeriod.YEARLY:
            tenant.subscription_ends_at = now + timedelta(days=365)
        else:
            tenant.subscription_ends_at = now + timedelta(days=30)

        tenant.subscription_status = "active"

        logger.info(
            f"Applied upgrade for tenant {tenant.subdomain}: "
            f"{upgrade_request.current_tier_code} -> {upgrade_request.target_tier_code}"
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
