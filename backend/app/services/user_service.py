"""
User Service

Handles user CRUD operations within tenant scope.

User Architecture:
- Tenant Owner: Primary account holder, billing authority (1 per tenant)
- Tenant Admin: Delegated admin, no billing access
- Tenant Member: Regular team member, business operations
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import HTTPException, status, Request
from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime, timedelta
import secrets

from app.models.user import User, TenantRole
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
        tenant_role: Optional[str] = None,
        branch_id: Optional[UUID] = None
    ) -> Tuple[List[User], int]:
        """Get all users for tenant with filters"""
        query = self.db.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).options(joinedload(User.default_branch))

        # Search filter
        if search:
            query = query.filter(
                (User.email.ilike(f"%{search}%")) |
                (User.first_name.ilike(f"%{search}%")) |
                (User.last_name.ilike(f"%{search}%")) |
                (User.full_name.ilike(f"%{search}%"))
            )

        # Role filter (using tenant_role)
        if tenant_role:
            query = query.filter(User.tenant_role == tenant_role)

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
        """Create new tenant user (admin or member, not owner)"""

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

        # Create user with tenant_role (not 'owner' - owner is created via registration only)
        tenant_role = TenantRole(user_data.tenant_role) if user_data.tenant_role else TenantRole.MEMBER

        user = User(
            tenant_id=tenant_id,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            full_name=full_name,
            phone=user_data.phone,
            tenant_role=tenant_role,
            business_role=user_data.business_role,
            default_branch_id=user_data.default_branch_id,
            is_verified=True  # Auto-verify created users
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
                    "tenant_role": user.tenant_role.value if user.tenant_role else None,
                    "business_role": user.business_role,
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

        # Cannot change owner's tenant_role
        if user.is_tenant_owner and user_data.tenant_role and user_data.tenant_role != "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change owner's role. Use ownership transfer instead."
            )

        # Cannot promote to owner (only via transfer)
        if user_data.tenant_role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot promote to owner. Use ownership transfer instead."
            )

        # Prevent self-demotion from admin
        if user.id == current_user.id and user_data.tenant_role:
            if current_user.tenant_role in [TenantRole.OWNER, TenantRole.ADMIN]:
                if user_data.tenant_role not in ["owner", "admin"]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot demote yourself"
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
        role_changed = user_data.tenant_role and user_data.tenant_role != (user.tenant_role.value if user.tenant_role else None)

        # Update fields - use exclude_unset to only update provided fields
        update_data = user_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "tenant_role" and value:
                setattr(user, field, TenantRole(value))
            else:
                setattr(user, field, value)

        # Update full name based on current first/last name values
        first_name_sent = 'first_name' in update_data
        last_name_sent = 'last_name' in update_data

        if first_name_sent or last_name_sent:
            first = user.first_name
            last = user.last_name
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
                    "new_tenant_role": user.tenant_role.value if role_changed and user.tenant_role else None
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
        """Soft delete user (not allowed for owners)"""

        user = self.get_user(user_id, tenant_id)

        # Prevent self-deletion
        if user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own account"
            )

        # Prevent deletion of tenant owner
        if user.is_tenant_owner:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete tenant owner. Use account closure instead."
            )

        # Soft delete
        user.is_active = False
        user.deleted_at = datetime.utcnow()
        user.deleted_by_id = current_user.id

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
                    "tenant_role": user.tenant_role.value if user.tenant_role else None,
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

        # Determine tenant_role from invite data
        tenant_role = TenantRole.MEMBER  # Default
        if hasattr(invite_data, 'tenant_role') and invite_data.tenant_role:
            tenant_role = TenantRole(invite_data.tenant_role)
        elif hasattr(invite_data, 'role') and invite_data.role:
            # Legacy: map old role to tenant_role
            if invite_data.role == "admin":
                tenant_role = TenantRole.ADMIN
            else:
                tenant_role = TenantRole.MEMBER

        user = User(
            tenant_id=tenant_id,
            email=invite_data.email,
            password_hash=get_password_hash(secrets.token_urlsafe(32)),  # temp password
            first_name=invite_data.first_name,
            last_name=invite_data.last_name,
            full_name=full_name,
            tenant_role=tenant_role,
            business_role=getattr(invite_data, 'business_role', None),
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
                    "tenant_role": user.tenant_role.value if user.tenant_role else None,
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

    def transfer_ownership(
        self,
        new_owner_id: UUID,
        tenant_id: UUID,
        current_user: User,
        password: str,
        request: Request = None
    ) -> User:
        """Transfer tenant ownership to another user"""

        # Verify current user is owner
        if not current_user.is_tenant_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the tenant owner can transfer ownership"
            )

        # Verify password
        if not verify_password(password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect password"
            )

        # Get new owner
        new_owner = self.get_user(new_owner_id, tenant_id)

        # Cannot transfer to self
        if new_owner.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot transfer ownership to yourself"
            )

        # Cannot transfer to inactive user
        if not new_owner.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot transfer ownership to inactive user"
            )

        # Perform transfer
        current_user.tenant_role = TenantRole.ADMIN  # Demote to admin
        new_owner.tenant_role = TenantRole.OWNER  # Promote to owner

        self.db.commit()
        self.db.refresh(new_owner)

        # Log ownership transfer
        if request:
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant_id,
                action=AuditAction.USER_ROLE_CHANGED,
                resource="tenant",
                resource_id=tenant_id,
                details={
                    "action": "ownership_transfer",
                    "previous_owner": current_user.email,
                    "new_owner": new_owner.email
                },
                status=AuditStatus.SUCCESS,
                request=request
            )

        return new_owner
