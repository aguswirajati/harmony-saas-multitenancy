from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1 import router as api_v1_router
from app.middleware.error_handler import register_exception_handlers
from app.middleware.logging import RequestLoggingMiddleware
from loguru import logger

# Sentry error tracking (no-op if SENTRY_DSN not configured)
if getattr(settings, "SENTRY_DSN", None):
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=getattr(settings, "SENTRY_TRACES_SAMPLE_RATE", 0.1),
        environment=getattr(settings, "SENTRY_ENVIRONMENT", "production"),
        send_default_pii=False,
    )

# Configure logger
logger.add(
    "logs/app.log",
    rotation="500 MB",
    retention="10 days",
    level="INFO",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"
)

app = FastAPI(
    title=settings.APP_NAME,
    description="""
Harmony is an enterprise-grade SaaS multi-tenant API with branch management.

## Authentication
All authenticated endpoints require a Bearer token in the `Authorization` header.
Tokens are obtained via `/api/v1/auth/login` or `/api/v1/auth/register`.

## Multi-Tenancy
- **Super Admins** manage all tenants via `/api/v1/admin/*` endpoints
- **Tenant Admins** manage their own organization via `/api/v1/users`, `/api/v1/branches`, etc.
- **Staff** have read access within their tenant

## Rate Limiting
Auth endpoints are rate-limited. The `X-RateLimit-*` headers indicate current usage.
""",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    openapi_tags=[
        {"name": "Authentication", "description": "Login, registration, token refresh, password reset, and email verification"},
        {"name": "Users", "description": "Tenant user management (scoped to current tenant)"},
        {"name": "Branches", "description": "Branch/location management within a tenant"},
        {"name": "Tenants", "description": "Super admin tenant management across the platform"},
        {"name": "Tenant Settings", "description": "Self-service tenant settings, usage, and limits"},
        {"name": "Admin - Users", "description": "Super admin cross-tenant user queries"},
        {"name": "Admin - Stats", "description": "System-wide statistics for super admins"},
        {"name": "Admin - Tools", "description": "Development and maintenance tools (super admin only)"},
        {"name": "Admin - Audit", "description": "Audit log viewing and analysis (super admin only)"},
        {"name": "Health", "description": "Service health check endpoints"},
    ]
)

# CORS - must be added first (executed last in middleware stack = outermost layer)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"]
)

# Request Logging Middleware
app.add_middleware(RequestLoggingMiddleware)

# Register exception handlers
register_exception_handlers(app)

# Include API router
app.include_router(api_v1_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "message": "SaaS Multi-Tenant API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint. Returns 200 if the API is running."""
    return {"status": "healthy"}

@app.get("/health/detailed", tags=["Health"])
async def detailed_health_check():
    """Detailed health check with database and Redis connection status."""
    from app.core.database import SessionLocal
    from app.middleware.rate_limiter import rate_limiter
    import time

    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "services": {}
    }

    # Check database connection
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        health_status["services"]["database"] = "healthy"
    except Exception as e:
        health_status["services"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    # Check Redis connection
    try:
        if rate_limiter.redis_client:
            await rate_limiter.redis_client.ping()
            health_status["services"]["redis"] = "healthy"
        else:
            health_status["services"]["redis"] = "not_configured"
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    return health_status
