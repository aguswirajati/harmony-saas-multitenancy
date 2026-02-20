"""
Dependencies for Harmony SaaS Multi-Tenant System

Provides dependency injection for:
- Authentication (JWT token validation)
- Authorization (system/tenant permission checks)
- Tenant context resolution
"""
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, SystemRole, TenantRole
from app.models.tenant import Tenant
from app.core.exceptions import UnauthorizedException, SuperAdminRequiredException
from app.core.permissions import (
    Permission, has_permission,  # Legacy
    SystemPermission, TenantPermission,
    has_system_permission, has_tenant_permission,
    SYSTEM_ROLE_PERMISSIONS, TENANT_ROLE_PERMISSIONS,
)

security = HTTPBearer()


# ========================================
# Core Authentication
# ========================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token
    """
    token = credentials.credentials
    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Ensure user is active
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


# ========================================
# System Scope Authorization
# ========================================

def get_system_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Require user to be a system user (tenant_id IS NULL)
    System users manage the SaaS platform itself.
    """
    if not current_user.is_system_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System access required"
        )
    return current_user


def get_system_admin(
    current_user: User = Depends(get_system_user)
) -> User:
    """
    Require system admin role (full platform control)
    """
    if not current_user.is_system_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System admin access required"
        )
    return current_user


def require_system_permission(permission: SystemPermission):
    """
    Factory function to create dependency for checking system permissions.

    Usage:
        @router.get("/", dependencies=[Depends(require_system_permission(SystemPermission.TENANTS_VIEW))])
        async def list_tenants(...):
    """
    def check_permission(
        current_user: User = Depends(get_system_user),
    ):
        if not current_user.system_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="System role required"
            )

        if not has_system_permission(current_user.system_role.value, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission.value}' required"
            )
        return current_user

    return check_permission


# ========================================
# Tenant Scope Authorization
# ========================================

def get_tenant_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Require user to be a tenant user (tenant_id IS NOT NULL)
    Tenant users belong to a customer organization.
    """
    if not current_user.is_tenant_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access required. System users should use admin endpoints."
        )
    return current_user


def get_tenant_owner(
    current_user: User = Depends(get_tenant_user)
) -> User:
    """
    Require tenant owner role (billing authority, account management)
    """
    if not current_user.is_tenant_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant owner access required"
        )
    return current_user


def get_tenant_admin_or_owner(
    current_user: User = Depends(get_tenant_user)
) -> User:
    """
    Require tenant admin or owner role (management access)
    """
    if current_user.tenant_role not in [TenantRole.OWNER, TenantRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant admin access required"
        )
    return current_user


def require_tenant_permission(permission: TenantPermission):
    """
    Factory function to create dependency for checking tenant permissions.

    Usage:
        @router.post("/", dependencies=[Depends(require_tenant_permission(TenantPermission.USERS_CREATE))])
        async def create_user(...):
    """
    def check_permission(
        current_user: User = Depends(get_tenant_user),
    ):
        if not current_user.tenant_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant role required"
            )

        if not has_tenant_permission(current_user.tenant_role.value, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission.value}' required"
            )
        return current_user

    return check_permission


# ========================================
# Tenant Context Resolution
# ========================================

def get_tenant_context(
    x_tenant_id: Optional[str] = Header(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Tenant:
    """
    Get tenant context from header or current user.
    Used for multi-tenant operations.

    - System users can specify tenant via X-Tenant-ID header
    - Tenant users use their own tenant
    """
    # System users can specify tenant via header
    if current_user.is_system_user and x_tenant_id:
        try:
            tenant_id = UUID(x_tenant_id)
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant {x_tenant_id} not found"
                )
            return tenant
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )

    # System user without tenant context
    if current_user.is_system_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Tenant-ID header required for system users"
        )

    # Tenant users use their own tenant
    if not current_user.tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no associated tenant"
        )

    return current_user.tenant


def get_current_tenant(
    current_user: User = Depends(get_tenant_user)
) -> Tenant:
    """
    Get current user's tenant (for tenant self-service operations).
    Only works for tenant users, not system users.
    """
    if not current_user.tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no associated tenant"
        )

    if not current_user.tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant is inactive"
        )

    return current_user.tenant


# ========================================
# Feature Access Control
# ========================================

def require_feature(feature_code: str):
    """
    Factory function to create dependency for checking feature access.

    Uses FeatureService to check tier-based features plus tenant overrides.

    Usage:
        @router.get("/", dependencies=[Depends(require_feature("inventory.adjustments"))])
        @router.post("/", dependencies=[Depends(require_feature("pos.terminal"))])
    """
    def check_feature(
        tenant: Tenant = Depends(get_current_tenant),
        db: Session = Depends(get_db),
    ):
        from app.services.feature_service import FeatureService

        if not FeatureService.has_feature(db, tenant, feature_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_code}' is not available for your subscription tier"
            )
        return True

    return check_feature


def require_any_feature(*feature_codes: str):
    """
    Require at least one of the specified features.

    Usage:
        @router.get("/", dependencies=[Depends(require_any_feature("reports.basic", "reports.advanced"))])
    """
    def check_features(
        tenant: Tenant = Depends(get_current_tenant),
        db: Session = Depends(get_db),
    ):
        from app.services.feature_service import FeatureService

        if not FeatureService.has_any_feature(db, tenant, list(feature_codes)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these features is required: {', '.join(feature_codes)}"
            )
        return True

    return check_features


def require_all_features(*feature_codes: str):
    """
    Require all of the specified features.

    Usage:
        @router.get("/", dependencies=[Depends(require_all_features("inventory.stock", "inventory.adjustments"))])
    """
    def check_features(
        tenant: Tenant = Depends(get_current_tenant),
        db: Session = Depends(get_db),
    ):
        from app.services.feature_service import FeatureService

        if not FeatureService.has_all_features(db, tenant, list(feature_codes)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"All of these features are required: {', '.join(feature_codes)}"
            )
        return True

    return check_features


# ========================================
# Legacy Dependencies (Backward Compatibility)
# TODO: Remove after full migration
# ========================================

def get_super_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Legacy: Ensure user is super admin.
    Use get_system_admin() for new code.
    """
    if not current_user.is_system_admin:
        raise SuperAdminRequiredException(
            detail="Super Admin access required for this operation"
        )
    return current_user


def get_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Legacy: Ensure user is at least admin (system or tenant).
    Use get_system_admin() or get_tenant_admin_or_owner() for new code.
    """
    # System admin
    if current_user.is_system_admin:
        return current_user

    # Tenant admin or owner
    if current_user.is_tenant_user and current_user.tenant_role in [TenantRole.OWNER, TenantRole.ADMIN]:
        return current_user

    raise UnauthorizedException(
        detail="Admin access required for this operation"
    )


def verify_tenant_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Legacy: Verify user is admin of their tenant (not system user).
    Use get_tenant_admin_or_owner() for new code.
    """
    if current_user.is_system_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System users should use admin endpoints"
        )

    if current_user.tenant_role not in [TenantRole.OWNER, TenantRole.ADMIN]:
        raise UnauthorizedException(
            detail="Tenant Admin access required"
        )

    return current_user


def require_permission(permission: Permission):
    """
    Legacy: Factory function for checking permissions using old Permission enum.
    Use require_system_permission() or require_tenant_permission() for new code.
    """
    def check_permission(
        current_user: User = Depends(get_current_active_user),
    ):
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission.value}' required"
            )
        return current_user

    return check_permission
