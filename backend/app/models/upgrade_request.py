"""
UpgradeRequest model for tracking manual subscription upgrade requests.
Implements a multi-step workflow: pending → payment_uploaded → under_review → approved/rejected
"""
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta, timezone
from app.core.database import Base
from app.models.base import TenantScopedModel
import uuid as uuid_lib


class UpgradeRequestStatus:
    """Upgrade request status constants"""
    PENDING = "pending"                    # Request created, awaiting payment
    PAYMENT_UPLOADED = "payment_uploaded"  # Payment proof uploaded, awaiting review
    UNDER_REVIEW = "under_review"          # Admin reviewing the request
    APPROVED = "approved"                  # Request approved, tier upgraded
    REJECTED = "rejected"                  # Request rejected
    CANCELLED = "cancelled"                # Cancelled by tenant
    EXPIRED = "expired"                    # Payment not received in time


class BillingPeriod:
    """Billing period constants"""
    MONTHLY = "monthly"
    YEARLY = "yearly"


def generate_request_number() -> str:
    """Generate a unique request number"""
    now = datetime.now(timezone.utc)
    random_suffix = uuid_lib.uuid4().hex[:6].upper()
    return f"UPG-{now.strftime('%Y%m%d')}-{random_suffix}"


class UpgradeRequest(Base, TenantScopedModel):
    """
    Upgrade request model for tracking manual subscription changes.

    Workflow:
    1. Tenant admin creates upgrade request (status: pending)
    2. System shows payment instructions (bank/QRIS)
    3. Tenant uploads payment proof (status: payment_uploaded)
    4. Super admin reviews and approves/rejects
    5. On approval, tenant tier is automatically upgraded
    """
    __tablename__ = "upgrade_requests"

    # Request identification
    request_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        default=generate_request_number,
        comment="Human-readable request number (e.g., UPG-20260212-ABC123)"
    )

    # Tier change
    current_tier_code = Column(
        String(50),
        nullable=False,
        comment="Tier code at time of request"
    )
    target_tier_code = Column(
        String(50),
        nullable=False,
        comment="Requested target tier code"
    )

    # Pricing snapshot (captured at request time)
    billing_period = Column(
        String(20),
        nullable=False,
        default=BillingPeriod.MONTHLY,
        comment="Billing period: monthly or yearly"
    )
    amount = Column(
        Integer,
        nullable=False,
        comment="Amount to be paid in smallest currency unit"
    )
    currency = Column(
        String(3),
        default="IDR",
        nullable=False,
        comment="ISO 4217 currency code"
    )

    # Snapshot of tier details for historical record
    tier_snapshot = Column(
        Text,
        nullable=True,
        comment="JSON snapshot of target tier limits at request time"
    )

    # Payment method
    payment_method_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payment_methods.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Selected payment method"
    )

    # Payment proof
    payment_proof_file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id", ondelete="SET NULL"),
        nullable=True,
        comment="File ID of payment proof image"
    )
    payment_proof_uploaded_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When payment proof was uploaded"
    )

    # Status workflow
    status = Column(
        String(50),
        default=UpgradeRequestStatus.PENDING,
        nullable=False,
        index=True,
        comment="Request status"
    )

    # Review info
    reviewed_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Super admin who reviewed the request"
    )
    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the request was reviewed"
    )
    review_notes = Column(
        Text,
        nullable=True,
        comment="Internal notes from reviewer"
    )
    rejection_reason = Column(
        Text,
        nullable=True,
        comment="Reason shown to tenant if rejected"
    )

    # Timing
    expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the request expires if no payment received"
    )
    applied_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the tier upgrade was applied"
    )

    # Requestor tracking (created_by_id is inherited, but we add explicit FK)
    requested_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User who created the request"
    )

    # Relationships
    payment_method = relationship("PaymentMethod", foreign_keys=[payment_method_id])
    payment_proof = relationship("File", foreign_keys=[payment_proof_file_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    requested_by = relationship("User", foreign_keys=[requested_by_id])

    # Composite indexes for common queries
    __table_args__ = (
        Index("ix_upgrade_requests_tenant_status", "tenant_id", "status"),
        Index("ix_upgrade_requests_status_created", "status", "created_at"),
        Index("ix_upgrade_requests_tenant_created", "tenant_id", "created_at"),
    )

    def __repr__(self):
        return f"<UpgradeRequest {self.request_number} ({self.status})>"

    @property
    def is_pending(self) -> bool:
        """Check if request is awaiting action"""
        return self.status in [
            UpgradeRequestStatus.PENDING,
            UpgradeRequestStatus.PAYMENT_UPLOADED
        ]

    @property
    def is_completed(self) -> bool:
        """Check if request has reached final status"""
        return self.status in [
            UpgradeRequestStatus.APPROVED,
            UpgradeRequestStatus.REJECTED,
            UpgradeRequestStatus.CANCELLED,
            UpgradeRequestStatus.EXPIRED
        ]

    @property
    def can_upload_proof(self) -> bool:
        """Check if payment proof can be uploaded"""
        return self.status == UpgradeRequestStatus.PENDING

    @property
    def can_cancel(self) -> bool:
        """Check if request can be cancelled"""
        return self.status in [
            UpgradeRequestStatus.PENDING,
            UpgradeRequestStatus.PAYMENT_UPLOADED
        ]

    @property
    def can_review(self) -> bool:
        """Check if request can be reviewed by admin"""
        return self.status == UpgradeRequestStatus.PAYMENT_UPLOADED

    @property
    def is_expired(self) -> bool:
        """Check if request has expired"""
        if self.expires_at and self.status == UpgradeRequestStatus.PENDING:
            return datetime.now(timezone.utc) > self.expires_at
        return False

    @classmethod
    def calculate_expiry(cls, days: int = 3) -> datetime:
        """Calculate expiry date for new request"""
        return datetime.now(timezone.utc) + timedelta(days=days)
