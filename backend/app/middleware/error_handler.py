"""
Global Error Handler Middleware for Harmony SaaS
Standardizes error responses and provides detailed logging
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from pydantic import ValidationError
from loguru import logger
import traceback
from typing import Union
from datetime import datetime


class ErrorResponse:
    """Standardized error response format"""

    @staticmethod
    def create(
        error_code: str,
        message: str,
        details: Union[dict, list, str, None] = None,
        status_code: int = 500
    ) -> dict:
        """
        Create standardized error response

        Args:
            error_code: Machine-readable error code
            message: Human-readable error message
            details: Additional error details
            status_code: HTTP status code

        Returns:
            dict: Standardized error response
        """
        response = {
            "error": {
                "code": error_code,
                "message": message,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        }

        if details:
            response["error"]["details"] = details

        return response


def get_cors_headers(request: Request) -> dict:
    """Get CORS headers based on request origin"""
    from app.config import settings
    origin = request.headers.get("origin", "")
    if origin in settings.CORS_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors

    Returns 422 with detailed validation errors
    """
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })

    logger.warning(f"Validation error on {request.url.path}: {errors}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ErrorResponse.create(
            error_code="validation_error",
            message="The request data failed validation",
            details=errors,
            status_code=422
        ),
        headers=get_cors_headers(request)
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    Handle database errors

    Returns 500 with sanitized error message
    """
    error_message = "A database error occurred"

    # Handle specific database errors
    if isinstance(exc, IntegrityError):
        error_message = "The operation conflicts with existing data"

        # Try to extract useful information from constraint violation
        if "unique constraint" in str(exc).lower():
            error_message = "This record already exists"
        elif "foreign key constraint" in str(exc).lower():
            error_message = "This operation references non-existent data"

    logger.error(f"Database error on {request.url.path}: {str(exc)}")
    logger.debug(traceback.format_exc())

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse.create(
            error_code="database_error",
            message=error_message,
            status_code=500
        ),
        headers=get_cors_headers(request)
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """
    Handle all unhandled exceptions

    Returns 500 with generic error message
    """
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}: "
        f"{type(exc).__name__}: {str(exc)}"
    )
    logger.debug(traceback.format_exc())

    # In development, include exception details
    # In production, keep it generic for security
    details = None
    from app.config import settings
    if settings.DEBUG:
        details = {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc().split("\n")
        }

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse.create(
            error_code="internal_server_error",
            message="An unexpected error occurred. Please try again later.",
            details=details,
            status_code=500
        ),
        headers=get_cors_headers(request)
    )


def register_exception_handlers(app):
    """
    Register all exception handlers with the FastAPI app

    Args:
        app: FastAPI application instance
    """
    # Pydantic validation errors
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    # Database errors
    app.add_exception_handler(SQLAlchemyError, database_exception_handler)

    # Catch-all for unexpected errors
    app.add_exception_handler(Exception, generic_exception_handler)

    logger.info("Global exception handlers registered")
