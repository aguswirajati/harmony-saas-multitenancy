'use client';

import { useState } from 'react';
import { branchAPI } from '@/lib/api/branches';
import { Branch } from '@/types/branch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DeleteBranchDialogProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  branch: Branch | null;
}

export function DeleteBranchDialog({ open, onClose, branch }: DeleteBranchDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!branch) return;

    setError(null);
    setLoading(true);

    try {
      await branchAPI.delete(branch.id);
      onClose(true); // Success
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to delete branch';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!branch) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="text-red-600" size={24} />
            <span>Delete Branch</span>
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Are you sure you want to delete this branch?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Branch Name:</span>
              <span className="text-sm font-medium">{branch.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Branch Code:</span>
              <span className="text-sm font-medium">{branch.code}</span>
            </div>
            {branch.city && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Location:</span>
                <span className="text-sm font-medium">{branch.city}</span>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onClose()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Branch'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
