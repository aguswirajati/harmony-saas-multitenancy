"""
File management endpoints for S3-compatible storage.
Handles file uploads, downloads, and management for tenants.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import math

from app.core.database import get_db
from app.api.deps import (
    get_current_user, get_current_active_user, get_current_tenant,
    get_admin_user, get_tenant_context, require_permission, get_super_admin_user
)
from app.models.user import User
from app.models.tenant import Tenant
from app.models.file import FileCategory, File
from app.models.audit_log import AuditAction
from app.core.permissions import Permission
from app.core.exceptions import (
    NotFoundException, PermissionDeniedException, LimitExceededException,
    FileValidationException
)
from app.schemas.file import (
    FileUploadRequest, FileUploadConfirm,
    PresignedUploadResponse, FileResponse, FileDownloadResponse,
    FileListResponse, FileUpdateRequest,
    TenantLogoUpload, UserAvatarUpload, StorageUsageResponse
)
from app.services.file_storage_service import FileStorageService
from app.services.audit_service import AuditService
from botocore.exceptions import ClientError, EndpointConnectionError

router = APIRouter(prefix="/files", tags=["Files"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def file_to_response(file) -> FileResponse:
    """Convert File model to FileResponse schema."""
    return FileResponse(
        id=file.id,
        filename=file.filename,
        storage_key=file.storage_key,
        content_type=file.content_type,
        size_bytes=file.size_bytes,
        category=file.category,
        resource_type=file.resource_type,
        resource_id=file.resource_id,
        checksum=file.checksum,
        metadata=file.file_metadata or {},
        is_public=file.is_public,
        tenant_id=file.tenant_id,
        branch_id=file.branch_id,
        uploaded_by_id=file.uploaded_by_id,
        is_active=file.is_active,
        created_at=file.created_at,
        updated_at=file.updated_at,
        size_mb=file.size_mb,
        is_image=file.is_image,
    )


# ============================================================================
# PRE-SIGNED URL ENDPOINTS
# ============================================================================

@router.post("/upload/presign", response_model=PresignedUploadResponse)
async def get_presigned_upload_url(
    request: FileUploadRequest,
    current_user: User = Depends(require_permission(Permission.FILES_UPLOAD)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Get a pre-signed URL for direct file upload to S3.

    The client should:
    1. Call this endpoint to get the pre-signed URL
    2. Upload the file directly to S3 using the URL
    3. Call POST /files/upload/confirm to finalize the upload
    """
    service = FileStorageService(db)

    try:
        result = await service.generate_presigned_upload_url(
            tenant_id=tenant.id,
            request=request,
            user_id=current_user.id
        )
        return result
    except ValueError as e:
        raise FileValidationException(str(e))
    except (ClientError, EndpointConnectionError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service unavailable. Please ensure MinIO/S3 is running."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )
    except LimitExceededException:
        raise


@router.post("/upload/confirm", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def confirm_upload(
    request: Request,
    storage_key: str = Query(..., description="Storage key from presigned URL"),
    confirm: FileUploadConfirm = None,
    original_request: FileUploadRequest = None,
    current_user: User = Depends(require_permission(Permission.FILES_UPLOAD)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Confirm file upload and create database record.

    Called after successfully uploading to S3 using the pre-signed URL.
    """
    service = FileStorageService(db)

    # Check if file record already exists
    existing = service.get_file_by_storage_key(storage_key, tenant.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="File already confirmed"
        )

    if not original_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original upload request required"
        )

    if not confirm:
        confirm = FileUploadConfirm(storage_key=storage_key)

    file = service.create_file_record(
        tenant_id=tenant.id,
        user_id=current_user.id,
        request=original_request,
        storage_key=storage_key,
        confirm=confirm
    )

    # Audit log
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action=AuditAction.FILE_UPLOADED,
        resource="file",
        resource_id=file.id,
        details={
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": file.size_bytes,
            "category": file.category,
            "storage_key": file.storage_key
        },
        request=request
    )

    return file_to_response(file)


# ============================================================================
# FILE CRUD ENDPOINTS
# ============================================================================

@router.get("", response_model=FileListResponse)
async def list_files(
    category: Optional[str] = Query(None, description="Filter by category"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    resource_id: Optional[UUID] = Query(None, description="Filter by resource ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(require_permission(Permission.FILES_VIEW)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """List files with optional filters."""
    service = FileStorageService(db)

    files, total = service.list_files(
        tenant_id=tenant.id,
        category=category,
        resource_type=resource_type,
        resource_id=resource_id,
        page=page,
        page_size=page_size
    )

    return FileListResponse(
        items=[file_to_response(f) for f in files],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0
    )


@router.get("/storage", response_model=StorageUsageResponse)
async def get_storage_usage(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get current storage usage for the tenant."""
    service = FileStorageService(db)
    return service.get_storage_usage(tenant.id)


@router.get("/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: UUID,
    current_user: User = Depends(require_permission(Permission.FILES_VIEW)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get file metadata by ID."""
    service = FileStorageService(db)
    file = service.get_file(file_id, tenant.id)

    if not file:
        raise NotFoundException("File not found")

    return file_to_response(file)


@router.get("/{file_id}/download", response_model=FileDownloadResponse)
async def get_download_url(
    file_id: UUID,
    inline: bool = Query(False, description="If true, return URL for viewing in browser instead of download"),
    current_user: User = Depends(require_permission(Permission.FILES_VIEW)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get pre-signed download URL for a file."""
    service = FileStorageService(db)
    file = service.get_file(file_id, tenant.id)

    if not file:
        raise NotFoundException("File not found")

    download_url, expires_at = await service.generate_presigned_download_url(
        file.storage_key,
        file.filename,
        inline=inline
    )

    return FileDownloadResponse(
        download_url=download_url,
        filename=file.filename,
        content_type=file.content_type,
        size_bytes=file.size_bytes,
        expires_at=expires_at
    )


@router.patch("/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: UUID,
    update_data: FileUpdateRequest,
    current_user: User = Depends(require_permission(Permission.FILES_UPLOAD)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Update file metadata."""
    service = FileStorageService(db)
    file = service.update_file(file_id, tenant.id, current_user.id, update_data)

    if not file:
        raise NotFoundException("File not found")

    return file_to_response(file)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    request: Request,
    file_id: UUID,
    hard_delete: bool = Query(False, description="Permanently delete file"),
    current_user: User = Depends(require_permission(Permission.FILES_DELETE)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Delete a file (soft delete by default)."""
    service = FileStorageService(db)

    # Get file info for audit log before deletion
    file = service.get_file(file_id, tenant.id, include_deleted=True)
    file_info = None
    if file:
        file_info = {
            "filename": file.filename,
            "category": file.category,
            "storage_key": file.storage_key,
            "hard_delete": hard_delete
        }

    success = await service.delete_file(
        file_id, tenant.id, current_user.id, hard_delete=hard_delete
    )

    if not success:
        raise NotFoundException("File not found")

    # Audit log
    if file_info:
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=tenant.id,
            action=AuditAction.FILE_DELETED,
            resource="file",
            resource_id=file_id,
            details=file_info,
            request=request
        )


# ============================================================================
# TENANT LOGO ENDPOINTS
# ============================================================================

@router.post("/tenant/logo/presign", response_model=PresignedUploadResponse)
async def get_tenant_logo_upload_url(
    request: TenantLogoUpload,
    current_user: User = Depends(require_permission(Permission.SETTINGS_UPDATE)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get pre-signed URL for tenant logo upload."""
    service = FileStorageService(db)

    # Convert to full upload request
    upload_request = FileUploadRequest(
        filename=request.filename,
        content_type=request.content_type,
        size_bytes=request.size_bytes,
        category=FileCategory.TENANT_LOGO,
        resource_type="tenant",
        resource_id=tenant.id,
        is_public=True
    )

    try:
        result = await service.generate_presigned_upload_url(
            tenant_id=tenant.id,
            request=upload_request,
            user_id=current_user.id
        )
        return result
    except ValueError as e:
        raise FileValidationException(str(e))
    except (ClientError, EndpointConnectionError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service unavailable. Please ensure MinIO/S3 is running."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )


@router.post("/tenant/logo", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def set_tenant_logo(
    request: Request,
    storage_key: str = Query(..., description="Storage key from presigned upload"),
    confirm: FileUploadConfirm = None,
    original_request: TenantLogoUpload = None,
    current_user: User = Depends(require_permission(Permission.SETTINGS_UPDATE)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Confirm tenant logo upload and set as current logo."""
    service = FileStorageService(db)

    if not original_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original upload request required"
        )

    # Create full upload request
    upload_request = FileUploadRequest(
        filename=original_request.filename,
        content_type=original_request.content_type,
        size_bytes=original_request.size_bytes,
        category=FileCategory.TENANT_LOGO,
        resource_type="tenant",
        resource_id=tenant.id,
        is_public=True
    )

    if not confirm:
        confirm = FileUploadConfirm(storage_key=storage_key)

    # Create file record
    file = service.create_file_record(
        tenant_id=tenant.id,
        user_id=current_user.id,
        request=upload_request,
        storage_key=storage_key,
        confirm=confirm
    )

    # Set as tenant logo
    file = await service.set_tenant_logo(tenant.id, current_user.id, file)

    # Audit log
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action=AuditAction.TENANT_LOGO_UPLOADED,
        resource="tenant",
        resource_id=tenant.id,
        details={
            "file_id": str(file.id),
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": file.size_bytes,
            "storage_key": file.storage_key
        },
        request=request
    )

    return file_to_response(file)


@router.get("/tenant/logo", response_model=Optional[FileResponse])
async def get_tenant_logo(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get current tenant logo."""
    service = FileStorageService(db)
    file = service.get_tenant_logo(tenant.id)

    if not file:
        return None

    return file_to_response(file)


@router.delete("/tenant/logo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant_logo(
    request: Request,
    current_user: User = Depends(require_permission(Permission.SETTINGS_UPDATE)),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Delete current tenant logo."""
    service = FileStorageService(db)
    file = service.get_tenant_logo(tenant.id)

    if file:
        file_info = {
            "file_id": str(file.id),
            "filename": file.filename,
            "storage_key": file.storage_key
        }

        await service.delete_file(file.id, tenant.id, current_user.id)

        # Clear tenant logo_url
        tenant.logo_url = None
        db.commit()

        # Audit log
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=tenant.id,
            action=AuditAction.TENANT_LOGO_DELETED,
            resource="tenant",
            resource_id=tenant.id,
            details=file_info,
            request=request
        )


# ============================================================================
# USER AVATAR ENDPOINTS
# ============================================================================

@router.post("/users/{user_id}/avatar/presign", response_model=PresignedUploadResponse)
async def get_user_avatar_upload_url(
    user_id: UUID,
    request: UserAvatarUpload,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get pre-signed URL for user avatar upload."""
    # Check permission: can only upload own avatar or admin can upload for others
    if current_user.id != user_id and current_user.role not in ["admin", "super_admin"]:
        raise PermissionDeniedException("Cannot upload avatar for other users")

    service = FileStorageService(db)

    upload_request = FileUploadRequest(
        filename=request.filename,
        content_type=request.content_type,
        size_bytes=request.size_bytes,
        category=FileCategory.USER_AVATAR,
        resource_type="user",
        resource_id=user_id,
        is_public=True
    )

    try:
        result = await service.generate_presigned_upload_url(
            tenant_id=tenant.id,
            request=upload_request,
            user_id=current_user.id
        )
        return result
    except ValueError as e:
        raise FileValidationException(str(e))
    except (ClientError, EndpointConnectionError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service unavailable. Please ensure MinIO/S3 is running."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )


@router.post("/users/{user_id}/avatar", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def set_user_avatar(
    request: Request,
    user_id: UUID,
    storage_key: str = Query(..., description="Storage key from presigned upload"),
    confirm: FileUploadConfirm = None,
    original_request: UserAvatarUpload = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Confirm user avatar upload and set as current avatar."""
    # Check permission
    if current_user.id != user_id and current_user.role not in ["admin", "super_admin"]:
        raise PermissionDeniedException("Cannot set avatar for other users")

    if not original_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original upload request required"
        )

    service = FileStorageService(db)

    upload_request = FileUploadRequest(
        filename=original_request.filename,
        content_type=original_request.content_type,
        size_bytes=original_request.size_bytes,
        category=FileCategory.USER_AVATAR,
        resource_type="user",
        resource_id=user_id,
        is_public=True
    )

    if not confirm:
        confirm = FileUploadConfirm(storage_key=storage_key)

    # Create file record
    file = service.create_file_record(
        tenant_id=tenant.id,
        user_id=current_user.id,
        request=upload_request,
        storage_key=storage_key,
        confirm=confirm
    )

    # Set as user avatar
    file = await service.set_user_avatar(tenant.id, current_user.id, user_id, file)

    # Audit log
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action=AuditAction.USER_AVATAR_UPLOADED,
        resource="user",
        resource_id=user_id,
        details={
            "file_id": str(file.id),
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": file.size_bytes,
            "storage_key": file.storage_key,
            "target_user_id": str(user_id)
        },
        request=request
    )

    return file_to_response(file)


@router.get("/users/{user_id}/avatar", response_model=Optional[FileResponse])
async def get_user_avatar(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get user's current avatar."""
    service = FileStorageService(db)
    file = service.get_user_avatar(tenant.id, user_id)

    if not file:
        return None

    return file_to_response(file)


@router.delete("/users/{user_id}/avatar", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_avatar(
    request: Request,
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Delete user's avatar."""
    # Check permission
    if current_user.id != user_id and current_user.role not in ["admin", "super_admin"]:
        raise PermissionDeniedException("Cannot delete avatar for other users")

    service = FileStorageService(db)
    file = service.get_user_avatar(tenant.id, user_id)

    if file:
        file_info = {
            "file_id": str(file.id),
            "filename": file.filename,
            "storage_key": file.storage_key,
            "target_user_id": str(user_id)
        }

        await service.delete_file(file.id, tenant.id, current_user.id)

        # Clear user avatar_url
        from app.models.user import User as UserModel
        user = db.query(UserModel).filter(
            UserModel.id == user_id,
            UserModel.tenant_id == tenant.id
        ).first()
        if user:
            user.avatar_url = None
            db.commit()

        # Audit log
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=tenant.id,
            action=AuditAction.USER_AVATAR_DELETED,
            resource="user",
            resource_id=user_id,
            details=file_info,
            request=request
        )


# ============================================================================
# ADMIN FILE ENDPOINTS (Super Admin Only)
# ============================================================================

@router.get("/admin/{file_id}/download", response_model=FileDownloadResponse)
async def admin_get_download_url(
    file_id: UUID,
    inline: bool = Query(False, description="If true, return URL for viewing in browser instead of download"),
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get pre-signed download URL for any file (super admin only).

    Used by super admins to view payment proofs and other tenant files
    during review processes.
    """
    service = FileStorageService(db)

    # Get file without tenant filtering for super admin
    file = db.query(File).filter(
        File.id == file_id,
        File.is_active == True
    ).first()

    if not file:
        raise NotFoundException("File not found")

    download_url, expires_at = await service.generate_presigned_download_url(
        file.storage_key,
        file.filename,
        inline=inline
    )

    return FileDownloadResponse(
        download_url=download_url,
        filename=file.filename,
        content_type=file.content_type,
        size_bytes=file.size_bytes,
        expires_at=expires_at
    )
