from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: str = "staff"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    default_branch_id: Optional[UUID] = None


class InviteUserResponse(BaseModel):
    message: str
    email: str
    role: str


class AcceptInviteRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AcceptInviteResponse(BaseModel):
    message: str
    user: dict
    tokens: dict
