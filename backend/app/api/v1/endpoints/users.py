from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_tenant, get_admin_user, get_super_admin_user
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
from app.schemas.invitation import InviteUserRequest, InviteUserResponse
from app.services.email_service import email_service

router = APIRouter(prefix="/users", tags=["Users"])
admin_router = APIRouter(prefix="/admin/users", tags=["Admin - Users"])

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
    request: Request,
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
        current_user=current_user,
        request=request
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
    request: Request,
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
        current_user=current_user,
        request=request
    )

    return UserResponse.model_validate(user)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    request: Request,
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
        current_user=current_user,
        request=request
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


@router.post("/invite", response_model=InviteUserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    invite_data: InviteUserRequest,
    request: Request,
    current_user: User = Depends(get_admin_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Invite a new user to the tenant (Admin only)

    Creates a user with an invitation token and sends an invitation email.
    The user must accept the invitation to set their password and activate their account.
    """
    user_service = UserService(db)
    user = user_service.invite_user(
        invite_data=invite_data,
        tenant_id=current_tenant.id,
        current_user=current_user,
        request=request,
    )

    # Send invitation email (fire-and-forget)
    inviter_name = current_user.full_name or current_user.email
    await email_service.send_invitation_email(
        to_email=user.email,
        inviter_name=inviter_name,
        tenant_name=current_tenant.name,
        invitation_token=user.invitation_token,
        role=user.role,
    )

    return InviteUserResponse(
        message="Invitation sent successfully",
        email=user.email,
        role=user.role,
    )


# ============================================================================
# ADMIN ROUTES - Super Admin Only
# ============================================================================

@admin_router.get("", response_model=UserListResponse)
async def list_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get all users across all tenants (Super Admin only)

    - **skip**: Number of records to skip
    - **limit**: Maximum number of records
    - **search**: Search by name or email
    - **role**: Filter by role
    - **tenant_id**: Filter by tenant
    """
    from sqlalchemy import or_, and_

    query = db.query(User).filter(User.is_active == True)

    # Apply filters
    if search:
        search_filter = or_(
            User.email.ilike(f"%{search}%"),
            User.full_name.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)

    if role:
        query = query.filter(User.role == role)

    if tenant_id:
        tenant_uuid = UUID(tenant_id)
        query = query.filter(User.tenant_id == tenant_uuid)

    # Get total count
    total = query.count()

    # Get paginated results
    users = query.offset(skip).limit(limit).all()

    # Convert to response with branch and tenant info
    users_with_info = []
    for user in users:
        user_dict = UserWithBranch.model_validate(user).model_dump()
        if user.default_branch:
            user_dict['branch_name'] = user.default_branch.name
            user_dict['branch_code'] = user.default_branch.code
        if user.tenant:
            user_dict['tenant_name'] = user.tenant.name
            user_dict['tenant_subdomain'] = user.tenant.subdomain
        users_with_info.append(UserWithBranch(**user_dict))

    return UserListResponse(
        users=users_with_info,
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )
