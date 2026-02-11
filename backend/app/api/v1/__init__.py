from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    branches,
    users,
    tenants,
    tenant_settings,
    admin_stats,
    admin_tools,
    audit,
    files,
    subscription_tiers,
    payment_methods,
    upgrade_requests,
)

router = APIRouter()

router.include_router(auth.router)
router.include_router(branches.router)
router.include_router(users.router)
router.include_router(users.admin_router)
router.include_router(tenants.router)
router.include_router(tenant_settings.router)
router.include_router(admin_stats.router)
router.include_router(admin_tools.router)
router.include_router(audit.router)
router.include_router(files.router)

# Subscription management
router.include_router(subscription_tiers.admin_router)
router.include_router(subscription_tiers.public_router)
router.include_router(payment_methods.admin_router)
router.include_router(payment_methods.public_router)
router.include_router(upgrade_requests.tenant_router)
router.include_router(upgrade_requests.admin_router)
