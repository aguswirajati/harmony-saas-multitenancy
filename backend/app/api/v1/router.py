from app.api.v1.endpoints import tenants, tenant_settings

# Existing routes
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(branches.router, prefix="/branches", tags=["branches"])

# NEW ROUTES
router.include_router(tenants.router, prefix="/admin/tenants", tags=["super-admin-tenants"])
router.include_router(tenant_settings.router, prefix="/tenant", tags=["tenant-settings"])