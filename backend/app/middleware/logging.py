"""
Request Logging Middleware for Harmony SaaS
Logs all HTTP requests and responses with timing information
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
import uuid
from loguru import logger
from typing import Callable


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all HTTP requests and responses
    Adds request ID for tracing
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and log details

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/route handler

        Returns:
            Response: HTTP response
        """
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Extract client information
        client_ip = request.client.host if request.client else "unknown"
        method = request.method
        path = request.url.path
        query_params = str(request.url.query) if request.url.query else ""

        # Log request start
        start_time = time.time()

        logger.info(
            f"[{request_id}] {method} {path} - "
            f"Client: {client_ip} - "
            f"Query: {query_params if query_params else 'None'}"
        )

        try:
            # Process request
            response = await call_next(request)

            # Calculate processing time
            process_time = (time.time() - start_time) * 1000  # Convert to ms

            # Log response
            logger.info(
                f"[{request_id}] {method} {path} - "
                f"Status: {response.status_code} - "
                f"Duration: {process_time:.2f}ms"
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            # Add processing time to response headers
            response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

            return response

        except Exception as e:
            # Log error
            process_time = (time.time() - start_time) * 1000
            logger.error(
                f"[{request_id}] {method} {path} - "
                f"Error: {type(e).__name__}: {str(e)} - "
                f"Duration: {process_time:.2f}ms"
            )
            raise


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Simpler middleware that just adds request ID
    Use this if you don't want full logging
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add request ID to all requests"""
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response
