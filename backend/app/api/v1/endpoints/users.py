"""
User Management Endpoints

Tenant scope: Manage users within tenant
System scope: View users across all tenants
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.api.deps import (
    get_current_user,
    get_current_tenant,
    get_tenant_admin_or_owner,
    get_tenant_owner,
    get_system_admin,
    require_tenant_permission,
    require_system_permission,
)
from app.core.permissions import TenantPermission, SystemPermission
from app.models.user import User, TenantRole
from app.models.tenant import Tenant
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserWithBranch,
    UserListResponse,
    UserChangePassword,
    OwnershipTransferRequest,
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
    tenant_role: Optional[str] = Query(None, description="Filter by tenant role (owner, admin, member)"),
    branch_id: Optional[str] = Query(None),
    current_user: User = Depends(require_tenant_permission(TenantPermission.USERS_VIEW)),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all users for current tenant

    - **skip**: Number of records to skip
    - **limit**: Maximum number of records
    - **search**: Search by name or email
    - **tenant_role**: Filter by role (owner, admin, member)
    - **branch_id**: Filter by branch
    """
    user_service = UserService(db)

    branch_uuid = UUID(branch_id) if branch_id else None

    users, total = user_service.get_users(
        tenant_id=current_tenant.id,
        skip=skip,
        limit=limit,
        search=search,
        tenant_role=tenant_role,
        branch_id=branch_uuid
    )

    # Convert to response with branch info
    users_with_branch = []
    for user in users:
        user_data = UserResponse.from_user(user).model_dump()
        if user.default_branch:
            user_data['branch_name'] = user.default_branch.name
            user_data['branch_code'] = user.default_branch.code
        users_with_branch.append(UserWithBranch(**user_data))

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
    current_user: User = Depends(require_tenant_permission(TenantPermission.USERS_CREATE)),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Create new user (Admin/Owner only)

    Creates a tenant admin or member. Owners can only be created via registration.
    """
    user_service = UserService(db)
    user = user_service.create_user(
        user_data=user_data,
        tenant_id=current_tenant.id,
        current_user=current_user,
        request=request
    )

    return UserResponse.from_user(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(require_tenant_permission(TenantPermission.USERS_VIEW)),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get user by ID"""
    user_service = UserService(db)
    user = user_service.get_user(
        user_id=user_id,
        tenant_id=current_tenant.id
    )

    return UserResponse.from_user(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    request: Request,
    current_user: User = Depends(require_tenant_permission(TenantPermission.USERS_UPDATE)),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Update user (Admin/Owner only)

    Cannot change owner's role. Use transfer-ownership instead.
    """
    user_service = UserService(db)
    user = user_service.update_user(
        user_id=user_id,
        user_data=user_data,
        tenant_id=current_tenant.id,
        current_user=current_user,
        request=request
    )

    return UserResponse.from_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    request: Request,
    current_user: User = Depends(require_tenant_permission(TenantPermission.USERS_DELETE)),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Delete user (Admin/Owner only)

    Soft delete. Cannot delete self or owner.
    To delete owner, use account closure.
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
    """Change user password (own password only)"""

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
    current_user: User = Depends(require_tenant_permission(TenantPermission.USERS_INVITE)),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Invite a new user to the tenant (Admin/Owner only)

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
    tenant_role = user.tenant_role.value if user.tenant_role else "member"
    await email_service.send_invitation_email(
        to_email=user.email,
        inviter_name=inviter_name,
        tenant_name=current_tenant.name,
        invitation_token=user.invitation_token,
        role=tenant_role,
    )

    return InviteUserResponse(
        message="Invitation sent successfully",
        email=user.email,
        tenant_role=tenant_role,
        business_role=user.business_role,
    )


@router.post("/transfer-ownership", response_model=UserResponse)
async def transfer_ownership(
    transfer_data: OwnershipTransferRequest,
    request: Request,
    current_user: User = Depends(get_tenant_owner),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Transfer tenant ownership to another user (Owner only)

    The current owner becomes an admin, and the target user becomes the new owner.
    Requires password confirmation.
    """
    user_service = UserService(db)
    new_owner = user_service.transfer_ownership(
        new_owner_id=transfer_data.new_owner_id,
        tenant_id=current_tenant.id,
        current_user=current_user,
        password=transfer_data.password,
        request=request
    )

    return UserResponse.from_user(new_owner)


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_my_account(
    request: Request,
    password: str,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Delete own account (Member only - soft delete)

    Owners must use account closure endpoint instead.
    Requires password confirmation.
    """
    from app.core.security import verify_password
    from app.services.audit_service import AuditService
    from app.models.audit_log import AuditAction, AuditStatus
    from datetime import datetime

    # Owners cannot self-delete, they must use account closure
    if current_user.tenant_role == TenantRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owners cannot delete their account. Use account closure to delete the entire tenant."
        )

    # Verify password
    if not verify_password(password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password"
        )

    # Log the account deletion
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=current_tenant.id,
        action=AuditAction.USER_DELETED,
        resource="user",
        resource_id=current_user.id,
        details={
            "email": current_user.email,
            "action": "self_delete",
        },
        status=AuditStatus.SUCCESS,
        request=request
    )

    # Soft delete the user
    current_user.is_active = False
    current_user.deleted_at = datetime.utcnow()
    current_user.deleted_by_id = current_user.id
    db.commit()

    return {
        "message": "Account deleted successfully",
        "email": current_user.email
    }


# ============================================================================
# ADMIN ROUTES - System Users Only
# ============================================================================

@admin_router.get("", response_model=UserListResponse)
async def list_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    tenant_role: Optional[str] = Query(None),
    system_role: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    current_user: User = Depends(require_system_permission(SystemPermission.USERS_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Get all users across all tenants (System Admin/Operator)

    - **skip**: Number of records to skip
    - **limit**: Maximum number of records
    - **search**: Search by name or email
    - **tenant_role**: Filter by tenant role
    - **system_role**: Filter by system role
    - **tenant_id**: Filter by tenant
    """
    query = db.query(User).filter(User.is_active == True)

    # Apply filters
    if search:
        search_filter = or_(
            User.email.ilike(f"%{search}%"),
            User.full_name.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)

    if tenant_role:
        query = query.filter(User.tenant_role == tenant_role)

    if system_role:
        query = query.filter(User.system_role == system_role)

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
        user_data = UserResponse.from_user(user).model_dump()
        if user.default_branch:
            user_data['branch_name'] = user.default_branch.name
            user_data['branch_code'] = user.default_branch.code
        if user.tenant:
            user_data['tenant_name'] = user.tenant.name
            user_data['tenant_subdomain'] = user.tenant.subdomain
        users_with_info.append(UserWithBranch(**user_data))

    return UserListResponse(
        users=users_with_info,
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )
