from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import BaseModel

class Branch(Base, BaseModel):
    __tablename__ = "branches"

    # Foreign key
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Branch info
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    is_hq = Column(Boolean, default=False)

    # Location
    address = Column(String, nullable=True)
    city = Column(String(100), nullable=True)
    province = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), default='Indonesia')
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)

    # Geolocation
    latitude = Column(Numeric(10, 8), nullable=True)
    longitude = Column(Numeric(11, 8), nullable=True)

    # Settings
    timezone = Column(String(50), default='Asia/Jakarta')
    currency = Column(String(10), default='IDR')
    settings = Column(JSON, default={})

    # Relationships
    tenant = relationship("Tenant", back_populates="branches")
    users = relationship("User", back_populates="default_branch")

    def __repr__(self):
        return f"<Branch {self.name} ({self.code})>"
