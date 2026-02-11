from sqlalchemy import Column, String, Integer, BigInteger, JSON, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import BaseModel

class Tenant(Base, BaseModel):
    __tablename__ = "tenants"

    # Basic info
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=True, index=True)
    subdomain = Column(String(100), unique=True, nullable=False, index=True)
    domain = Column(String(255), unique=True, nullable=True)

    # Subscription
    tier = Column(String(50), default='free', nullable=False)  # free, basic, premium, enterprise
    subscription_status = Column(String(50), default='active')
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    subscription_ends_at = Column(DateTime(timezone=True), nullable=True)

    # Limits based on tier
    max_users = Column(Integer, default=5)
    max_branches = Column(Integer, default=1)
    max_storage_gb = Column(Integer, default=1)

    # Feature flags & settings
    features = Column(JSON, default={})
    settings = Column(JSON, default={})
    meta_data = Column(JSON, default={})

    logo_url = Column(String, nullable=True)

    # Storage tracking
    storage_used_bytes = Column(BigInteger, default=0, nullable=False,
                               comment="Current storage usage in bytes")

    # Relationships
    branches = relationship("Branch", back_populates="tenant", cascade="all, delete-orphan")
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Tenant {self.name} ({self.subdomain})>"
