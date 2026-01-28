from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status, Request
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.models.branch import Branch
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.branch import BranchCreate, BranchUpdate, BranchResponse
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction, AuditStatus

class BranchService:
    def __init__(self, db: Session):
        self.db = db

    def get_branches(
        self,
        tenant_id: UUID,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None
    ) -> tuple[List[Branch], int]:
        """Get all branches for a tenant"""
        query = self.db.query(Branch).filter(
            Branch.tenant_id == tenant_id,
            Branch.is_active == True
        )

        if search:
            query = query.filter(
                (Branch.name.ilike(f"%{search}%")) |
                (Branch.code.ilike(f"%{search}%")) |
                (Branch.city.ilike(f"%{search}%"))
            )

        total = query.count()
        branches = query.order_by(Branch.is_hq.desc(), Branch.created_at.desc()).offset(skip).limit(limit).all()

        return branches, total

    def get_branch(self, branch_id: UUID, tenant_id: UUID) -> Branch:
        """Get branch by ID"""
        branch = self.db.query(Branch).filter(
            Branch.id == branch_id,
            Branch.tenant_id == tenant_id
        ).first()

        if not branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found"
            )

        return branch

    def create_branch(
        self,
        branch_data: BranchCreate,
        tenant_id: UUID,
        current_user: User,
        request: Request = None
    ) -> Branch:
        """Create new branch"""

        # Check subscription status
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant.subscription_status not in ('active', 'trial'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription is not active. Please contact your administrator."
            )

        # Check branch limit
        if tenant.max_branches != -1:  # -1 = unlimited
            active_count = self.db.query(func.count(Branch.id)).filter(
                Branch.tenant_id == tenant_id,
                Branch.is_active == True
            ).scalar()
            if active_count >= tenant.max_branches:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Branch limit reached ({tenant.max_branches}). Upgrade your plan to add more branches."
                )

        # Check if code already exists for this tenant
        existing = self.db.query(Branch).filter(
            Branch.tenant_id == tenant_id,
            Branch.code == branch_data.code
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Branch with code '{branch_data.code}' already exists"
            )

        # Create branch
        branch = Branch(
            **branch_data.model_dump(),
            tenant_id=tenant_id
        )

        self.db.add(branch)
        self.db.commit()
        self.db.refresh(branch)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=current_user.id,
            tenant_id=tenant_id,
            action=AuditAction.BRANCH_CREATED,
            resource="branch",
            resource_id=branch.id,
            details={
                "name": branch.name,
                "code": branch.code,
                "is_hq": branch.is_hq
            },
            status=AuditStatus.SUCCESS,
            request=request
        )

        return branch

    def update_branch(
        self,
        branch_id: UUID,
        branch_data: BranchUpdate,
        tenant_id: UUID,
        current_user: User,
        request: Request = None
    ) -> Branch:
        """Update branch"""

        branch = self.get_branch(branch_id, tenant_id)

        # Check if code is being changed and if it already exists
        if branch_data.code and branch_data.code != branch.code:
            existing = self.db.query(Branch).filter(
                Branch.tenant_id == tenant_id,
                Branch.code == branch_data.code,
                Branch.id != branch_id
            ).first()

            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Branch with code '{branch_data.code}' already exists"
                )

        # Update fields
        update_data = branch_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(branch, field, value)

        branch.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(branch)

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=current_user.id,
            tenant_id=tenant_id,
            action=AuditAction.BRANCH_UPDATED,
            resource="branch",
            resource_id=branch.id,
            details={
                "name": branch.name,
                "code": branch.code,
                "changes": update_data
            },
            status=AuditStatus.SUCCESS,
            request=request
        )

        return branch

    def delete_branch(
        self,
        branch_id: UUID,
        tenant_id: UUID,
        current_user: User,
        request: Request = None
    ) -> bool:
        """Soft delete branch"""

        branch = self.get_branch(branch_id, tenant_id)

        # Don't allow deletion of HQ branch
        if branch.is_hq:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete headquarters branch"
            )

        # Check if there are users assigned to this branch
        from app.models.user import User
        users_count = self.db.query(User).filter(
            User.default_branch_id == branch_id,
            User.is_active == True
        ).count()

        if users_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete branch with {users_count} active user(s). Please reassign users first."
            )

        # Store branch info for audit before deletion
        branch_name = branch.name
        branch_code = branch.code

        # Soft delete
        branch.is_active = False
        branch.deleted_at = datetime.utcnow()

        self.db.commit()

        # Log audit
        AuditService.log_action(
            db=self.db,
            user_id=current_user.id,
            tenant_id=tenant_id,
            action=AuditAction.BRANCH_DELETED,
            resource="branch",
            resource_id=branch_id,
            details={
                "name": branch_name,
                "code": branch_code
            },
            status=AuditStatus.SUCCESS,
            request=request
        )

        return True
