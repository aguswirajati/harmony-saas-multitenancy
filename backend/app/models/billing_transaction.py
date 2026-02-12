"""
BillingTransaction model for tracking payment transactions.
Linked to UpgradeRequest for subscription upgrades.
"""
from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.core.database import Base
from app.models.base import TenantScopedModel


class TransactionStatus:
    """Transaction status constants"""
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class BillingTransaction(Base, TenantScopedModel):
    """
    Billing transaction record for payment tracking.

    Each upgrade request creates one billing transaction.
    This provides invoice/receipt functionality.
    """
    __tablename__ = "billing_transactions"

    # Transaction identification
    transaction_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique transaction/invoice number"
    )

    # Link to upgrade request
    upgrade_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("upgrade_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Associated upgrade request"
    )

    # Transaction details (snapshot from upgrade request)
    amount = Column(
        Integer,
        nullable=False,
        comment="Transaction amount"
    )
    currency = Column(
        String(3),
        nullable=False,
        default="IDR",
        comment="Currency code"
    )
    billing_period = Column(
        String(20),
        nullable=False,
        comment="monthly or yearly"
    )

    # Payment method reference
    payment_method_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payment_methods.id", ondelete="SET NULL"),
        nullable=True,
        comment="Payment method used"
    )

    # Status tracking
    status = Column(
        String(50),
        nullable=False,
        default=TransactionStatus.PENDING,
        index=True,
        comment="Transaction status"
    )

    # Dates
    invoice_date = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Invoice generation date"
    )
    paid_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Payment confirmation date"
    )
    cancelled_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Cancellation date"
    )

    # Additional info
    notes = Column(
        Text,
        nullable=True,
        comment="Internal notes"
    )

    # Description for invoice
    description = Column(
        Text,
        nullable=True,
        comment="Line item description"
    )

    # Relationships
    upgrade_request = relationship("UpgradeRequest", back_populates="transaction")
    payment_method = relationship("PaymentMethod")

    def __repr__(self):
        return f"<BillingTransaction {self.transaction_number} ({self.status})>"

    @staticmethod
    def generate_transaction_number() -> str:
        """Generate unique transaction number"""
        date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
        unique_part = uuid.uuid4().hex[:6].upper()
        return f"INV-{date_part}-{unique_part}"

    @property
    def is_pending(self) -> bool:
        return self.status == TransactionStatus.PENDING

    @property
    def is_paid(self) -> bool:
        return self.status == TransactionStatus.PAID

    @property
    def is_cancelled(self) -> bool:
        return self.status == TransactionStatus.CANCELLED

    def mark_as_paid(self) -> None:
        """Mark transaction as paid"""
        self.status = TransactionStatus.PAID
        self.paid_at = datetime.now(timezone.utc)

    def mark_as_cancelled(self) -> None:
        """Mark transaction as cancelled"""
        self.status = TransactionStatus.CANCELLED
        self.cancelled_at = datetime.now(timezone.utc)
