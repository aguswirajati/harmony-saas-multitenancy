"""
Custom Exceptions for Phase 6A - Tenant Management
Provides specific exception types for better error handling
"""
from fastapi import HTTPException, status


class TenantNotFoundException(HTTPException):
    """Raised when tenant is not found"""
    def __init__(self, detail: str = "Tenant not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class TenantExistsException(HTTPException):
    """Raised when tenant already exists"""
    def __init__(self, detail: str = "Tenant already exists"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )


class SubdomainTakenException(HTTPException):
    """Raised when subdomain is already taken"""
    def __init__(self, detail: str = "Subdomain already taken"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )


class LimitExceededException(HTTPException):
    """Raised when tenant limit is exceeded"""
    def __init__(self, detail: str = "Tenant limit exceeded"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class UnauthorizedException(HTTPException):
    """Raised when user is not authorized"""
    def __init__(self, detail: str = "Not authorized"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class SuperAdminRequiredException(HTTPException):
    """Raised when super admin access is required"""
    def __init__(self, detail: str = "Super Admin access required"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class NotFoundException(HTTPException):
    """Raised when a resource is not found"""
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class PermissionDeniedException(HTTPException):
    """Raised when user doesn't have permission for an action"""
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class FileValidationException(HTTPException):
    """Raised when file validation fails"""
    def __init__(self, detail: str = "File validation failed"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class ConflictException(HTTPException):
    """Raised when there is a conflict with existing data"""
    def __init__(self, detail: str = "Conflict with existing data"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )


class BadRequestException(HTTPException):
    """Raised when the request is invalid"""
    def __init__(self, detail: str = "Bad request"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class ForbiddenException(HTTPException):
    """Raised when access is forbidden"""
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )
