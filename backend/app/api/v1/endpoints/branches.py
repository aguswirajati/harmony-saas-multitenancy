from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_tenant, get_admin_user
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.branch import BranchCreate, BranchUpdate, BranchResponse, BranchListResponse
from app.services.branch_service import BranchService

router = APIRouter(prefix="/branches", tags=["Branches"])

@router.get("", response_model=BranchListResponse)
async def list_branches(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all branches for current tenant

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    - **search**: Search by name, code, or city
    """
    branch_service = BranchService(db)
    branches, total = branch_service.get_branches(
        tenant_id=current_tenant.id,
        skip=skip,
        limit=limit,
        search=search
    )

    return BranchListResponse(
        branches=[BranchResponse.model_validate(b) for b in branches],
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )

@router.post("", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch_data: BranchCreate,
    request: Request,
    current_user: User = Depends(get_admin_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Create new branch (Admin only)

    Requires admin role
    """
    branch_service = BranchService(db)
    branch = branch_service.create_branch(
        branch_data=branch_data,
        tenant_id=current_tenant.id,
        current_user=current_user,
        request=request
    )

    return BranchResponse.model_validate(branch)

@router.get("/{branch_id}", response_model=BranchResponse)
async def get_branch(
    branch_id: UUID,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get branch by ID"""
    branch_service = BranchService(db)
    branch = branch_service.get_branch(
        branch_id=branch_id,
        tenant_id=current_tenant.id
    )

    return BranchResponse.model_validate(branch)

@router.put("/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: UUID,
    branch_data: BranchUpdate,
    request: Request,
    current_user: User = Depends(get_admin_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Update branch (Admin only)

    Requires admin role
    """
    branch_service = BranchService(db)
    branch = branch_service.update_branch(
        branch_id=branch_id,
        branch_data=branch_data,
        tenant_id=current_tenant.id,
        current_user=current_user,
        request=request
    )

    return BranchResponse.model_validate(branch)

@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: UUID,
    request: Request,
    current_user: User = Depends(get_admin_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Delete branch (Admin only)

    Soft delete. Cannot delete HQ branch or branches with active users.

    Requires admin role
    """
    branch_service = BranchService(db)
    branch_service.delete_branch(
        branch_id=branch_id,
        tenant_id=current_tenant.id,
        current_user=current_user,
        request=request
    )

    return None
