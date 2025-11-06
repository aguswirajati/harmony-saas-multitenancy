from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.schemas.user import UserResponse
from app.schemas.token import Token

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_subdomain: Optional[str] = None

class LoginResponse(BaseModel):
    user: UserResponse
    tenant: Optional[dict] = None  # <--- CORRECTED LINE: allows None and defaults to None
    tokens: Token

class RegisterRequest(BaseModel):
    # Tenant info
    company_name: str = Field(..., min_length=1, max_length=255)
    subdomain: str = Field(..., min_length=3, max_length=50, pattern="^[a-z0-9-]+$")

    # Admin user info
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8)
    admin_name: str = Field(..., min_length=1)

class RegisterResponse(BaseModel):
    message: str
    tenant: dict
    user: UserResponse
    tokens: Token
