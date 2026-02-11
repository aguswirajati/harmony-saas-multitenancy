from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import HTTPException, status, Request
from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime, timedelta
import secrets

from app.models.user import User
from app.models.branch import Branch
from app.models.tenant import Tenant
from app.core.security import get_password_hash, verify_password
from app.schemas.user import UserCreate, UserUpdate, UserChangePassword, UserWithBranch
from app.schemas.invitation import InviteUserRequest
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction, AuditStatus

class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_users(
        self,
        tenant_id: UUID,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        role: Optional[str] = None,
        branch_id: Optional[UUID] = None
    ) -> Tuple[List[User], int]:
        """Get all users for tenant with filters"""
        query = self.db.query(User).filter(
            User.tenant_id == tenant_id
        ).options(joinedload(User.default_branch))

        # Search filter
        if search:
            query = query.filter(
                (User.email.ilike(f"%{search}%")) |
                (User.first_name.ilike(f"%{search}%")) |
                (User.last_name.ilike(f"%{search}%")) |
                (User.full_name.ilike(f"%{search}%"))
            )

        # Role filter
        if role:
            query = query.filter(User.role == role)

        # Branch filter
        if branch_id:
            query = query.filter(User.default_branch_id == branch_id)

        total = query.count()
        users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

        return users, total

    def get_user(self, user_id: UUID, tenant_id: UUID) -> User:
        """Get user by ID"""
        user = self.db.query(User).filter(
            User.id == user_id,
            User.tenant_id == tenant_id
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return user

    def create_user(
        self,
        user_data: UserCreate,
        tenant_id: UUID,
        current_user: User,
        request: Request = None
    ) -> User:
        """Create new user"""

        # Check subscription status
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant.subscription_status not in ('active', 'trial'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription is not active. Please contact your administrator."
            )

        # Check user limit
        if tenant.max_users != -1:  # -1 = unlimited
            active_count = self.db.query(func.count(User.id)).filter(
                User.tenant_id == tenant_id,
                User.is_active == True
            ).scalar()
            if active_count >= tenant.max_users:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User limit reached ({tenant.max_users}). Upgrade your plan to add more users."
                )

        # Check if email already exists
        existing = self.db.query(User).filter(
            User.email == user_data.email
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Verify branch exists and belongs to tenant
        if user_data.default_branch_id:
            branch = self.db.query(Branch).filter(
                Branch.id == user_data.default_branch_id,
                Branch.tenant_id == tenant_id
            ).first()

            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid branch"
                )

        # Generate full name
        full_name = None
        if user_data.first_name and user_data.last_name:
            full_name = f"{user_data.first_name} {user_data.last_name}"
        elif user_data.first_name:
            full_name = user_data.first_name

        # Create user
        user = User(
            tenant_id=tenant_id,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            full_name=full_name,
            phone=user_data.phone,
            role=user_data.role,
            default_branch_id=user_data.default_branch_id,
            is_verified=True  # Auto-verify invited users
        )

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        # Log user creation
        if request:
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant_id,
                action=AuditAction.USER_CREATED,
                resource="user",
                resource_id=user.id,
                details={
                    "email": user.email,
                    "role": user.role,
                    "created_by": current_user.email
                },
                status=AuditStatus.SUCCESS,
                request=request
            )

        return user

    def update_user(
        self,
        user_id: UUID,
        user_data: UserUpdate,
        tenant_id: UUID,
        current_user: User,
        request: Request = None
    ) -> User:
        """Update user"""

        user = self.get_user(user_id, tenant_id)

        # Prevent self-demotion from admin
        if user.id == current_user.id and user_data.role and user_data.role != current_user.role:
            if current_user.role in ["admin", "super_admin"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change your own role"
                )

        # Verify branch if being changed
        if user_data.default_branch_id:
            branch = self.db.query(Branch).filter(
                Branch.id == user_data.default_branch_id,
                Branch.tenant_id == tenant_id
            ).first()

            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid branch"
                )

        # Track role change for audit
        role_changed = user_data.role and user_data.role != user.role

        # Update fields - use exclude_unset to only update provided fields
        # exclude_none=False so that null values can clear fields
        update_data = user_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        # Update full name based on current first/last name values
        # Check if first_name or last_name was explicitly sent (even if null)
        first_name_sent = 'first_name' in update_data
        last_name_sent = 'last_name' in update_data

        if first_name_sent or last_name_sent:
            # Use the new value if sent, otherwise keep existing
            first = user.first_name  # Already updated by setattr above
            last = user.last_name    # Already updated by setattr above
            if first and last:
                user.full_name = f"{first} {last}"
            elif first:
                user.full_name = first
            elif last:
                user.full_name = last
            else:
                user.full_name = None

        user.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(user)

        # Log user update
        if request:
            action = AuditAction.USER_ROLE_CHANGED if role_changed else AuditAction.USER_UPDATED
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant_id,
                action=action,
                resource="user",
                resource_id=user.id,
                details={
                    "email": user.email,
                    "updated_fields": list(update_data.keys()),
                    "updated_by": current_user.email,
                    "new_role": user.role if role_changed else None
                },
                status=AuditStatus.SUCCESS,
                request=request
            )

        return user

    def delete_user(
        self,
        user_id: UUID,
        tenant_id: UUID,
        current_user: User,
        request: Request = None
    ) -> bool:
        """Soft delete user"""

        user = self.get_user(user_id, tenant_id)

        # Prevent self-deletion
        if user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own account"
            )

        # Prevent deletion of super_admin
        if user.role == "super_admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete super admin account"
            )

        # Soft delete
        user.is_active = False
        user.deleted_at = datetime.utcnow()

        self.db.commit()

        # Log user deletion
        if request:
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant_id,
                action=AuditAction.USER_DELETED,
                resource="user",
                resource_id=user.id,
                details={
                    "email": user.email,
                    "role": user.role,
                    "deleted_by": current_user.email
                },
                status=AuditStatus.SUCCESS,
                request=request
            )

        return True

    def change_password(
        self,
        user_id: UUID,
        password_data: UserChangePassword,
        tenant_id: UUID
    ) -> bool:
        """Change user password"""

        user = self.get_user(user_id, tenant_id)

        # Verify current password
        if not verify_password(password_data.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

        # Update password
        user.password_hash = get_password_hash(password_data.new_password)
        user.updated_at = datetime.utcnow()

        self.db.commit()

        return True

    def invite_user(
        self,
        invite_data: InviteUserRequest,
        tenant_id: UUID,
        current_user: User,
        request: Request = None
    ) -> User:
        """Create an invited user with a pending invitation token."""

        # Check subscription status
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant.subscription_status not in ('active', 'trial'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription is not active."
            )

        # Check user limit
        if tenant.max_users != -1:
            active_count = self.db.query(func.count(User.id)).filter(
                User.tenant_id == tenant_id,
                User.is_active == True
            ).scalar()
            if active_count >= tenant.max_users:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User limit reached ({tenant.max_users}). Upgrade your plan."
                )

        # Check if email already exists
        existing = self.db.query(User).filter(
            User.email == invite_data.email
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Validate branch if provided
        if invite_data.default_branch_id:
            branch = self.db.query(Branch).filter(
                Branch.id == invite_data.default_branch_id,
                Branch.tenant_id == tenant_id
            ).first()
            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid branch"
                )

        invitation_token = secrets.token_urlsafe(32)

        # Build full name
        full_name = None
        if invite_data.first_name and invite_data.last_name:
            full_name = f"{invite_data.first_name} {invite_data.last_name}"
        elif invite_data.first_name:
            full_name = invite_data.first_name

        user = User(
            tenant_id=tenant_id,
            email=invite_data.email,
            password_hash=get_password_hash(secrets.token_urlsafe(32)),  # temp password
            first_name=invite_data.first_name,
            last_name=invite_data.last_name,
            full_name=full_name,
            role=invite_data.role,
            default_branch_id=invite_data.default_branch_id,
            is_active=False,  # inactive until invitation accepted
            is_verified=False,
            invitation_token=invitation_token,
            invitation_expires_at=datetime.utcnow() + timedelta(days=7),
            invited_by_id=current_user.id,
        )

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        # Log invitation
        if request:
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant_id,
                action=AuditAction.USER_INVITED,
                resource="user",
                resource_id=user.id,
                details={
                    "email": user.email,
                    "role": user.role,
                    "invited_by": current_user.email,
                },
                status=AuditStatus.SUCCESS,
                request=request,
            )

        return user

    def accept_invite(self, token: str, password: str, first_name: str = None, last_name: str = None) -> User:
        """Accept an invitation by setting the password and activating the user."""

        user = self.db.query(User).filter(
            User.invitation_token == token
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid invitation token"
            )

        if user.invitation_expires_at and user.invitation_expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has expired"
            )

        user.password_hash = get_password_hash(password)
        user.is_active = True
        user.is_verified = True
        user.invitation_token = None
        user.invitation_expires_at = None
        user.email_verified_at = datetime.utcnow()

        if first_name:
            user.first_name = first_name
        if last_name:
            user.last_name = last_name
        if user.first_name and user.last_name:
            user.full_name = f"{user.first_name} {user.last_name}"
        elif user.first_name:
            user.full_name = user.first_name

        self.db.commit()
        self.db.refresh(user)

        return user
