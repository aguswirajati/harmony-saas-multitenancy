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
