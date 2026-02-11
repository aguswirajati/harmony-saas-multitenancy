'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { Building2, Camera, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start gap-6">
        {/* Logo Preview */}
        <div
          onClick={handleClick}
          className={cn(
            'relative h-24 w-24 flex-shrink-0 rounded-lg border-2 border-dashed overflow-hidden cursor-pointer group transition-colors',
            'border-muted-foreground/25 hover:border-muted-foreground/50',
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
              <Building2 className="h-8 w-8 mb-1" />
              <span className="text-xs">Add logo</span>
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* Info and Actions */}
        <div className="flex-1 space-y-2">
          <div>
            <h4 className="text-sm font-medium">Organization Logo</h4>
            <p className="text-xs text-muted-foreground">
              Recommended: Square image, at least 200x200px. Max 5MB.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClick}
              disabled={disabled || isLoading}
            >
              {displayUrl ? 'Change' : 'Upload'}
            </Button>
            {displayUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled || isLoading}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-1" />
              <p className="text-xs text-muted-foreground">{uploadProgress}% uploaded</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
