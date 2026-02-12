'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { Building2, Camera, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useTenantLogo } from '@/hooks/use-file-upload';

interface TenantLogoUploadProps {
  currentLogoUrl?: string | null;
  tenantName?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function TenantLogoUpload({
  currentLogoUrl,
  tenantName,
  className,
  disabled = false,
  onSuccess,
  onError,
}: TenantLogoUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const {
    logo,
    isUploading,
    uploadProgress,
    uploadLogoAsync,
    deleteLogoAsync,
    isDeleting,
  } = useTenantLogo();

  // Compute display URL from logo file or fallback to currentLogoUrl
  const displayUrl = logo?.is_active
    ? `${process.env.NEXT_PUBLIC_S3_URL || 'http://localhost:9000/harmony-uploads'}/${logo.storage_key}`
    : currentLogoUrl;

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate
      if (!file.type.startsWith('image/')) {
        onError?.(new Error('Please select an image file'));
        return;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > 5) {
        onError?.(new Error('Image must be smaller than 5MB'));
        return;
      }

      try {
        await uploadLogoAsync(file);
        onSuccess?.();
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error('Upload failed'));
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [uploadLogoAsync, onSuccess, onError]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled, isUploading]);

  const handleRemove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteLogoAsync();
        onSuccess?.();
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error('Failed to remove logo'));
      }
    },
    [deleteLogoAsync, onSuccess, onError]
  );

  const isLoading = isUploading || isDeleting;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-4">
        {/* Logo Preview with X button */}
        <div className="relative group">
          <div
            onClick={handleClick}
            className={cn(
              'relative h-20 w-20 rounded-lg border-2 border-dashed overflow-hidden cursor-pointer transition-colors',
              'border-muted-foreground/25 hover:border-primary hover:bg-primary/5',
              (disabled || isLoading) && 'cursor-not-allowed opacity-50'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled || isLoading}
            />

            {displayUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayUrl}
                  alt={tenantName || 'Organization logo'}
                  className="h-full w-full object-contain"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <Building2 className="h-8 w-8" />
              </div>
            )}

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          {/* X button to remove */}
          {displayUrl && !isLoading && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive hover:bg-destructive/90 text-white rounded-full flex items-center justify-center shadow-sm transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            Click to {displayUrl ? 'change' : 'add'} logo
          </p>
          {/* Progress bar */}
          {isUploading && (
            <div className="mt-2 space-y-1">
              <Progress value={uploadProgress} className="h-1" />
              <p className="text-xs text-muted-foreground">{uploadProgress}% uploaded</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
