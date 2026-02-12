import { apiClient } from './client';
import {
  FileUploadRequest,
  FileUploadConfirm,
  PresignedUploadResponse,
  FileResponse,
  FileDownloadResponse,
  FileListResponse,
  FileListParams,
  StorageUsageResponse,
  TenantLogoUpload,
  UserAvatarUpload,
} from '@/types/file';

export const filesAPI = {
  // ============================================================================
  // PRE-SIGNED URL OPERATIONS
  // ============================================================================

  /**
   * Get a pre-signed URL for direct file upload to S3
   */
  getPresignedUploadUrl: async (
    request: FileUploadRequest
  ): Promise<PresignedUploadResponse> => {
    return apiClient.post<PresignedUploadResponse>('/files/upload/presign', request);
  },

  /**
   * Confirm file upload and create database record
   */
  confirmUpload: async (
    storageKey: string,
    originalRequest: FileUploadRequest,
    confirm?: FileUploadConfirm
  ): Promise<FileResponse> => {
    const params = new URLSearchParams({ storage_key: storageKey });
    return apiClient.post<FileResponse>(
      `/files/upload/confirm?${params.toString()}`,
      {
        original_request: originalRequest,
        confirm: confirm || { storage_key: storageKey },
      }
    );
  },

  /**
   * Upload a file to S3 using pre-signed URL
   * Returns the storage key for confirmation
   */
  uploadToS3: async (
    presignedUrl: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  },

  // ============================================================================
  // FILE CRUD OPERATIONS
  // ============================================================================

  /**
   * List files with optional filters
   */
  listFiles: async (params?: FileListParams): Promise<FileListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.resource_type) searchParams.set('resource_type', params.resource_type);
    if (params?.resource_id) searchParams.set('resource_id', params.resource_id);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));

    const queryString = searchParams.toString();
    const url = queryString ? `/files?${queryString}` : '/files';
    return apiClient.get<FileListResponse>(url);
  },

  /**
   * Get file metadata by ID
   */
  getFile: async (fileId: string): Promise<FileResponse> => {
    return apiClient.get<FileResponse>(`/files/${fileId}`);
  },

  /**
   * Get pre-signed download URL for a file
   * @param fileId - File ID
   * @param inline - If true, URL will show file inline (view in browser) instead of download
   */
  getDownloadUrl: async (fileId: string, inline?: boolean): Promise<FileDownloadResponse> => {
    const params = new URLSearchParams();
    if (inline) params.set('inline', 'true');
    const queryString = params.toString();
    const url = queryString ? `/files/${fileId}/download?${queryString}` : `/files/${fileId}/download`;
    return apiClient.get<FileDownloadResponse>(url);
  },

  /**
   * Update file metadata
   */
  updateFile: async (
    fileId: string,
    data: { filename?: string; metadata?: Record<string, unknown>; is_public?: boolean }
  ): Promise<FileResponse> => {
    return apiClient.patch<FileResponse>(`/files/${fileId}`, data);
  },

  /**
   * Delete a file
   */
  deleteFile: async (fileId: string, hardDelete = false): Promise<void> => {
    const params = new URLSearchParams();
    if (hardDelete) params.set('hard_delete', 'true');
    const queryString = params.toString();
    const url = queryString ? `/files/${fileId}?${queryString}` : `/files/${fileId}`;
    return apiClient.delete<void>(url);
  },

  /**
   * Get storage usage for the current tenant
   */
  getStorageUsage: async (): Promise<StorageUsageResponse> => {
    return apiClient.get<StorageUsageResponse>('/files/storage');
  },

  // ============================================================================
  // TENANT LOGO OPERATIONS
  // ============================================================================

  /**
   * Get pre-signed URL for tenant logo upload
   */
  getTenantLogoUploadUrl: async (
    request: TenantLogoUpload
  ): Promise<PresignedUploadResponse> => {
    return apiClient.post<PresignedUploadResponse>('/files/tenant/logo/presign', request);
  },

  /**
   * Confirm tenant logo upload
   */
  setTenantLogo: async (
    storageKey: string,
    originalRequest: TenantLogoUpload,
    confirm?: FileUploadConfirm
  ): Promise<FileResponse> => {
    const params = new URLSearchParams({ storage_key: storageKey });
    return apiClient.post<FileResponse>(
      `/files/tenant/logo?${params.toString()}`,
      {
        original_request: originalRequest,
        confirm: confirm || { storage_key: storageKey },
      }
    );
  },

  /**
   * Get current tenant logo
   */
  getTenantLogo: async (): Promise<FileResponse | null> => {
    return apiClient.get<FileResponse | null>('/files/tenant/logo');
  },

  /**
   * Delete current tenant logo
   */
  deleteTenantLogo: async (): Promise<void> => {
    return apiClient.delete<void>('/files/tenant/logo');
  },

  // ============================================================================
  // USER AVATAR OPERATIONS
  // ============================================================================

  /**
   * Get pre-signed URL for user avatar upload
   */
  getUserAvatarUploadUrl: async (
    userId: string,
    request: UserAvatarUpload
  ): Promise<PresignedUploadResponse> => {
    return apiClient.post<PresignedUploadResponse>(
      `/files/users/${userId}/avatar/presign`,
      request
    );
  },

  /**
   * Confirm user avatar upload
   */
  setUserAvatar: async (
    userId: string,
    storageKey: string,
    originalRequest: UserAvatarUpload,
    confirm?: FileUploadConfirm
  ): Promise<FileResponse> => {
    const params = new URLSearchParams({ storage_key: storageKey });
    return apiClient.post<FileResponse>(
      `/files/users/${userId}/avatar?${params.toString()}`,
      {
        original_request: originalRequest,
        confirm: confirm || { storage_key: storageKey },
      }
    );
  },

  /**
   * Get user's current avatar
   */
  getUserAvatar: async (userId: string): Promise<FileResponse | null> => {
    return apiClient.get<FileResponse | null>(`/files/users/${userId}/avatar`);
  },

  /**
   * Delete user's avatar
   */
  deleteUserAvatar: async (userId: string): Promise<void> => {
    return apiClient.delete<void>(`/files/users/${userId}/avatar`);
  },

  // ============================================================================
  // ADMIN FILE OPERATIONS (Super Admin Only)
  // ============================================================================

  /**
   * Get pre-signed download URL for any file (super admin only)
   * @param fileId - File ID
   * @param inline - If true, URL will show file inline (view in browser) instead of download
   */
  adminGetDownloadUrl: async (fileId: string, inline?: boolean): Promise<FileDownloadResponse> => {
    const params = new URLSearchParams();
    if (inline) params.set('inline', 'true');
    const queryString = params.toString();
    const url = queryString ? `/files/admin/${fileId}/download?${queryString}` : `/files/admin/${fileId}/download`;
    return apiClient.get<FileDownloadResponse>(url);
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Complete file upload flow: get presigned URL, upload to S3, confirm
 */
export async function uploadFile(
  file: File,
  category: FileUploadRequest['category'],
  options?: {
    resourceType?: string;
    resourceId?: string;
    isPublic?: boolean;
    onProgress?: (percent: number) => void;
  }
): Promise<FileResponse> {
  const request: FileUploadRequest = {
    filename: file.name,
    content_type: file.type,
    size_bytes: file.size,
    category,
    resource_type: options?.resourceType,
    resource_id: options?.resourceId,
    is_public: options?.isPublic,
  };

  // Step 1: Get pre-signed URL
  const presigned = await filesAPI.getPresignedUploadUrl(request);

  // Step 2: Upload to S3
  await filesAPI.uploadToS3(presigned.upload_url, file, options?.onProgress);

  // Step 3: Confirm upload
  const fileRecord = await filesAPI.confirmUpload(presigned.storage_key, request);

  return fileRecord;
}

/**
 * Upload tenant logo with complete flow
 */
export async function uploadTenantLogo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<FileResponse> {
  const request: TenantLogoUpload = {
    filename: file.name,
    content_type: file.type,
    size_bytes: file.size,
  };

  // Step 1: Get pre-signed URL
  const presigned = await filesAPI.getTenantLogoUploadUrl(request);

  // Step 2: Upload to S3
  await filesAPI.uploadToS3(presigned.upload_url, file, onProgress);

  // Step 3: Confirm upload
  const fileRecord = await filesAPI.setTenantLogo(presigned.storage_key, request);

  return fileRecord;
}

/**
 * Upload user avatar with complete flow
 */
export async function uploadUserAvatar(
  userId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<FileResponse> {
  const request: UserAvatarUpload = {
    filename: file.name,
    content_type: file.type,
    size_bytes: file.size,
  };

  // Step 1: Get pre-signed URL
  const presigned = await filesAPI.getUserAvatarUploadUrl(userId, request);

  // Step 2: Upload to S3
  await filesAPI.uploadToS3(presigned.upload_url, file, onProgress);

  // Step 3: Confirm upload
  const fileRecord = await filesAPI.setUserAvatar(userId, presigned.storage_key, request);

  return fileRecord;
}

/**
 * Download a file by triggering browser download
 */
export async function downloadFile(fileId: string): Promise<void> {
  const { download_url, filename } = await filesAPI.getDownloadUrl(fileId);

  // Create a temporary link and trigger download
  const link = document.createElement('a');
  link.href = download_url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file icon based on content type
 */
export function getFileIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'spreadsheet';
  if (contentType.includes('document') || contentType.includes('word')) return 'document';
  if (contentType.includes('zip') || contentType.includes('compressed')) return 'archive';
  return 'file';
}
