import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  filesAPI,
  uploadFile,
  uploadTenantLogo,
  uploadUserAvatar,
  formatFileSize,
} from '@/lib/api/files';
import {
  FileResponse,
  FileListParams,
  FileUploadProgress,
  FileCategory,
} from '@/types/file';

// ============================================================================
// FILE LIST HOOK
// ============================================================================

/**
 * Hook for listing and managing files
 */
export function useFiles(params?: FileListParams) {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['files', params],
    queryFn: () => filesAPI.listFiles(params),
    staleTime: 30 * 1000, // 30 seconds
  });

  const deleteMutation = useMutation({
    mutationFn: ({ fileId, hardDelete }: { fileId: string; hardDelete?: boolean }) =>
      filesAPI.deleteFile(fileId, hardDelete),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-usage'] });
    },
  });

  return {
    files: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.page_size ?? 20,
    totalPages: data?.total_pages ?? 0,
    isLoading,
    error,
    refetch,
    deleteFile: deleteMutation.mutate,
    deleteFileAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

// ============================================================================
// STORAGE USAGE HOOK
// ============================================================================

/**
 * Hook for getting storage usage
 */
export function useStorageUsage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['storage-usage'],
    queryFn: filesAPI.getStorageUsage,
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    usage: data,
    isLoading,
    error,
    refetch,
    // Derived values
    usedFormatted: data ? formatFileSize(data.storage_used_bytes) : '0 B',
    limitFormatted: data ? `${data.storage_limit_gb} GB` : '0 GB',
    availableFormatted: data ? `${data.storage_available_gb.toFixed(2)} GB` : '0 GB',
  };
}

// ============================================================================
// FILE UPLOAD HOOK
// ============================================================================

interface UseFileUploadOptions {
  category: FileCategory;
  resourceType?: string;
  resourceId?: string;
  isPublic?: boolean;
  maxFiles?: number;
  onSuccess?: (files: FileResponse[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for uploading files with progress tracking
 */
export function useFileUpload(options: UseFileUploadOptions) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<FileUploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const updateUpload = useCallback((index: number, updates: Partial<FileUploadProgress>) => {
    setUploads((prev) =>
      prev.map((upload, i) => (i === index ? { ...upload, ...updates } : upload))
    );
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const filesToUpload = options.maxFiles
        ? files.slice(0, options.maxFiles)
        : files;

      // Initialize progress tracking
      const initialUploads: FileUploadProgress[] = filesToUpload.map((file) => ({
        file,
        progress: 0,
        status: 'pending',
      }));
      setUploads(initialUploads);
      setIsUploading(true);

      const results: FileResponse[] = [];
      const errors: Error[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        updateUpload(i, { status: 'uploading' });

        try {
          const result = await uploadFile(file, options.category, {
            resourceType: options.resourceType,
            resourceId: options.resourceId,
            isPublic: options.isPublic,
            onProgress: (progress) => updateUpload(i, { progress }),
          });

          updateUpload(i, { status: 'complete', progress: 100, result });
          results.push(result);
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Upload failed');
          updateUpload(i, { status: 'error', error: err.message });
          errors.push(err);
        }
      }

      setIsUploading(false);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-usage'] });

      // Call callbacks
      if (results.length > 0 && options.onSuccess) {
        options.onSuccess(results);
      }
      if (errors.length > 0 && options.onError) {
        options.onError(errors[0]);
      }

      return { results, errors };
    },
    [options, queryClient, updateUpload]
  );

  const clearUploads = useCallback(() => {
    setUploads([]);
  }, []);

  const removeUpload = useCallback((index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    uploads,
    isUploading,
    uploadFiles,
    clearUploads,
    removeUpload,
    // Computed
    successCount: uploads.filter((u) => u.status === 'complete').length,
    errorCount: uploads.filter((u) => u.status === 'error').length,
    totalProgress:
      uploads.length > 0
        ? Math.round(uploads.reduce((sum, u) => sum + u.progress, 0) / uploads.length)
        : 0,
  };
}

// ============================================================================
// TENANT LOGO HOOK
// ============================================================================

/**
 * Hook for managing tenant logo
 */
export function useTenantLogo() {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { data: logo, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant-logo'],
    queryFn: filesAPI.getTenantLogo,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const result = await uploadTenantLogo(file, (progress) => {
          setUploadProgress(progress);
        });
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-logo'] });
      queryClient.invalidateQueries({ queryKey: ['storage-usage'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: filesAPI.deleteTenantLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-logo'] });
      queryClient.invalidateQueries({ queryKey: ['storage-usage'] });
    },
  });

  return {
    logo,
    isLoading,
    error,
    refetch,
    // Upload
    uploadLogo: uploadMutation.mutate,
    uploadLogoAsync: uploadMutation.mutateAsync,
    isUploading,
    uploadProgress,
    uploadError: uploadMutation.error,
    // Delete
    deleteLogo: deleteMutation.mutate,
    deleteLogoAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
  };
}

// ============================================================================
// USER AVATAR HOOK
// ============================================================================

/**
 * Hook for managing user avatar
 */
export function useUserAvatar(userId: string) {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { data: avatar, isLoading, error, refetch } = useQuery({
    queryKey: ['user-avatar', userId],
    queryFn: () => filesAPI.getUserAvatar(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const result = await uploadUserAvatar(userId, file, (progress) => {
          setUploadProgress(progress);
        });
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-avatar', userId] });
      queryClient.invalidateQueries({ queryKey: ['storage-usage'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => filesAPI.deleteUserAvatar(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-avatar', userId] });
      queryClient.invalidateQueries({ queryKey: ['storage-usage'] });
    },
  });

  return {
    avatar,
    isLoading,
    error,
    refetch,
    // Upload
    uploadAvatar: uploadMutation.mutate,
    uploadAvatarAsync: uploadMutation.mutateAsync,
    isUploading,
    uploadProgress,
    uploadError: uploadMutation.error,
    // Delete
    deleteAvatar: deleteMutation.mutate,
    deleteAvatarAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
  };
}

// ============================================================================
// FILE DOWNLOAD HOOK
// ============================================================================

/**
 * Hook for downloading files
 */
export function useFileDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const downloadFile = useCallback(async (fileId: string) => {
    setIsDownloading(true);
    setError(null);

    try {
      const { download_url, filename } = await filesAPI.getDownloadUrl(fileId);

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = download_url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Download failed');
      setError(error);
      throw error;
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return {
    downloadFile,
    isDownloading,
    error,
  };
}
