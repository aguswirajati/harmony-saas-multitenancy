"""
PaymentMethod model for manual payment system.
Supports bank transfers and QRIS for Indonesian market.
"""
from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import BaseModel


class PaymentMethodType:
    """Payment method type constants"""
    BANK_TRANSFER = "bank_transfer"
    QRIS = "qris"


class PaymentMethod(Base, BaseModel):
    """
    Payment method configuration for manual payments.

    Supports:
    - Bank transfers (BCA, Mandiri, BNI, etc.)
    - QRIS (Quick Response Code Indonesian Standard)

    This is a system-level model (not tenant-scoped) managed by super admin.
    """
    __tablename__ = "payment_methods"

    # Unique identifier (e.g., "bca", "mandiri", "qris_main")
    code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique payment method code"
    )

    # Display info
    name = Column(
        String(100),
        nullable=False,
        comment="Display name (e.g., 'Bank BCA', 'QRIS')"
    )
    type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Payment type: bank_transfer, qris"
    )

    # Bank transfer details
    bank_name = Column(
        String(100),
        nullable=True,
        comment="Bank name for bank transfer type"
    )
    account_number = Column(
        String(50),
        nullable=True,
        comment="Bank account number"
    )
    account_name = Column(
        String(100),
        nullable=True,
        comment="Bank account holder name"
    )

    # QRIS image (stored in Files table)
    qris_image_file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id", ondelete="SET NULL"),
        nullable=True,
        comment="File ID of QRIS image"
    )

    # Instructions
    instructions = Column(
        Text,
        nullable=True,
        comment="Payment instructions for users"
    )

    # Display settings
    sort_order = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order (lower = first)"
    )
    is_public = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether method is available for selection"
    )

    # Relationships
    qris_image = relationship("File", foreign_keys=[qris_image_file_id])

    def __repr__(self):
        return f"<PaymentMethod {self.code} ({self.name})>"

    @property
    def is_bank_transfer(self) -> bool:
        """Check if this is a bank transfer method"""
        return self.type == PaymentMethodType.BANK_TRANSFER

    @property
    def is_qris(self) -> bool:
        """Check if this is a QRIS method"""
        return self.type == PaymentMethodType.QRIS
