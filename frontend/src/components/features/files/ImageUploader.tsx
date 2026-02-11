'use client';

import * as React from 'react';
import { useCallback, useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  isUploading?: boolean;
  uploadProgress?: number;
  maxSizeMB?: number;
  accept?: string;
  aspectRatio?: 'square' | '16/9' | '4/3' | 'auto';
  className?: string;
  disabled?: boolean;
  placeholder?: React.ReactNode;
}

export function ImageUploader({
  currentImageUrl,
  onUpload,
  onRemove,
  isUploading = false,
  uploadProgress = 0,
  maxSizeMB = 5,
  accept = 'image/*',
  aspectRatio = 'square',
  className,
  disabled = false,
  placeholder,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl || currentImageUrl;

  const aspectClasses = {
    square: 'aspect-square',
    '16/9': 'aspect-video',
    '4/3': 'aspect-[4/3]',
    auto: '',
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!file.type.startsWith('image/')) {
        return 'Please select an image file';
      }
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        return `Image must be smaller than ${maxSizeMB}MB`;
      }
      return null;
    },
    [maxSizeMB]
  );

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      try {
        await onUpload(file);
      } catch (err) {
        setPreviewUrl(null);
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [validateFile, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, isUploading, handleFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled, isUploading]);

  const handleRemove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRemove) {
        try {
          await onRemove();
          setPreviewUrl(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to remove');
        }
      }
    },
    [onRemove]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative overflow-hidden rounded-lg border-2 border-dashed transition-colors cursor-pointer',
          aspectClasses[aspectRatio],
          isDragging && 'border-primary bg-primary/5',
          !isDragging && 'border-muted-foreground/25 hover:border-muted-foreground/50',
          (disabled || isUploading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {displayUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt="Preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleClick}>
                <Upload className="h-4 w-4 mr-2" />
                Replace
              </Button>
              {onRemove && (
                <Button variant="destructive" size="sm" onClick={handleRemove}>
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {placeholder || (
              <>
                <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-center">
                  {isDragging ? 'Drop image here' : 'Click or drag to upload'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max {maxSizeMB}MB
                </p>
              </>
            )}
          </div>
        )}

        {/* Upload Progress Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <Progress value={uploadProgress} className="w-2/3 h-2" />
            <span className="text-sm text-muted-foreground mt-2">
              {uploadProgress}%
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
