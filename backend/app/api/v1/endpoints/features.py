"""
Feature API Endpoints

Endpoints for feature flag management and checking.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.api.deps import (
    get_current_active_user,
    get_current_tenant,
    get_super_admin_user,
)
from app.models.user import User
from app.models.tenant import Tenant
from app.services.feature_service import FeatureService
from app.core.features import (
    FEATURE_REGISTRY,
    FeatureModule,
    get_features_grouped_by_module,
    get_all_feature_codes,
)
from app.schemas.features import (
    FeatureMetadataResponse,
    FeatureStatusResponse,
    TenantFeaturesResponse,
    FeatureCheckResponse,
    AllFeaturesResponse,
    TierFeaturesUpdate,
    TierFeatureMatrix,
    TenantFeatureOverride,
)

router = APIRouter(prefix="/features", tags=["Features"])


# ============================================================================
# TENANT ENDPOINTS (authenticated users)
# ============================================================================

@router.get("", response_model=TenantFeaturesResponse)
async def get_tenant_features(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """
    Get all enabled features for the current tenant.

    Returns the list of feature codes, the tier, and any overrides.
    """
    features = FeatureService.get_tenant_features(db, tenant)
    return TenantFeaturesResponse(
        features=sorted(list(features)),
        tier=tenant.tier,
        overrides=tenant.features or {},
    )


@router.get("/check/{feature_code}", response_model=FeatureCheckResponse)
async def check_feature(
    feature_code: str,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """
    Check if a specific feature is enabled for the current tenant.
    """
    enabled = FeatureService.has_feature(db, tenant, feature_code)
    return FeatureCheckResponse(code=feature_code, enabled=enabled)


@router.get("/detailed", response_model=List[FeatureStatusResponse])
async def get_features_detailed(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """
    Get all features with their status and source for the current tenant.
    """
    return FeatureService.get_features_with_status(db, tenant)


# ============================================================================
# ADMIN ENDPOINTS (super admin only)
# ============================================================================

admin_router = APIRouter(prefix="/admin/features", tags=["Admin - Features"])


@admin_router.get("", response_model=AllFeaturesResponse)
async def get_all_features(
    current_user: User = Depends(get_super_admin_user),
):
    """
    Get all available features grouped by module.
    """
    grouped = get_features_grouped_by_module()
    modules = {}
    for module_name, features in grouped.items():
        modules[module_name] = [
            FeatureMetadataResponse(
                code=f.code,
                name=f.name,
                description=f.description,
                module=f.module.value,
            )
            for f in features
        ]

    return AllFeaturesResponse(
        modules=modules,
        total_count=len(get_all_feature_codes()),
    )


@admin_router.get("/matrix", response_model=TierFeatureMatrix)
async def get_tier_feature_matrix(
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get feature availability matrix across all tiers.
    """
    matrix = FeatureService.get_tier_feature_matrix(db)
    return TierFeatureMatrix(
        tiers=list(matrix.keys()),
        features=get_all_feature_codes(),
        matrix=matrix,
    )


@admin_router.put("/tiers/{tier_code}", response_model=dict)
async def update_tier_features(
    tier_code: str,
    data: TierFeaturesUpdate,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update the features list for a subscription tier.
    """
    try:
        tier = FeatureService.update_tier_features(db, tier_code, data.features)
        return {
            "message": f"Updated features for tier '{tier_code}'",
            "tier_code": tier.code,
            "features_count": len(data.features),
            "features": data.features,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@admin_router.get("/tenants/{tenant_id}", response_model=List[FeatureStatusResponse])
async def get_tenant_features_admin(
    tenant_id: UUID,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get all features with status for a specific tenant (admin view).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )
    return FeatureService.get_features_with_status(db, tenant)


@admin_router.post("/tenants/{tenant_id}/override", response_model=dict)
async def override_tenant_feature(
    tenant_id: UUID,
    data: TenantFeatureOverride,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """
    Enable or disable a specific feature for a tenant (override tier).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    if data.feature_code not in get_all_feature_codes():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid feature code: {data.feature_code}",
        )

    if data.action == "enable":
        FeatureService.enable_feature(db, tenant, data.feature_code)
    elif data.action == "disable":
        FeatureService.disable_feature(db, tenant, data.feature_code)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'enable' or 'disable'",
        )

    return {
        "message": f"Feature '{data.feature_code}' {data.action}d for tenant",
        "tenant_id": str(tenant_id),
        "feature_code": data.feature_code,
        "action": data.action,
    }


@admin_router.delete("/tenants/{tenant_id}/overrides", response_model=dict)
async def reset_tenant_overrides(
    tenant_id: UUID,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """
    Reset a tenant's feature overrides to tier defaults.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    FeatureService.reset_tenant_overrides(db, tenant)

    return {
        "message": "Feature overrides reset to tier defaults",
        "tenant_id": str(tenant_id),
        "tier": tenant.tier,
    }
