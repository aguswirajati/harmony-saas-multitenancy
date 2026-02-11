'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { Camera, Loader2, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserAvatar } from '@/hooks/use-file-upload';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  userName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const sizeClasses = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
  xl: 'h-32 w-32',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  userName,
  size = 'lg',
  className,
  disabled = false,
  onSuccess,
  onError,
}: AvatarUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const {
    avatar,
    isUploading,
    uploadProgress,
    uploadAvatarAsync,
    deleteAvatarAsync,
    isDeleting,
  } = useUserAvatar(userId);

  const displayUrl = avatar?.is_active
    ? `${process.env.NEXT_PUBLIC_S3_URL || 'http://localhost:9000/harmony-uploads'}/${avatar.storage_key}`
    : currentAvatarUrl;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

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
      if (sizeMB > 2) {
        onError?.(new Error('Image must be smaller than 2MB'));
        return;
      }

      try {
        await uploadAvatarAsync(file);
        onSuccess?.();
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error('Upload failed'));
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [uploadAvatarAsync, onSuccess, onError]
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
        await deleteAvatarAsync();
        onSuccess?.();
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error('Failed to remove avatar'));
      }
    },
    [deleteAvatarAsync, onSuccess, onError]
  );

  const isLoading = isUploading || isDeleting;

  return (
    <div className={cn('relative inline-block', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isLoading}
      />

      <div
        onClick={handleClick}
        className={cn(
          'relative cursor-pointer group',
          (disabled || isLoading) && 'cursor-not-allowed opacity-50'
        )}
      >
        <Avatar className={cn(sizeClasses[size], 'border-2 border-muted')}>
          <AvatarImage src={displayUrl || undefined} alt={userName || 'Avatar'} />
          <AvatarFallback className="text-lg">
            {userName ? getInitials(userName) : <User className={iconSizes[size]} />}
          </AvatarFallback>
        </Avatar>

        {/* Upload/Loading Overlay */}
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 className={cn(iconSizes[size], 'animate-spin text-white')} />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className={cn(iconSizes[size], 'text-white')} />
          </div>
        )}

        {/* Progress ring */}
        {isUploading && uploadProgress > 0 && uploadProgress < 100 && (
          <svg
            className="absolute inset-0"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-primary"
              strokeDasharray={`${2 * Math.PI * 45 * uploadProgress / 100} ${2 * Math.PI * 45}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
        )}
      </div>

      {/* Remove button */}
      {displayUrl && !isLoading && !disabled && (
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
          onClick={handleRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
