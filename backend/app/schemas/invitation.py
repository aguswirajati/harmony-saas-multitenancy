"""
User Invitation Schemas

Supports inviting users with tenant roles (admin, member).
Owner role is not available for invitation - owners are created via registration.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from uuid import UUID


class InviteUserRequest(BaseModel):
    """Request schema for inviting a user to a tenant"""
    email: EmailStr
    tenant_role: Literal["admin", "member"] = "member"  # Owner not allowed
    business_role: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    default_branch_id: Optional[UUID] = None

    # Legacy field for backward compatibility
    role: Optional[str] = None  # Will be ignored if tenant_role is set


class InviteUserResponse(BaseModel):
    """Response schema for user invitation"""
    message: str
    email: str
    tenant_role: str
    business_role: Optional[str] = None


class AcceptInviteRequest(BaseModel):
    """Request schema for accepting an invitation"""
    token: str
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AcceptInviteResponse(BaseModel):
    """Response schema for accepted invitation"""
    message: str
    user: dict
    tokens: dict
