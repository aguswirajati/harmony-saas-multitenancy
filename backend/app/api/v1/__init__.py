from fastapi import APIRouter
from app.api.v1.endpoints import auth, branches, users, tenants, tenant_settings

router = APIRouter()

router.include_router(auth.router)
router.include_router(branches.router)
router.include_router(users.router)
router.include_router(tenants.router)
router.include_router(tenant_settings.router)
