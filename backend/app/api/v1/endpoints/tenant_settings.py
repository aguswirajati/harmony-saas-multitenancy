"""
Tenant Settings Endpoints

Tenant self-service operations for:
- Viewing tenant info and subscription
- Updating settings and format preferences
- Checking limits and features
- Account closure (owner only)
"""
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import (
    get_current_tenant,
    get_tenant_admin_or_owner,
    get_tenant_owner,
    require_tenant_permission,
)
from app.core.permissions import TenantPermission
from app.models.user import User
from app.models.tenant import Tenant
from app.services.tenant_service import TenantService
from app.services.payment_service import PaymentService
from app.schemas.tenant import (
    TenantResponse, TenantSettingsUpdate, TenantUsageResponse,
    AvailableTiers, FormatSettings
)
from app.schemas.payment import SubscriptionInfo
from app.schemas.user import AccountClosureRequest

router = APIRouter(prefix="/tenant-settings", tags=["Tenant Settings"])


@router.get("/", response_model=TenantResponse)
def get_my_tenant(
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get current tenant information

    **Available to all authenticated users**

    Returns the tenant information for the currently logged-in user
    """
    return current_tenant


@router.get("/subscription", response_model=SubscriptionInfo)
def get_subscription_info(
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get subscription information for the tenant

    **Available to all authenticated users**

    Returns:
    - Current tier and billing period
    - Subscription validity period (start/end dates)
    - Days remaining in current period
    - Credit balance
    - Scheduled tier change (if any downgrade is scheduled)
    """
    service = PaymentService(db)
    return service.get_subscription_info(current_tenant.id)


@router.post("/subscription/cancel-scheduled")
def cancel_scheduled_downgrade(
    request: Request,
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_tenant_admin_or_owner)
):
    """
    Cancel a scheduled downgrade

    **Tenant Admin Only**

    Cancels a pending tier downgrade that was scheduled for the end of
    the billing period.
    """
    service = PaymentService(db)
    tenant = service.cancel_scheduled_downgrade(
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        request=request,
    )
    return {
        "message": "Scheduled downgrade cancelled",
        "tier": tenant.tier,
    }


@router.get("/usage", response_model=TenantUsageResponse)
def get_tenant_usage(
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get current usage statistics vs limits
    
    **Available to all authenticated users**
    
    Shows:
    - Current users vs limit
    - Current branches vs limit
    - Storage used vs limit
    - Warnings when limits are reached
    - Next tier upgrade information
    """
    service = TenantService(db)
    return service.get_tenant_usage(current_tenant.id)


@router.get("/tiers", response_model=AvailableTiers)
def get_available_tiers(
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get available subscription tiers with pricing
    
    **Available to all authenticated users**
    
    Returns:
    - List of all tiers (free, basic, premium, enterprise)
    - Features and limits for each tier
    - Pricing information
    - Current tier highlighted
    """
    service = TenantService(None)  # No DB needed for static tier info
    return service.get_available_tiers(current_tenant.tier)


@router.put("/settings", response_model=TenantResponse)
def update_tenant_settings(
    settings_data: TenantSettingsUpdate,
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(require_tenant_permission(TenantPermission.SETTINGS_EDIT))
):
    """
    Update tenant settings (self-service)

    **Tenant Admin Only**

    Allows tenant admins to update:
    - Organization name
    - Logo URL
    - Custom settings (timezone, language, etc.)

    Cannot update:
    - Subscription tier (contact super admin)
    - Limits (contact super admin)
    - Feature flags (contact super admin)
    """
    service = TenantService(db)
    return service.update_tenant_settings(current_tenant.id, settings_data)


@router.get("/format", response_model=FormatSettings)
def get_format_settings(
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get current format settings for the tenant

    **Available to all authenticated users**

    Returns format settings for currency, numbers, and dates:
    - currency_code: ISO currency code (e.g., "IDR", "USD")
    - currency_symbol_position: "before" or "after"
    - decimal_separator: Character for decimals (e.g., "," or ".")
    - thousands_separator: Character for thousands (e.g., "." or ",")
    - price_decimal_places: Number of decimal places for prices (0-4)
    - quantity_decimal_places: Number of decimal places for quantities (0-4)
    - date_format: Date display format (e.g., "DD/MM/YYYY")
    - timezone: Tenant timezone (e.g., "Asia/Jakarta")
    """
    service = TenantService(db)
    return service.get_format_settings(current_tenant.id)


@router.put("/format", response_model=FormatSettings)
def update_format_settings(
    format_data: FormatSettings,
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(require_tenant_permission(TenantPermission.SETTINGS_EDIT))
):
    """
    Update format settings for the tenant

    **Tenant Admin Only (requires settings.update permission)**

    Updates format settings for currency, numbers, and dates.
    Settings are stored in the tenant.settings['format'] JSON field.
    """
    service = TenantService(db)
    return service.update_format_settings(current_tenant.id, format_data)


@router.get("/limits/users")
def check_user_limit(
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Check if tenant can add more users
    
    **Available to all authenticated users**
    
    Returns:
    - can_add: boolean
    - current_count: int
    - limit: int
    - available: int
    """
    service = TenantService(db)
    can_add = service.check_user_limit(current_tenant.id)
    
    # Get current usage
    usage = service.get_tenant_usage(current_tenant.id)
    
    return {
        "can_add": can_add,
        "current_count": usage.users_current,
        "limit": usage.users_limit,
        "available": usage.users_available,
        "percentage": usage.users_percent
    }


@router.get("/limits/branches")
def check_branch_limit(
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Check if tenant can add more branches
    
    **Available to all authenticated users**
    
    Returns:
    - can_add: boolean
    - current_count: int
    - limit: int
    - available: int
    """
    service = TenantService(db)
    can_add = service.check_branch_limit(current_tenant.id)
    
    # Get current usage
    usage = service.get_tenant_usage(current_tenant.id)
    
    return {
        "can_add": can_add,
        "current_count": usage.branches_current,
        "limit": usage.branches_limit,
        "available": usage.branches_available,
        "percentage": usage.branches_percent
    }


@router.get("/features/{feature_name}")
def check_feature_access(
    feature_name: str,
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Check if tenant has access to a specific feature

    **Available to all authenticated users**

    Returns:
    - feature_name: str
    - enabled: boolean
    """
    service = TenantService(db)
    enabled = service.validate_feature_access(current_tenant.id, feature_name)

    return {
        "feature_name": feature_name,
        "enabled": enabled
    }


# ============================================================================
# ACCOUNT MANAGEMENT (Owner Only)
# ============================================================================

@router.delete("/account", status_code=status.HTTP_200_OK)
def close_account(
    closure_request: AccountClosureRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_tenant_owner)
):
    """
    Permanently close tenant account and delete all data (Owner only)

    **DANGER: This action is irreversible!**

    Requirements:
    - User must be the tenant owner
    - Must confirm by typing "DELETE MY ACCOUNT"
    - Must provide current password

    This will:
    - Hard delete all tenant data (users, branches, files, etc.)
    - Cancel any active subscriptions
    - Remove the tenant record

    Returns confirmation of deletion.
    """
    from app.core.security import verify_password
    from app.services.audit_service import AuditService
    from app.models.audit_log import AuditAction, AuditStatus

    # Verify password
    if not verify_password(closure_request.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password"
        )

    # Log the account closure before deletion
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=current_tenant.id,
        action=AuditAction.TENANT_DELETED,
        resource="tenant",
        resource_id=current_tenant.id,
        details={
            "tenant_name": current_tenant.name,
            "owner_email": current_user.email,
            "action": "account_closure",
        },
        status=AuditStatus.SUCCESS,
        request=request
    )

    # Delete the tenant (cascades to all related data)
    service = TenantService(db)
    service.hard_delete_tenant(current_tenant.id)

    return {
        "message": "Account closed successfully",
        "tenant_name": current_tenant.name,
        "deleted_at": "now"
    }
