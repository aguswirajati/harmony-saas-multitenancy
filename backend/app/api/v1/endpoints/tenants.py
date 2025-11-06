"""
Tenant Management Endpoints for Phase 6A
Super Admin operations for managing tenants
"""
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_super_admin_user
from app.models.user import User
from app.services.tenant_service import TenantService
from app.schemas.tenant import (
    TenantCreate, TenantUpdate, TenantSubscriptionUpdate,
    TenantFeatureUpdate, TenantStatusUpdate, TenantResponse,
    TenantSummary, TenantStats, TenantListResponse, SystemStats
)

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.post("/", response_model=TenantResponse, status_code=201)
def create_tenant(
    tenant_data: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Create new tenant with admin user and HQ branch
    
    **Super Admin Only**
    
    This endpoint:
    - Creates a new tenant organization
    - Creates HQ branch automatically
    - Creates admin user for the tenant
    - Sets up default limits based on tier
    """
    service = TenantService(db)
    tenant = service.create_tenant(tenant_data)
    return tenant


@router.get("/", response_model=TenantListResponse)
def get_tenants(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Number of records to return"),
    tier: Optional[str] = Query(None, description="Filter by tier"),
    status: Optional[str] = Query(None, description="Filter by subscription status"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by name or subdomain"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Get all tenants with filters and pagination
    
    **Super Admin Only**
    
    Filters:
    - tier: free, basic, premium, enterprise
    - status: active, trial, expired, cancelled, suspended
    - is_active: true/false
    - search: searches in name and subdomain
    """
    service = TenantService(db)
    tenants, total = service.get_all_tenants(
        skip=skip,
        limit=limit,
        tier=tier,
        status=status,
        is_active=is_active,
        search=search
    )
    
    # Convert to summaries with user/branch counts
    summaries = []
    for tenant in tenants:
        summary = TenantSummary(
            id=tenant.id,
            name=tenant.name,
            subdomain=tenant.subdomain,
            tier=tenant.tier,
            subscription_status=tenant.subscription_status,
            is_active=tenant.is_active,
            created_at=tenant.created_at,
            user_count=len([u for u in tenant.users if u.is_active]),
            branch_count=len([b for b in tenant.branches if b.is_active])
        )
        summaries.append(summary)
    
    # Calculate pagination
    total_pages = (total + limit - 1) // limit
    page = (skip // limit) + 1
    
    return TenantListResponse(
        items=summaries,
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages
    )


@router.get("/stats", response_model=SystemStats)
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Get system-wide statistics
    
    **Super Admin Only**
    
    Returns:
    - Total tenants by status and tier
    - Total users and branches
    - Recent activity metrics
    - Expiring trials/subscriptions
    """
    service = TenantService(db)
    return service.get_system_stats()


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: UUID = Path(..., description="Tenant ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Get tenant details by ID
    
    **Super Admin Only**
    """
    service = TenantService(db)
    return service.get_tenant_by_id(tenant_id)


@router.get("/{tenant_id}/stats", response_model=TenantStats)
def get_tenant_statistics(
    tenant_id: UUID = Path(..., description="Tenant ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Get detailed statistics for a specific tenant
    
    **Super Admin Only**
    
    Returns:
    - Usage vs limits (users, branches, storage)
    - Trial/expiry status
    - Last activity timestamp
    """
    service = TenantService(db)
    return service.get_tenant_stats(tenant_id)


@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: UUID = Path(..., description="Tenant ID"),
    update_data: TenantUpdate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Update tenant basic information
    
    **Super Admin Only**
    
    Can update:
    - name
    - domain
    - logo_url
    - settings
    - meta_data
    """
    service = TenantService(db)
    return service.update_tenant(tenant_id, update_data)


@router.put("/{tenant_id}/subscription", response_model=TenantResponse)
def update_tenant_subscription(
    tenant_id: UUID = Path(..., description="Tenant ID"),
    subscription_data: TenantSubscriptionUpdate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Update tenant subscription and limits
    
    **Super Admin Only**
    
    Can update:
    - tier (free, basic, premium, enterprise)
    - subscription_status
    - max_users, max_branches, max_storage_gb
    - trial_ends_at, subscription_ends_at
    """
    service = TenantService(db)
    return service.update_subscription(tenant_id, subscription_data)


@router.put("/{tenant_id}/features", response_model=TenantResponse)
def update_tenant_features(
    tenant_id: UUID = Path(..., description="Tenant ID"),
    feature_data: TenantFeatureUpdate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Update tenant feature flags
    
    **Super Admin Only**
    
    Enable/disable specific features:
    - inventory_module
    - sales_module
    - pos_module
    - analytics
    - api_access
    - etc.
    """
    service = TenantService(db)
    return service.update_features(tenant_id, feature_data)


@router.patch("/{tenant_id}/status", response_model=TenantResponse)
def update_tenant_status(
    tenant_id: UUID = Path(..., description="Tenant ID"),
    status_data: TenantStatusUpdate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Activate or deactivate tenant
    
    **Super Admin Only**
    
    - Sets is_active flag
    - Logs reason in metadata
    - When inactive, tenant users cannot login
    """
    service = TenantService(db)
    return service.update_status(tenant_id, status_data)


@router.delete("/{tenant_id}", status_code=204)
def delete_tenant(
    tenant_id: UUID = Path(..., description="Tenant ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Delete (deactivate) tenant
    
    **Super Admin Only**
    
    This performs a soft delete:
    - Sets is_active = False
    - Sets deleted_at timestamp
    - Data is preserved for recovery
    
    For hard delete, use database operations directly
    """
    service = TenantService(db)
    service.delete_tenant(tenant_id)
    return None


@router.get("/subdomain/{subdomain}", response_model=TenantResponse)
def get_tenant_by_subdomain(
    subdomain: str = Path(..., description="Tenant subdomain"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user)
):
    """
    Get tenant by subdomain
    
    **Super Admin Only**
    
    Useful for looking up tenants by their subdomain identifier
    """
    service = TenantService(db)
    tenant = service.get_tenant_by_subdomain(subdomain)
    if not tenant:
        from app.core.exceptions import TenantNotFoundException
        raise TenantNotFoundException(f"Tenant with subdomain '{subdomain}' not found")
    return tenant
