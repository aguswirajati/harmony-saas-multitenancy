'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatFileSize } from '@/lib/api/files';
import { FileUploadProgress, FileCategory } from '@/types/file';
import { useFileUpload } from '@/hooks/use-file-upload';

interface FileUploaderProps {
  category: FileCategory;
  resourceType?: string;
  resourceId?: string;
  isPublic?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  onSuccess?: (files: import('@/types/file').FileResponse[]) => void;
  onError?: (error: Error) => void;
  className?: string;
  disabled?: boolean;
}

export function FileUploader({
  category,
  resourceType,
  resourceId,
  isPublic,
  maxFiles = 10,
  maxSizeMB = 50,
  accept,
  onSuccess,
  onError,
  className,
  disabled = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { uploads, isUploading, uploadFiles, clearUploads, removeUpload } = useFileUpload({
    category,
    resourceType,
    resourceId,
    isPublic,
    maxFiles,
    onSuccess,
    onError,
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter((file) => {
        const sizeMB = file.size / (1024 * 1024);
        return sizeMB <= maxSizeMB;
      });

      if (validFiles.length > 0) {
        uploadFiles(validFiles);
      }
    },
    [disabled, maxSizeMB, uploadFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const validFiles = files.filter((file) => {
        const sizeMB = file.size / (1024 * 1024);
        return sizeMB <= maxSizeMB;
      });

      if (validFiles.length > 0) {
        uploadFiles(validFiles);
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [maxSizeMB, uploadFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const getStatusIcon = (status: FileUploadProgress['status']) => {
    switch (status) {
      case 'pending':
        return <File className="h-4 w-4 text-muted-foreground" />;
      case 'uploading':
      case 'confirming':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        <Upload className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-sm font-medium">
          {isDragging ? 'Drop files here' : 'Click or drag files to upload'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max {maxSizeMB}MB per file
          {maxFiles > 1 && `, up to ${maxFiles} files`}
        </p>
      </div>

      {/* Upload Progress List */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Uploads ({uploads.filter((u) => u.status === 'complete').length}/{uploads.length})
            </span>
            {!isUploading && (
              <Button variant="ghost" size="sm" onClick={clearUploads}>
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {uploads.map((upload, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                {getStatusIcon(upload.status)}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.file.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(upload.file.size)}
                    </span>
                    {upload.status === 'error' && (
                      <span className="text-xs text-destructive">{upload.error}</span>
                    )}
                  </div>
                  {(upload.status === 'uploading' || upload.status === 'confirming') && (
                    <Progress value={upload.progress} className="h-1 mt-2" />
                  )}
                </div>

                {upload.status !== 'uploading' && upload.status !== 'confirming' && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeUpload(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
