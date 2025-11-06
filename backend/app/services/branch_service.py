from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.models.branch import Branch
from app.models.user import User
from app.schemas.branch import BranchCreate, BranchUpdate, BranchResponse

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
        current_user: User
    ) -> Branch:
        """Create new branch"""

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

        return branch

    def update_branch(
        self,
        branch_id: UUID,
        branch_data: BranchUpdate,
        tenant_id: UUID,
        current_user: User
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

        return branch

    def delete_branch(
        self,
        branch_id: UUID,
        tenant_id: UUID,
        current_user: User
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

        # Soft delete
        branch.is_active = False
        branch.deleted_at = datetime.utcnow()

        self.db.commit()

        return True
