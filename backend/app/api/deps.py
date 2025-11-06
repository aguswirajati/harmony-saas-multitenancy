"""
Dependencies for Phase 6A - Tenant Management
Provides dependency injection for authentication, authorization, and tenant context
"""
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.tenant import Tenant
from app.core.exceptions import UnauthorizedException, SuperAdminRequiredException

security = HTTPBearer()


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


def get_super_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Ensure user is super admin
    Super admin is identified by role='super_admin'
    """
    if current_user.role != 'super_admin':
        raise SuperAdminRequiredException(
            detail="Super Admin access required for this operation"
        )
    return current_user


def get_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Ensure user is at least admin (super_admin or admin)
    """
    if current_user.role not in ['super_admin', 'admin']:
        raise UnauthorizedException(
            detail="Admin access required for this operation"
        )
    return current_user


def get_tenant_context(
    x_tenant_id: Optional[str] = Header(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Tenant:
    """
    Get tenant context from header or current user
    Used for multi-tenant operations
    """
    # Super admin can specify tenant via header
    if current_user.role == 'super_admin' and x_tenant_id:
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
    
    # Regular users use their own tenant
    if not current_user.tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no associated tenant"
        )
    
    return current_user.tenant


def get_current_tenant(
    current_user: User = Depends(get_current_active_user)
) -> Tenant:
    """
    Get current user's tenant (for tenant self-service operations)
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


def verify_tenant_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Verify user is admin of their tenant (not super_admin)
    Used for tenant settings management
    """
    if current_user.role == 'super_admin':
        # Super admin should use dedicated endpoints, not tenant endpoints
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin should use admin endpoints"
        )
    
    if current_user.role != 'admin':
        raise UnauthorizedException(
            detail="Tenant Admin access required"
        )
    
    return current_user


# Optional: Dependency for checking feature access
def require_feature(feature_name: str):
    """
    Factory function to create dependency for checking feature access
    Usage: @router.get("/", dependencies=[Depends(require_feature("inventory_module"))])
    """
    def check_feature(
        tenant: Tenant = Depends(get_current_tenant)
    ):
        if not tenant.features.get(feature_name, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_name}' is not enabled for this tenant"
            )
        return True
    
    return check_feature
