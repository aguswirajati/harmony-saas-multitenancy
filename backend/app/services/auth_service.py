"""
Authentication Service

Handles user authentication, registration, password reset, and token management.

User Architecture:
- System Users (tenant_id=NULL): system_role = 'admin' | 'operator'
- Tenant Users (tenant_id=UUID): tenant_role = 'owner' | 'admin' | 'member'
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, Request
from datetime import datetime, timedelta
from uuid import UUID
import secrets

from app.models.user import User, TenantRole, SystemRole
from app.models.tenant import Tenant
from app.models.branch import Branch
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.schemas.auth import (
    LoginRequest, LoginResponse, RegisterRequest, RegisterResponse,
    ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse,
    VerifyEmailRequest, VerifyEmailResponse,
    RefreshTokenRequest, RefreshTokenResponse
)
from app.schemas.token import Token
from app.schemas.user import UserResponse
from app.services.email_service import email_service
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction, AuditStatus
from app.config import settings


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def _build_token_data(self, user: User) -> dict:
        """Build token payload with role information"""
        token_data = {
            "sub": str(user.id),
        }

        if user.is_system_user:
            # System user
            token_data["system_role"] = user.system_role.value if user.system_role else None
        else:
            # Tenant user
            token_data["tenant_id"] = str(user.tenant_id)
            token_data["tenant_role"] = user.tenant_role.value if user.tenant_role else None

        # Legacy field for backward compatibility
        token_data["role"] = user.role

        return token_data

    def login(self, login_data: LoginRequest, request: Request = None) -> LoginResponse:
        """Authenticate user and return tokens"""

        # Get tenant if subdomain provided
        tenant = None
        if login_data.tenant_subdomain:
            tenant = self.db.query(Tenant).filter(
                Tenant.subdomain == login_data.tenant_subdomain,
                Tenant.is_active == True
            ).first()

            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tenant not found"
                )

        # Find user by email
        query = self.db.query(User).filter(
            User.email == login_data.email,
            User.is_active == True
        )

        if tenant:
            query = query.filter(User.tenant_id == tenant.id)

        user = query.first()

        if not user or not verify_password(login_data.password, user.password_hash):
            # Log failed login attempt if user exists
            if user and request:
                AuditService.log_action(
                    db=self.db,
                    user_id=None,  # Don't associate with user for failed attempt
                    tenant_id=user.tenant_id,
                    action=AuditAction.LOGIN_FAILED,
                    resource="user",
                    resource_id=user.id,
                    details={"email": login_data.email, "reason": "incorrect_password"},
                    status=AuditStatus.FAILURE,
                    request=request
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        # Get tenant if not already fetched and user has tenant_id
        if not tenant and user.tenant_id:
            tenant = self.db.query(Tenant).filter(
                Tenant.id == user.tenant_id
            ).first()

        # Update last login
        user.last_login_at = datetime.utcnow()
        self.db.commit()

        # Log successful login
        AuditService.log_action(
            db=self.db,
            user_id=user.id,
            tenant_id=user.tenant_id,
            action=AuditAction.LOGIN,
            resource="user",
            resource_id=user.id,
            details={
                "email": user.email,
                "system_role": user.system_role.value if user.system_role else None,
                "tenant_role": user.tenant_role.value if user.tenant_role else None,
            },
            status=AuditStatus.SUCCESS,
            request=request
        )

        # Create tokens
        token_data = self._build_token_data(user)
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        # Build response with conditional tenant data
        tenant_data = None
        if tenant:
            tenant_data = {
                "id": str(tenant.id),
                "name": tenant.name,
                "subdomain": tenant.subdomain,
                "tier": tenant.tier
            }

        return LoginResponse(
            user=UserResponse.from_user(user),
            tenant=tenant_data,  # Will be None for system users
            tokens=Token(
                access_token=access_token,
                refresh_token=refresh_token
            )
        )

    async def logout(self, user: User, request: Request = None) -> dict:
        """Log user logout for audit purposes"""

        # Log logout event
        if request:
            AuditService.log_action(
                db=self.db,
                user_id=user.id,
                tenant_id=user.tenant_id,
                action=AuditAction.LOGOUT,
                resource="user",
                resource_id=user.id,
                details={"email": user.email},
                status=AuditStatus.SUCCESS,
                request=request
            )

        return {"message": "Logged out successfully"}

    async def register(self, register_data: RegisterRequest, request: Request = None) -> RegisterResponse:
        """Register new tenant with owner user"""

        # Check if subdomain already exists
        existing_tenant = self.db.query(Tenant).filter(
            Tenant.subdomain == register_data.subdomain
        ).first()

        if existing_tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subdomain already taken"
            )

        # Check if email already exists
        existing_user = self.db.query(User).filter(
            User.email == register_data.admin_email
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        try:
            # Create tenant
            tenant = Tenant(
                name=register_data.company_name,
                subdomain=register_data.subdomain,
                tier="free",  # Default tier
                max_users=5,
                max_branches=1
            )
            self.db.add(tenant)
            self.db.flush()  # Get tenant.id

            # Create HQ branch
            hq_branch = Branch(
                tenant_id=tenant.id,
                name="Head Office",
                code="HQ",
                is_hq=True
            )
            self.db.add(hq_branch)
            self.db.flush()  # Get branch.id

            # Create owner user (the person who registers becomes owner)
            name_parts = register_data.admin_name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            owner_user = User(
                tenant_id=tenant.id,
                email=register_data.admin_email,
                password_hash=get_password_hash(register_data.admin_password),
                first_name=first_name,
                last_name=last_name,
                full_name=register_data.admin_name,
                tenant_role=TenantRole.OWNER,  # New: tenant owner
                default_branch_id=hq_branch.id,
                is_verified=True,  # Auto-verify owner during registration
                email_verified_at=datetime.utcnow()
            )
            self.db.add(owner_user)
            self.db.commit()
            self.db.refresh(owner_user)

            # Log tenant creation and user registration
            if request:
                # Log tenant creation
                AuditService.log_action(
                    db=self.db,
                    user_id=owner_user.id,
                    tenant_id=tenant.id,
                    action=AuditAction.TENANT_CREATED,
                    resource="tenant",
                    resource_id=tenant.id,
                    details={
                        "tenant_name": tenant.name,
                        "subdomain": tenant.subdomain,
                        "tier": tenant.tier
                    },
                    status=AuditStatus.SUCCESS,
                    request=request
                )

                # Log user registration
                AuditService.log_action(
                    db=self.db,
                    user_id=owner_user.id,
                    tenant_id=tenant.id,
                    action=AuditAction.USER_CREATED,
                    resource="user",
                    resource_id=owner_user.id,
                    details={
                        "email": owner_user.email,
                        "tenant_role": "owner",
                        "via": "registration"
                    },
                    status=AuditStatus.SUCCESS,
                    request=request
                )

            # Send welcome email (don't fail registration if email fails)
            try:
                await email_service.send_welcome_email(
                    to_email=owner_user.email,
                    user_name=owner_user.full_name,
                    tenant_name=tenant.name,
                    verification_url=None  # Already verified
                )
            except Exception as e:
                # Log error but don't fail registration
                from loguru import logger
                logger.error(f"Failed to send welcome email: {str(e)}")

            # Create tokens
            token_data = self._build_token_data(owner_user)
            access_token = create_access_token(token_data)
            refresh_token = create_refresh_token(token_data)

            return RegisterResponse(
                message="Registration successful",
                tenant={
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "subdomain": tenant.subdomain,
                    "tier": tenant.tier
                },
                user=UserResponse.from_user(owner_user),
                tokens=Token(
                    access_token=access_token,
                    refresh_token=refresh_token
                )
            )

        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Registration failed: {str(e)}"
            )

    async def forgot_password(self, request_data: ForgotPasswordRequest, request: Request = None) -> ForgotPasswordResponse:
        """Generate password reset token and send email"""

        # Find user by email
        user = self.db.query(User).filter(
            User.email == request_data.email,
            User.is_active == True
        ).first()

        # Always return success message (don't reveal if email exists)
        if not user:
            return ForgotPasswordResponse(
                message="If an account exists with this email, you will receive a password reset link."
            )

        # Generate secure reset token
        reset_token = secrets.token_urlsafe(32)
        reset_expires = datetime.utcnow() + timedelta(hours=1)

        # Save token to database
        user.reset_token = reset_token
        user.reset_token_expires = reset_expires
        self.db.commit()

        # Log password reset request
        AuditService.log_action(
            db=self.db,
            user_id=user.id,
            tenant_id=user.tenant_id,
            action=AuditAction.PASSWORD_RESET_REQUEST,
            resource="user",
            resource_id=user.id,
            details={"email": user.email},
            status=AuditStatus.SUCCESS,
            request=request
        )

        # Send password reset email
        await email_service.send_password_reset_email(
            to_email=user.email,
            user_name=user.full_name or user.email,
            reset_token=reset_token,
            expires_in_minutes=60
        )

        return ForgotPasswordResponse(
            message="If an account exists with this email, you will receive a password reset link."
        )

    def reset_password(self, reset_request: ResetPasswordRequest, request: Request = None) -> ResetPasswordResponse:
        """Reset password using valid token"""

        # Find user with matching token
        user = self.db.query(User).filter(
            User.reset_token == reset_request.token,
            User.is_active == True
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )

        # Check if token has expired
        if user.reset_token_expires and user.reset_token_expires < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token has expired. Please request a new one."
            )

        # Update password
        user.password_hash = get_password_hash(reset_request.new_password)
        user.reset_token = None
        user.reset_token_expires = None
        self.db.commit()

        # Log successful password reset
        if request:
            AuditService.log_action(
                db=self.db,
                user_id=user.id,
                tenant_id=user.tenant_id,
                action=AuditAction.PASSWORD_RESET,
                resource="user",
                resource_id=user.id,
                details={"email": user.email},
                status=AuditStatus.SUCCESS,
                request=request
            )

        return ResetPasswordResponse(
            message="Password has been reset successfully. You can now login with your new password."
        )

    async def verify_email(self, request: VerifyEmailRequest) -> VerifyEmailResponse:
        """Verify user email with token"""

        # Find user with matching verification token
        user = self.db.query(User).filter(
            User.verification_token == request.token,
            User.is_active == True
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token"
            )

        # Check if already verified
        if user.is_verified:
            return VerifyEmailResponse(
                message="Email already verified. You can login to your account."
            )

        # Verify email
        user.is_verified = True
        user.email_verified_at = datetime.utcnow()
        user.verification_token = None
        self.db.commit()

        return VerifyEmailResponse(
            message="Email verified successfully! You can now login to your account."
        )

    async def resend_verification(self, email: str) -> dict:
        """Resend email verification link"""

        # Find user by email
        user = self.db.query(User).filter(
            User.email == email,
            User.is_active == True
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        if user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already verified"
            )

        # Generate new verification token
        verification_token = secrets.token_urlsafe(32)
        user.verification_token = verification_token
        self.db.commit()

        # Send verification email
        await email_service.send_verification_email(
            to_email=user.email,
            user_name=user.full_name or user.email,
            verification_token=verification_token
        )

        return {"message": "Verification email sent successfully"}

    def refresh_token(self, request: RefreshTokenRequest) -> RefreshTokenResponse:
        """Refresh access token using refresh token"""

        try:
            # Decode refresh token
            payload = decode_token(request.refresh_token)
            user_id = payload.get("sub")

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )

            # Find user
            user = self.db.query(User).filter(
                User.id == UUID(user_id),
                User.is_active == True
            ).first()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )

            # Create new tokens
            token_data = self._build_token_data(user)
            new_access_token = create_access_token(token_data)
            new_refresh_token = create_refresh_token(token_data)

            return RefreshTokenResponse(
                access_token=new_access_token,
                refresh_token=new_refresh_token,
                token_type="bearer"
            )

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )

    async def accept_invite(
        self,
        token: str,
        password: str,
        first_name: str = None,
        last_name: str = None,
        request: Request = None
    ) -> LoginResponse:
        """Accept an invitation and set password"""

        # Find user with matching invitation token
        user = self.db.query(User).filter(
            User.invitation_token == token,
            User.is_active == True
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid invitation token"
            )

        # Check if token has expired
        if user.invitation_expires_at and user.invitation_expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has expired. Please request a new one."
            )

        # Update user
        user.password_hash = get_password_hash(password)
        user.invitation_token = None
        user.invitation_expires_at = None
        user.is_verified = True
        user.email_verified_at = datetime.utcnow()

        if first_name:
            user.first_name = first_name
        if last_name:
            user.last_name = last_name
        if first_name or last_name:
            user.full_name = f"{first_name or ''} {last_name or ''}".strip()

        self.db.commit()
        self.db.refresh(user)

        # Log invite acceptance
        if request:
            AuditService.log_action(
                db=self.db,
                user_id=user.id,
                tenant_id=user.tenant_id,
                action=AuditAction.USER_UPDATED,
                resource="user",
                resource_id=user.id,
                details={
                    "email": user.email,
                    "action": "invitation_accepted"
                },
                status=AuditStatus.SUCCESS,
                request=request
            )

        # Get tenant
        tenant = None
        if user.tenant_id:
            tenant = self.db.query(Tenant).filter(Tenant.id == user.tenant_id).first()

        # Create tokens and return login response
        token_data = self._build_token_data(user)
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        tenant_data = None
        if tenant:
            tenant_data = {
                "id": str(tenant.id),
                "name": tenant.name,
                "subdomain": tenant.subdomain,
                "tier": tenant.tier
            }

        return LoginResponse(
            user=UserResponse.from_user(user),
            tenant=tenant_data,
            tokens=Token(
                access_token=access_token,
                refresh_token=refresh_token
            )
        )
