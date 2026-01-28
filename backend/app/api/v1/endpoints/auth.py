from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.middleware.rate_limiter import auth_rate_limit, strict_rate_limit
from app.schemas.auth import (
    LoginRequest, LoginResponse, RegisterRequest, RegisterResponse,
    ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse,
    VerifyEmailRequest, VerifyEmailResponse,
    RefreshTokenRequest, RefreshTokenResponse
)
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    register_data: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Register new tenant with admin user

    Creates:
    - New tenant/organization
    - HQ branch
    - Admin user account
    - Sends welcome email

    Returns authentication tokens
    """
    auth_service = AuthService(db)
    return await auth_service.register(register_data, request)

@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
    # _rate_limit: None = Depends(auth_rate_limit)  # Temporarily disabled for development
):
    """
    Login with email and password

    Optional: Provide tenant_subdomain to login to specific tenant
    (useful if user has accounts in multiple tenants)

    Returns:
    - User info
    - Tenant info
    - Access & refresh tokens
    """
    auth_service = AuthService(db)
    return auth_service.login(login_data, request)

@router.post("/logout")
async def logout(
    request: Request,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout endpoint

    Note: JWT tokens are stateless, so logout is handled client-side
    by removing the tokens from storage.
    This endpoint logs the logout event for audit purposes.
    """
    auth_service = AuthService(db)
    return await auth_service.logout(current_user, request)

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user = Depends(get_current_user)
):
    """
    Get current authenticated user info

    Requires: Bearer token in Authorization header
    """
    return UserResponse.from_orm(current_user)

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
    _rate_limit: None = Depends(strict_rate_limit)
):
    """
    Request password reset email

    Sends a password reset link to the user's email if the account exists.
    Always returns success message (security best practice - don't reveal if email exists).
    """
    auth_service = AuthService(db)
    return await auth_service.forgot_password(request)

@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    reset_request: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    _rate_limit: None = Depends(auth_rate_limit)
):
    """
    Reset password using token from email

    The token is valid for 1 hour.
    """
    auth_service = AuthService(db)
    return auth_service.reset_password(reset_request, request)

@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    request: VerifyEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Verify user email address using token

    Token is sent via email after registration.
    """
    auth_service = AuthService(db)
    return await auth_service.verify_email(request)

@router.post("/resend-verification")
async def resend_verification(
    email: str,
    db: Session = Depends(get_db)
):
    """
    Resend email verification link

    Use this if the original verification email was not received.
    """
    auth_service = AuthService(db)
    return await auth_service.resend_verification(email)

@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token

    Use this to get a new access token when the old one expires.
    Refresh tokens are valid for 7 days.
    """
    auth_service = AuthService(db)
    return auth_service.refresh_token(request)
