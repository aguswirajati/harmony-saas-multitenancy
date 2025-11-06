from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role: str = "staff"
    default_branch_id: Optional[UUID] = None

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    default_branch_id: Optional[UUID] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class UserInDB(UserBase):
    id: UUID
    tenant_id: Optional[UUID] = None  # ✅ Fixed
    # ... rest of fields ...
    is_super_admin: Optional[bool] = False  # ✅ Add this too
    full_name: Optional[str]
    role: str
    default_branch_id: Optional[UUID]
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True

class UserResponse(UserInDB):
    pass

class UserWithBranch(UserResponse):
    branch_name: Optional[str] = None
    branch_code: Optional[str] = None

class UserListResponse(BaseModel):
    users: List[UserWithBranch]
    total: int
    page: int
    page_size: int
