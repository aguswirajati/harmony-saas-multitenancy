from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
from uuid import UUID

from app.models.user import User
from app.models.tenant import Tenant
from app.models.branch import Branch
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token
)
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse
from app.schemas.token import Token
from app.schemas.user import UserResponse

class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def login(self, login_data: LoginRequest) -> LoginResponse:
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        # ========================================
        # FIX: Handle super admin (tenant_id=None)
        # ========================================
        
        # Check if user is super admin (no tenant)
        is_super_admin = user.tenant_id is None or user.role == "super_admin"
        
        # Get tenant if not already fetched and user has tenant_id
        if not tenant and user.tenant_id:
            tenant = self.db.query(Tenant).filter(
                Tenant.id == user.tenant_id
            ).first()

        # Update last login
        user.last_login_at = datetime.utcnow()
        self.db.commit()

        # Create tokens with conditional tenant_id
        token_data = {
            "sub": str(user.id),
            "role": user.role
        }
        
        # Only add tenant_id if user has a tenant
        if tenant:
            token_data["tenant_id"] = str(tenant.id)

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
            user=UserResponse.from_orm(user),
            tenant=tenant_data,  # Will be None for super admin
            tokens=Token(
                access_token=access_token,
                refresh_token=refresh_token
            )
        )

    def register(self, register_data: RegisterRequest) -> RegisterResponse:
        """Register new tenant with admin user"""

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

            # Create admin user
            name_parts = register_data.admin_name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            admin_user = User(
                tenant_id=tenant.id,
                email=register_data.admin_email,
                password_hash=get_password_hash(register_data.admin_password),
                first_name=first_name,
                last_name=last_name,
                full_name=register_data.admin_name,
                role="admin",
                default_branch_id=hq_branch.id,
                is_verified=True,
                email_verified_at=datetime.utcnow()
            )
            self.db.add(admin_user)
            self.db.commit()
            self.db.refresh(admin_user)

            # Create tokens
            token_data = {
                "sub": str(admin_user.id),
                "tenant_id": str(tenant.id),
                "role": admin_user.role
            }

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
                user=UserResponse.from_orm(admin_user),
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