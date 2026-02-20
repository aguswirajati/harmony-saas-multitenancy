from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from app.schemas.user import UserResponse
from app.schemas.token import Token
from app.core.validators import password_validator, subdomain_validator, name_validator

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_subdomain: Optional[str] = None

class LoginResponse(BaseModel):
    user: UserResponse
    tenant: Optional[dict] = None  # <--- CORRECTED LINE: allows None and defaults to None
    tokens: Token

class RegisterRequest(BaseModel):
    # Admin user info (required)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8)
    admin_name: str = Field(..., min_length=1)

    # Tenant info (optional - auto-generated if not provided)
    company_name: Optional[str] = Field(None, min_length=1, max_length=255)
    subdomain: Optional[str] = Field(None, min_length=3, max_length=50, pattern="^[a-z0-9-]+$")

    # Validators
    @field_validator('admin_password')
    @classmethod
    def validate_password(cls, v):
        return password_validator(v)

    @field_validator('subdomain')
    @classmethod
    def validate_subdomain(cls, v):
        if v is None:
            return v
        return subdomain_validator(v)

    @field_validator('admin_name')
    @classmethod
    def validate_admin_name(cls, v):
        return name_validator(v)

    @field_validator('company_name')
    @classmethod
    def validate_company_name(cls, v):
        if v is None:
            return v
        return name_validator(v)

class RegisterResponse(BaseModel):
    message: str
    tenant: dict
    user: UserResponse
    tokens: Token

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    message: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        return password_validator(v)

class ResetPasswordResponse(BaseModel):
    message: str

class VerifyEmailRequest(BaseModel):
    token: str

class VerifyEmailResponse(BaseModel):
    message: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
