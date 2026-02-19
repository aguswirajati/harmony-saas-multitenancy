"""
User Schemas

Supports two user scopes:
- System Users (tenant_id=NULL): system_role = 'admin' | 'operator'
- Tenant Users (tenant_id=UUID): tenant_role = 'owner' | 'admin' | 'member'
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Literal

from app.core.validators import password_validator, name_validator


class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new tenant user"""
    password: str = Field(..., min_length=8)
    tenant_role: Literal["admin", "member"] = "member"  # Owner created only via registration
    business_role: Optional[str] = None
    default_branch_id: Optional[UUID] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        return password_validator(v)

    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_name(cls, v):
        if v:
            return name_validator(v)
        return v


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    default_branch_id: Optional[UUID] = None
    tenant_role: Optional[Literal["admin", "member"]] = None  # Cannot change to/from owner
    business_role: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_name(cls, v):
        if v:
            return name_validator(v)
        return v


class UserChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        return password_validator(v)


class UserInDB(UserBase):
    """User data as stored in database"""
    id: UUID
    tenant_id: Optional[UUID] = None
    full_name: Optional[str] = None

    # New role columns
    system_role: Optional[str] = None  # 'admin' | 'operator' (for system users)
    tenant_role: Optional[str] = None  # 'owner' | 'admin' | 'member' (for tenant users)
    business_role: Optional[str] = None  # Custom business role

    default_branch_id: Optional[UUID] = None
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None

    # Computed properties for backward compatibility
    @property
    def role(self) -> str:
        """Legacy role property"""
        if self.system_role:
            return f"system_{self.system_role}"
        return self.tenant_role or "member"

    @property
    def is_super_admin(self) -> bool:
        """Legacy super admin check"""
        return self.system_role == "admin"

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """User response schema"""
    id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    tenant_id: Optional[UUID] = None

    # Role information
    system_role: Optional[str] = None
    tenant_role: Optional[str] = None
    business_role: Optional[str] = None

    # Legacy fields (computed)
    role: Optional[str] = None
    is_super_admin: bool = False

    default_branch_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        """Create response from User model with computed fields"""
        return cls(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=user.full_name,
            phone=user.phone,
            tenant_id=user.tenant_id,
            system_role=user.system_role.value if user.system_role else None,
            tenant_role=user.tenant_role.value if user.tenant_role else None,
            business_role=user.business_role,
            role=user.role,  # Computed property
            is_super_admin=user.is_super_admin,  # Computed property
            default_branch_id=user.default_branch_id,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )


class UserWithBranch(UserResponse):
    """User response with branch information"""
    branch_name: Optional[str] = None
    branch_code: Optional[str] = None
    tenant_name: Optional[str] = None
    tenant_subdomain: Optional[str] = None


class UserListResponse(BaseModel):
    """Paginated user list response"""
    users: List[UserWithBranch]
    total: int
    page: int
    page_size: int


# ========================================
# System User Schemas
# ========================================

class SystemUserCreate(BaseModel):
    """Schema for creating a system user (operator)"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    system_role: Literal["operator"] = "operator"  # Admin can only create operators

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        return password_validator(v)


class SystemUserUpdate(BaseModel):
    """Schema for updating a system user"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    system_role: Optional[Literal["admin", "operator"]] = None
    is_active: Optional[bool] = None


# ========================================
# User Invitation Schemas
# ========================================

class UserInviteRequest(BaseModel):
    """Schema for inviting a new user to tenant"""
    email: EmailStr
    tenant_role: Literal["admin", "member"] = "member"
    business_role: Optional[str] = None
    branch_id: Optional[UUID] = None


class AcceptInviteRequest(BaseModel):
    """Schema for accepting an invitation"""
    token: str
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        return password_validator(v)


# ========================================
# Account Management Schemas
# ========================================

class AccountClosureRequest(BaseModel):
    """Schema for account deletion confirmation"""
    confirmation_phrase: str = Field(
        ...,
        description="Must type 'DELETE MY ACCOUNT' to confirm"
    )
    password: str = Field(..., description="Current password for verification")

    @field_validator('confirmation_phrase')
    @classmethod
    def validate_confirmation(cls, v):
        if v != "DELETE MY ACCOUNT":
            raise ValueError("Confirmation phrase must be exactly 'DELETE MY ACCOUNT'")
        return v


class OwnershipTransferRequest(BaseModel):
    """Schema for transferring tenant ownership"""
    new_owner_id: UUID = Field(..., description="User ID of the new owner")
    password: str = Field(..., description="Current owner's password for verification")
