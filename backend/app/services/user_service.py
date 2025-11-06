from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status
from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime

from app.models.user import User
from app.models.branch import Branch
from app.core.security import get_password_hash, verify_password
from app.schemas.user import UserCreate, UserUpdate, UserChangePassword, UserWithBranch

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
        current_user: User
    ) -> User:
        """Create new user"""

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

        return user

    def update_user(
        self,
        user_id: UUID,
        user_data: UserUpdate,
        tenant_id: UUID,
        current_user: User
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

        # Update fields
        update_data = user_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        # Update full name if first/last name changed
        if user_data.first_name or user_data.last_name:
            first = user_data.first_name or user.first_name
            last = user_data.last_name or user.last_name
            if first and last:
                user.full_name = f"{first} {last}"
            elif first:
                user.full_name = first

        user.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(user)

        return user

    def delete_user(
        self,
        user_id: UUID,
        tenant_id: UUID,
        current_user: User
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
