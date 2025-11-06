from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_tenant, get_admin_user
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserWithBranch,
    UserListResponse,
    UserChangePassword
)
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all users for current tenant

    - **skip**: Number of records to skip
    - **limit**: Maximum number of records
    - **search**: Search by name or email
    - **role**: Filter by role
    - **branch_id**: Filter by branch
    """
    user_service = UserService(db)

    branch_uuid = UUID(branch_id) if branch_id else None

    users, total = user_service.get_users(
        tenant_id=current_tenant.id,
        skip=skip,
        limit=limit,
        search=search,
        role=role,
        branch_id=branch_uuid
    )

    # Convert to response with branch info
    users_with_branch = []
    for user in users:
        user_dict = UserWithBranch.model_validate(user).model_dump()
        if user.default_branch:
            user_dict['branch_name'] = user.default_branch.name
            user_dict['branch_code'] = user.default_branch.code
        users_with_branch.append(UserWithBranch(**user_dict))

    return UserListResponse(
        users=users_with_branch,
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_admin_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Create new user (Admin only)

    Requires admin role
    """
    user_service = UserService(db)
    user = user_service.create_user(
        user_data=user_data,
        tenant_id=current_tenant.id,
        current_user=current_user
    )

    return UserResponse.model_validate(user)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get user by ID"""
    user_service = UserService(db)
    user = user_service.get_user(
        user_id=user_id,
        tenant_id=current_tenant.id
    )

    return UserResponse.model_validate(user)

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: User = Depends(get_admin_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Update user (Admin only)

    Requires admin role
    """
    user_service = UserService(db)
    user = user_service.update_user(
        user_id=user_id,
        user_data=user_data,
        tenant_id=current_tenant.id,
        current_user=current_user
    )

    return UserResponse.model_validate(user)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(get_admin_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Delete user (Admin only)

    Soft delete. Cannot delete self or super admin.

    Requires admin role
    """
    user_service = UserService(db)
    user_service.delete_user(
        user_id=user_id,
        tenant_id=current_tenant.id,
        current_user=current_user
    )

    return None

@router.post("/{user_id}/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    user_id: UUID,
    password_data: UserChangePassword,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Change user password"""

    # Only allow users to change their own password
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only change your own password"
        )

    user_service = UserService(db)
    user_service.change_password(
        user_id=user_id,
        password_data=password_data,
        tenant_id=current_tenant.id
    )

    return {"message": "Password changed successfully"}
