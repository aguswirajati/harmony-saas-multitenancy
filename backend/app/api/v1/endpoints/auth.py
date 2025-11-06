from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    register_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Register new tenant with admin user

    Creates:
    - New tenant/organization
    - HQ branch
    - Admin user account

    Returns authentication tokens
    """
    auth_service = AuthService(db)
    return auth_service.register(register_data)

@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
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
    return auth_service.login(login_data)

@router.post("/logout")
async def logout():
    """
    Logout endpoint

    Note: JWT tokens are stateless, so logout is handled client-side
    by removing the tokens from storage
    """
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user = Depends(get_current_user)
):
    """
    Get current authenticated user info

    Requires: Bearer token in Authorization header
    """
    return UserResponse.from_orm(current_user)
