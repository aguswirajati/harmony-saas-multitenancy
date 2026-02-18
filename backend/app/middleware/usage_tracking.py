"""
Usage Tracking Middleware for Harmony SaaS
Tracks API calls per tenant for usage metering.
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Callable, Set
from loguru import logger
from jose import jwt, JWTError
from app.config import settings
from app.core.database import SessionLocal
from app.services.usage_service import UsageService
from app.models.usage import MetricType


class UsageTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track API calls per tenant.

    Increments the api_calls usage counter for each successful API request.
    Excludes certain paths (auth, public, health checks).
    """

    # Paths that should NOT be counted as API usage
    EXCLUDED_PATHS: Set[str] = {
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/verify-email",
        "/api/v1/auth/accept-invite",
        "/api/v1/subscription-tiers/public",
        "/api/v1/payment-methods/public",
        "/health",
        "/",
    }

    # Path prefixes that should NOT be counted
    EXCLUDED_PREFIXES = (
        "/api/v1/internal/",
        "/api/v1/admin/tools/",
    )

    # HTTP methods that should NOT be counted (e.g., OPTIONS for CORS preflight)
    EXCLUDED_METHODS = {"OPTIONS", "HEAD"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and track API usage.

        Only counts successful (2xx) API responses for authenticated tenants.
        """
        # Skip excluded methods
        if request.method in self.EXCLUDED_METHODS:
            return await call_next(request)

        # Skip excluded paths
        path = request.url.path
        if path in self.EXCLUDED_PATHS:
            return await call_next(request)

        # Skip excluded prefixes
        if any(path.startswith(prefix) for prefix in self.EXCLUDED_PREFIXES):
            return await call_next(request)

        # Process the request
        response = await call_next(request)

        # Only track successful requests (2xx status codes)
        if 200 <= response.status_code < 300:
            await self._track_usage(request)

        return response

    async def _track_usage(self, request: Request) -> None:
        """Extract tenant ID and increment usage counter."""
        try:
            # Try to get tenant_id from request state (set by auth)
            tenant_id = getattr(request.state, 'tenant_id', None)

            if not tenant_id:
                # Try to extract from JWT token
                tenant_id = self._extract_tenant_from_token(request)

            if not tenant_id:
                # Try to get from X-Tenant-ID header (super admin)
                tenant_id = request.headers.get('X-Tenant-ID')

            if tenant_id:
                # Use a separate database session for tracking
                db = SessionLocal()
                try:
                    UsageService.increment_usage(db, tenant_id, MetricType.API_CALLS, 1)
                except Exception as e:
                    logger.warning(f"Failed to track API usage for tenant {tenant_id}: {e}")
                finally:
                    db.close()

        except Exception as e:
            # Don't let usage tracking errors affect the request
            logger.warning(f"Usage tracking error: {e}")

    def _extract_tenant_from_token(self, request: Request) -> str | None:
        """Extract tenant_id from JWT token in Authorization header."""
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None

        token = auth_header[7:]  # Remove 'Bearer ' prefix

        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            return payload.get('tenant_id')
        except JWTError:
            return None


class UsageTrackingDependency:
    """
    Dependency-based usage tracking for fine-grained control.

    Use this as a dependency in specific routes instead of global middleware
    if you need more control over what gets tracked.
    """

    def __init__(self, metric_type: str = MetricType.API_CALLS, amount: int = 1):
        self.metric_type = metric_type
        self.amount = amount

    async def __call__(self, request: Request):
        """Track usage when this dependency is invoked."""
        tenant_id = getattr(request.state, 'tenant_id', None)
        if not tenant_id:
            return

        db = SessionLocal()
        try:
            UsageService.increment_usage(db, tenant_id, self.metric_type, self.amount)
        except Exception as e:
            logger.warning(f"Failed to track usage: {e}")
        finally:
            db.close()
