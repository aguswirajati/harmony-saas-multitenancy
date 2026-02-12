"""
File Storage Service for S3-compatible storage.
Handles pre-signed URLs, file validation, CRUD operations, and quota management.
"""
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
import logging

import aioboto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.config import settings
from app.models.file import File, FileCategory
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.file import (
    FileUploadRequest, FileUploadConfirm, FileUpdateRequest,
    PresignedUploadResponse, FileResponse, FileDownloadResponse,
    StorageUsageResponse
)
from app.core.exceptions import (
    NotFoundException, PermissionDeniedException, LimitExceededException
)

logger = logging.getLogger(__name__)


class FileStorageService:
    """Service for S3-compatible file storage operations."""

    # Category-specific settings
    CATEGORY_SETTINGS = {
        FileCategory.TENANT_LOGO: {
            "max_size_mb": 5,
            "allowed_types": ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
            "path_prefix": "tenant-logos",
            "public": True,
        },
        FileCategory.USER_AVATAR: {
            "max_size_mb": 2,
            "allowed_types": ["image/jpeg", "image/png", "image/gif", "image/webp"],
            "path_prefix": "avatars",
            "public": True,
        },
        "document": {
            "max_size_mb": settings.MAX_UPLOAD_SIZE_MB,
            "allowed_types": [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "text/csv",
                "text/plain",
                "application/zip",
            ],
            "path_prefix": "documents",
            "public": False,
        },
        "attachment": {
            "max_size_mb": settings.MAX_UPLOAD_SIZE_MB,
            "allowed_types": None,  # Allow any type
            "path_prefix": "attachments",
            "public": False,
        },
        FileCategory.PAYMENT_PROOF: {
            "max_size_mb": 10,
            "allowed_types": ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
            "path_prefix": "payment-proofs",
            "public": False,
        },
    }

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # S3 CLIENT
    # ========================================================================

    @staticmethod
    def _get_boto_config() -> BotoConfig:
        """Get boto3 configuration."""
        return BotoConfig(
            signature_version='s3v4',
            retries={'max_attempts': 3, 'mode': 'standard'}
        )

    @staticmethod
    async def get_s3_client():
        """Get async S3 client."""
        session = aioboto3.Session()
        return session.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            region_name=settings.S3_REGION,
            config=FileStorageService._get_boto_config()
        )

    @staticmethod
    def _get_public_bucket_policy(bucket_name: str) -> str:
        """Get bucket policy that allows public read for public paths."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "PublicReadForPublicFiles",
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": ["s3:GetObject"],
                    "Resource": [
                        f"arn:aws:s3:::{bucket_name}/tenant-logos/*",
                        f"arn:aws:s3:::{bucket_name}/avatars/*"
                    ]
                }
            ]
        }
        return json.dumps(policy)

    @staticmethod
    async def _ensure_bucket_with_policy(s3, bucket_name: str) -> None:
        """Ensure bucket exists and has public read policy for public paths."""
        bucket_created = False
        try:
            await s3.head_bucket(Bucket=bucket_name)
        except ClientError:
            # Create bucket
            await s3.create_bucket(Bucket=bucket_name)
            bucket_created = True
            logger.info(f"Created S3 bucket: {bucket_name}")

        # Only set policies on newly created buckets to avoid overhead
        if bucket_created:
            # Set public read policy for tenant-logos and avatars
            try:
                policy = FileStorageService._get_public_bucket_policy(bucket_name)
                await s3.put_bucket_policy(Bucket=bucket_name, Policy=policy)
                logger.info(f"Set public bucket policy for: {bucket_name}")
            except ClientError as e:
                logger.warning(f"Could not set bucket policy: {e}")

            # Set CORS for browser access
            try:
                cors_config = {
                    'CORSRules': [
                        {
                            'AllowedHeaders': ['*'],
                            'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                            'AllowedOrigins': ['*'],
                            'ExposeHeaders': ['ETag'],
                            'MaxAgeSeconds': 3600
                        }
                    ]
                }
                await s3.put_bucket_cors(Bucket=bucket_name, CORSConfiguration=cors_config)
                logger.info(f"Set CORS configuration for: {bucket_name}")
            except ClientError as e:
                logger.warning(f"Could not set CORS configuration: {e}")

    # ========================================================================
    # VALIDATION
    # ========================================================================

    def validate_file(
        self,
        filename: str,
        content_type: str,
        size_bytes: int,
        category: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate file against category-specific rules.
        Returns (is_valid, error_message).
        """
        cat_settings = self.CATEGORY_SETTINGS.get(category)
        if not cat_settings:
            return False, f"Unknown category: {category}"

        # Check size
        max_size_bytes = cat_settings["max_size_mb"] * 1024 * 1024
        if size_bytes > max_size_bytes:
            return False, f"File exceeds maximum size of {cat_settings['max_size_mb']}MB"

        # Check content type
        allowed_types = cat_settings.get("allowed_types")
        if allowed_types and content_type not in allowed_types:
            return False, f"Content type '{content_type}' not allowed for category '{category}'"

        # Check file extension
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if category in [FileCategory.TENANT_LOGO, FileCategory.USER_AVATAR]:
            if ext not in settings.ALLOWED_IMAGE_EXTENSIONS:
                return False, f"Extension '.{ext}' not allowed for images"
        elif category == "document":
            if ext not in settings.ALLOWED_DOCUMENT_EXTENSIONS:
                return False, f"Extension '.{ext}' not allowed for documents"

        return True, None

    def check_storage_quota(
        self,
        tenant_id: UUID,
        additional_bytes: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if tenant has enough storage quota.
        Returns (has_quota, error_message).
        """
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return False, "Tenant not found"

        # -1 means unlimited
        if tenant.max_storage_gb == -1:
            return True, None

        max_bytes = tenant.max_storage_gb * 1024 * 1024 * 1024
        new_total = tenant.storage_used_bytes + additional_bytes

        if new_total > max_bytes:
            used_gb = tenant.storage_used_bytes / (1024 * 1024 * 1024)
            limit_gb = tenant.max_storage_gb
            return False, f"Storage quota exceeded. Used: {used_gb:.2f}GB / {limit_gb}GB"

        return True, None

    # ========================================================================
    # PRE-SIGNED URLS
    # ========================================================================

    async def generate_presigned_upload_url(
        self,
        tenant_id: UUID,
        request: FileUploadRequest,
        user_id: UUID
    ) -> PresignedUploadResponse:
        """Generate pre-signed URL for direct S3 upload."""
        # Validate file
        is_valid, error = self.validate_file(
            request.filename,
            request.content_type,
            request.size_bytes,
            request.category
        )
        if not is_valid:
            raise ValueError(error)

        # Check quota
        has_quota, error = self.check_storage_quota(tenant_id, request.size_bytes)
        if not has_quota:
            raise LimitExceededException(error)

        # Generate storage key
        cat_settings = self.CATEGORY_SETTINGS.get(request.category, {})
        path_prefix = cat_settings.get("path_prefix", "files")
        file_ext = request.filename.rsplit('.', 1)[-1].lower() if '.' in request.filename else ''
        unique_id = str(uuid.uuid4())
        storage_key = f"{path_prefix}/{tenant_id}/{unique_id}.{file_ext}"

        # Generate pre-signed URL
        async with await self.get_s3_client() as s3:
            try:
                # Ensure bucket exists with proper policy
                await self._ensure_bucket_with_policy(s3, settings.S3_BUCKET_NAME)

                presigned_url = await s3.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': settings.S3_BUCKET_NAME,
                        'Key': storage_key,
                        'ContentType': request.content_type,
                    },
                    ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRY
                )
            except ClientError as e:
                logger.error(f"Failed to generate presigned URL: {e}")
                raise

        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.S3_PRESIGNED_URL_EXPIRY)

        return PresignedUploadResponse(
            upload_url=presigned_url,
            storage_key=storage_key,
            expires_at=expires_at,
            max_size_bytes=cat_settings.get("max_size_mb", settings.MAX_UPLOAD_SIZE_MB) * 1024 * 1024,
            fields=None
        )

    async def generate_presigned_download_url(
        self,
        storage_key: str,
        filename: str,
        inline: bool = False
    ) -> Tuple[str, datetime]:
        """
        Generate pre-signed URL for file download.

        Args:
            storage_key: S3 object key
            filename: Original filename for Content-Disposition
            inline: If True, use 'inline' disposition (view in browser).
                    If False, use 'attachment' disposition (force download).
        """
        disposition = 'inline' if inline else 'attachment'
        async with await self.get_s3_client() as s3:
            try:
                presigned_url = await s3.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': settings.S3_BUCKET_NAME,
                        'Key': storage_key,
                        'ResponseContentDisposition': f'{disposition}; filename="{filename}"',
                    },
                    ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRY
                )
            except ClientError as e:
                logger.error(f"Failed to generate download URL: {e}")
                raise

        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.S3_PRESIGNED_URL_EXPIRY)
        return presigned_url, expires_at

    # ========================================================================
    # FILE CRUD
    # ========================================================================

    def create_file_record(
        self,
        tenant_id: UUID,
        user_id: UUID,
        request: FileUploadRequest,
        storage_key: str,
        confirm: FileUploadConfirm
    ) -> File:
        """Create file record in database after successful upload."""
        file = File(
            tenant_id=tenant_id,
            filename=request.filename,
            storage_key=storage_key,
            content_type=request.content_type,
            size_bytes=request.size_bytes,
            category=request.category,
            resource_type=request.resource_type,
            resource_id=request.resource_id,
            checksum=confirm.checksum,
            file_metadata=confirm.metadata or {},
            is_public=request.is_public,
            uploaded_by_id=user_id,
            created_by_id=user_id,
        )

        self.db.add(file)

        # Update tenant storage usage
        self._update_storage_usage(tenant_id, request.size_bytes)

        self.db.commit()
        self.db.refresh(file)

        return file

    def get_file(
        self,
        file_id: UUID,
        tenant_id: UUID,
        include_deleted: bool = False
    ) -> Optional[File]:
        """Get file by ID with tenant isolation."""
        query = self.db.query(File).filter(
            File.id == file_id,
            File.tenant_id == tenant_id
        )
        if not include_deleted:
            query = query.filter(File.is_active == True)

        return query.first()

    def get_file_by_storage_key(
        self,
        storage_key: str,
        tenant_id: UUID
    ) -> Optional[File]:
        """Get file by storage key with tenant isolation."""
        return self.db.query(File).filter(
            File.storage_key == storage_key,
            File.tenant_id == tenant_id,
            File.is_active == True
        ).first()

    def list_files(
        self,
        tenant_id: UUID,
        category: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        uploaded_by_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[File], int]:
        """List files with filters and pagination."""
        query = self.db.query(File).filter(
            File.tenant_id == tenant_id,
            File.is_active == True
        )

        if category:
            query = query.filter(File.category == category)
        if resource_type:
            query = query.filter(File.resource_type == resource_type)
        if resource_id:
            query = query.filter(File.resource_id == resource_id)
        if uploaded_by_id:
            query = query.filter(File.uploaded_by_id == uploaded_by_id)

        total = query.count()

        files = query.order_by(File.created_at.desc())\
            .offset((page - 1) * page_size)\
            .limit(page_size)\
            .all()

        return files, total

    def update_file(
        self,
        file_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        update_data: FileUpdateRequest
    ) -> Optional[File]:
        """Update file metadata."""
        file = self.get_file(file_id, tenant_id)
        if not file:
            return None

        if update_data.filename is not None:
            file.filename = update_data.filename
        if update_data.metadata is not None:
            file.file_metadata = {**file.file_metadata, **update_data.metadata}
        if update_data.is_public is not None:
            file.is_public = update_data.is_public

        file.updated_by_id = user_id
        self.db.commit()
        self.db.refresh(file)

        return file

    async def delete_file(
        self,
        file_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        hard_delete: bool = False
    ) -> bool:
        """
        Delete file (soft delete by default).
        Hard delete removes from S3 as well.
        """
        file = self.get_file(file_id, tenant_id, include_deleted=True)
        if not file:
            return False

        if hard_delete:
            # Delete from S3
            async with await self.get_s3_client() as s3:
                try:
                    await s3.delete_object(
                        Bucket=settings.S3_BUCKET_NAME,
                        Key=file.storage_key
                    )
                except ClientError as e:
                    logger.error(f"Failed to delete file from S3: {e}")
                    # Continue with DB deletion even if S3 fails

            # Update storage usage before hard delete
            self._update_storage_usage(tenant_id, -file.size_bytes)

            self.db.delete(file)
        else:
            # Soft delete
            file.is_active = False
            file.deleted_at = datetime.now(timezone.utc)
            file.deleted_by_id = user_id

            # Still update storage usage for soft delete
            self._update_storage_usage(tenant_id, -file.size_bytes)

        self.db.commit()
        return True

    # ========================================================================
    # RESOURCE-SPECIFIC OPERATIONS
    # ========================================================================

    def get_resource_files(
        self,
        tenant_id: UUID,
        resource_type: str,
        resource_id: UUID
    ) -> List[File]:
        """Get all files linked to a specific resource."""
        return self.db.query(File).filter(
            File.tenant_id == tenant_id,
            File.resource_type == resource_type,
            File.resource_id == resource_id,
            File.is_active == True
        ).order_by(File.created_at.desc()).all()

    def get_tenant_logo(self, tenant_id: UUID) -> Optional[File]:
        """Get current tenant logo."""
        return self.db.query(File).filter(
            File.tenant_id == tenant_id,
            File.category == FileCategory.TENANT_LOGO,
            File.resource_type == "tenant",
            File.resource_id == tenant_id,
            File.is_active == True
        ).order_by(File.created_at.desc()).first()

    def get_user_avatar(self, tenant_id: UUID, user_id: UUID) -> Optional[File]:
        """Get current user avatar."""
        return self.db.query(File).filter(
            File.tenant_id == tenant_id,
            File.category == FileCategory.USER_AVATAR,
            File.resource_type == "user",
            File.resource_id == user_id,
            File.is_active == True
        ).order_by(File.created_at.desc()).first()

    async def set_tenant_logo(
        self,
        tenant_id: UUID,
        user_id: UUID,
        file: File
    ) -> File:
        """Set tenant logo, deactivating previous logo if exists."""
        # Deactivate existing logo
        existing = self.get_tenant_logo(tenant_id)
        if existing and existing.id != file.id:
            await self.delete_file(existing.id, tenant_id, user_id)

        # Update file to link to tenant
        file.resource_type = "tenant"
        file.resource_id = tenant_id
        file.category = FileCategory.TENANT_LOGO
        file.is_public = True

        # Update tenant's logo_url
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            # Generate public URL
            if settings.S3_PUBLIC_URL:
                tenant.logo_url = f"{settings.S3_PUBLIC_URL}/{file.storage_key}"
            else:
                tenant.logo_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{file.storage_key}"

        self.db.commit()
        self.db.refresh(file)
        return file

    async def set_user_avatar(
        self,
        tenant_id: UUID,
        user_id: UUID,
        target_user_id: UUID,
        file: File
    ) -> File:
        """Set user avatar, deactivating previous avatar if exists."""
        # Deactivate existing avatar
        existing = self.get_user_avatar(tenant_id, target_user_id)
        if existing and existing.id != file.id:
            await self.delete_file(existing.id, tenant_id, user_id)

        # Update file to link to user
        file.resource_type = "user"
        file.resource_id = target_user_id
        file.category = FileCategory.USER_AVATAR
        file.is_public = True

        # Update user's avatar_url
        user = self.db.query(User).filter(
            User.id == target_user_id,
            User.tenant_id == tenant_id
        ).first()
        if user:
            if settings.S3_PUBLIC_URL:
                user.avatar_url = f"{settings.S3_PUBLIC_URL}/{file.storage_key}"
            else:
                user.avatar_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{file.storage_key}"

        self.db.commit()
        self.db.refresh(file)
        return file

    # ========================================================================
    # STORAGE QUOTA
    # ========================================================================

    def _update_storage_usage(self, tenant_id: UUID, delta_bytes: int) -> None:
        """Update tenant's storage usage by delta (positive or negative)."""
        self.db.query(Tenant).filter(Tenant.id == tenant_id).update(
            {Tenant.storage_used_bytes: Tenant.storage_used_bytes + delta_bytes}
        )

    def get_storage_usage(self, tenant_id: UUID) -> StorageUsageResponse:
        """Get storage usage statistics for a tenant."""
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise NotFoundException("Tenant not found")

        file_count = self.db.query(func.count(File.id)).filter(
            File.tenant_id == tenant_id,
            File.is_active == True
        ).scalar()

        used_bytes = tenant.storage_used_bytes
        used_mb = used_bytes / (1024 * 1024)
        used_gb = used_bytes / (1024 * 1024 * 1024)
        limit_gb = tenant.max_storage_gb

        if limit_gb == -1:  # Unlimited
            available_gb = float('inf')
            usage_percent = 0.0
            is_limit_reached = False
        else:
            available_gb = max(0, limit_gb - used_gb)
            usage_percent = (used_gb / limit_gb * 100) if limit_gb > 0 else 0
            is_limit_reached = used_gb >= limit_gb

        return StorageUsageResponse(
            tenant_id=tenant_id,
            storage_used_bytes=used_bytes,
            storage_used_mb=round(used_mb, 2),
            storage_used_gb=round(used_gb, 3),
            storage_limit_gb=limit_gb,
            storage_available_gb=round(available_gb, 3) if available_gb != float('inf') else -1,
            usage_percent=round(usage_percent, 1),
            is_limit_reached=is_limit_reached,
            file_count=file_count
        )

    def recalculate_storage_usage(self, tenant_id: UUID) -> int:
        """Recalculate and update tenant storage usage from files table."""
        total_bytes = self.db.query(func.sum(File.size_bytes)).filter(
            File.tenant_id == tenant_id,
            File.is_active == True
        ).scalar() or 0

        self.db.query(Tenant).filter(Tenant.id == tenant_id).update(
            {Tenant.storage_used_bytes: total_bytes}
        )
        self.db.commit()

        return total_bytes
