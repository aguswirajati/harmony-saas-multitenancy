export type FileCategory = 'tenant_logo' | 'user_avatar' | 'document' | 'attachment' | 'payment_proof';

export interface FileUploadRequest {
  filename: string;
  content_type: string;
  size_bytes: number;
  category: FileCategory;
  resource_type?: string;
  resource_id?: string;
  is_public?: boolean;
}

export interface FileUploadConfirm {
  storage_key: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface PresignedUploadResponse {
  upload_url: string;
  storage_key: string;
  expires_at: string;
  max_size_bytes: number;
  fields?: Record<string, string>;
}

export interface FileResponse {
  id: string;
  filename: string;
  storage_key: string;
  content_type: string;
  size_bytes: number;
  category: string;
  resource_type?: string;
  resource_id?: string;
  checksum?: string;
  metadata: Record<string, unknown>;
  is_public: boolean;
  tenant_id: string;
  branch_id?: string;
  uploaded_by_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  size_mb: number;
  is_image: boolean;
}

export interface FileDownloadResponse {
  download_url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  expires_at: string;
}

export interface FileListResponse {
  items: FileResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FileListParams {
  category?: string;
  resource_type?: string;
  resource_id?: string;
  page?: number;
  page_size?: number;
}

export interface StorageUsageResponse {
  tenant_id: string;
  storage_used_bytes: number;
  storage_used_mb: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  storage_available_gb: number;
  usage_percent: number;
  is_limit_reached: boolean;
  file_count: number;
}

export interface TenantLogoUpload {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface UserAvatarUpload {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'confirming' | 'complete' | 'error';
  error?: string;
  result?: FileResponse;
}
