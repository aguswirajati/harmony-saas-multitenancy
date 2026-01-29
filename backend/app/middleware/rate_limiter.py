"""
Rate Limiting Middleware for Harmony SaaS
Implements Redis-based rate limiting to prevent abuse and brute force attacks
"""
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional, Callable
import redis.asyncio as redis
from datetime import datetime, timedelta
from loguru import logger
import hashlib

from app.config import settings


class RateLimiter:
    """Redis-based rate limiter for API endpoints"""

    def __init__(self):
        """Initialize Redis connection"""
        self.redis_client: Optional[redis.Redis] = None
        self._initialize_redis()

    def _initialize_redis(self):
        """Initialize Redis connection pool"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            logger.info("Rate limiter Redis connection initialized")
        except Exception as e:
            logger.error(f"Failed to connect to Redis for rate limiting: {e}")
            self.redis_client = None

    async def check_rate_limit(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> tuple[bool, dict]:
        """
        Check if request is within rate limit

        Args:
            key: Unique identifier for the rate limit (e.g., IP address, user ID)
            max_requests: Maximum number of requests allowed
            window_seconds: Time window in seconds

        Returns:
            tuple: (is_allowed, info_dict)
                - is_allowed: True if request should be allowed
                - info_dict: Contains limit, remaining, reset time
        """
        if not self.redis_client:
            # If Redis is not available, allow the request (fail open)
            logger.warning("Redis not available, rate limiting disabled")
            return True, {"limit": max_requests, "remaining": max_requests, "reset": 0}

        try:
            current_time = datetime.utcnow()
            window_start = int(current_time.timestamp())

            # Use sliding window algorithm
            redis_key = f"rate_limit:{key}:{window_start // window_seconds}"

            # Increment counter
            current_count = await self.redis_client.incr(redis_key)

            # Set expiration on first request
            if current_count == 1:
                await self.redis_client.expire(redis_key, window_seconds)

            # Get TTL to calculate reset time
            ttl = await self.redis_client.ttl(redis_key)
            reset_time = int(current_time.timestamp()) + ttl

            # Check if limit exceeded
            is_allowed = current_count <= max_requests
            remaining = max(0, max_requests - current_count)

            return is_allowed, {
                "limit": max_requests,
                "remaining": remaining,
                "reset": reset_time,
                "retry_after": ttl if not is_allowed else 0
            }

        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Fail open - allow request if rate limiting fails
            return True, {"limit": max_requests, "remaining": max_requests, "reset": 0}

    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()


# Global rate limiter instance
rate_limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    """
    Extract client IP address from request
    Handles X-Forwarded-For header for proxied requests
    """
    # Check for X-Forwarded-For header (proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Get first IP in the chain
        return forwarded_for.split(",")[0].strip()

    # Check for X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct client IP
    return request.client.host if request.client else "unknown"


def create_rate_limit_key(request: Request, prefix: str = "global") -> str:
    """
    Create a unique rate limit key for the request

    Args:
        request: FastAPI request object
        prefix: Prefix for the key (e.g., "auth", "api")

    Returns:
        str: Unique rate limit key
    """
    client_ip = get_client_ip(request)

    # Try to get user ID from request state (if authenticated)
    user_id = getattr(request.state, "user_id", None)

    if user_id:
        # For authenticated requests, use user ID
        key = f"{prefix}:user:{user_id}"
    else:
        # For unauthenticated requests, use IP address
        key = f"{prefix}:ip:{client_ip}"

    return key


async def rate_limit_dependency(
    request: Request,
    max_requests: int = 100,
    window_seconds: int = 60,
    prefix: str = "api"
) -> None:
    """
    FastAPI dependency for rate limiting

    Args:
        request: FastAPI request object
        max_requests: Maximum requests allowed in window
        window_seconds: Time window in seconds
        prefix: Key prefix for rate limit type

    Raises:
        HTTPException: If rate limit exceeded (429 Too Many Requests)
    """
    if not settings.RATE_LIMIT_ENABLED or settings.DEV_MODE:
        return

    key = create_rate_limit_key(request, prefix)
    is_allowed, info = await rate_limiter.check_rate_limit(
        key, max_requests, window_seconds
    )

    # Add rate limit headers to response
    request.state.rate_limit_info = info

    if not is_allowed:
        logger.warning(
            f"Rate limit exceeded for {key}: "
            f"{info['limit']} requests per {window_seconds}s"
        )

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "message": f"Too many requests. Please try again in {info['retry_after']} seconds.",
                "limit": info["limit"],
                "reset": info["reset"],
                "retry_after": info["retry_after"]
            }
        )


# Predefined rate limit dependencies for common use cases

async def auth_rate_limit(request: Request) -> None:
    """
    Rate limit for authentication endpoints
    More restrictive to prevent brute force attacks
    20 requests per minute for development, adjust for production
    """
    await rate_limit_dependency(
        request,
        max_requests=20,
        window_seconds=60,  # 1 minute
        prefix="auth"
    )


async def api_rate_limit(request: Request) -> None:
    """
    Rate limit for general API endpoints
    100 requests per minute
    """
    await rate_limit_dependency(
        request,
        max_requests=100,
        window_seconds=60,
        prefix="api"
    )


async def strict_rate_limit(request: Request) -> None:
    """
    Strict rate limit for sensitive operations
    3 requests per hour
    """
    await rate_limit_dependency(
        request,
        max_requests=3,
        window_seconds=3600,  # 1 hour
        prefix="strict"
    )


async def relaxed_rate_limit(request: Request) -> None:
    """
    Relaxed rate limit for read-heavy endpoints
    1000 requests per minute
    """
    await rate_limit_dependency(
        request,
        max_requests=1000,
        window_seconds=60,
        prefix="relaxed"
    )
