'use client';

import { useState } from 'react';
import { userAPI } from '@/lib/api/users';
import { UserWithBranch } from '@/types/user';
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
import { Badge } from '@/components/ui/badge';

interface DeleteUserDialogProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  user: UserWithBranch | null;
}

export function DeleteUserDialog({ open, onClose, user }: DeleteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!user) return;

    setError(null);
    setLoading(true);

    try {
      await userAPI.delete(user.id);
      onClose(true); // Success
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to delete user';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="text-red-600" size={24} />
            <span>Delete User</span>
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently deactivate the user account.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Name:</span>
              <span className="text-sm font-medium">
                {user.full_name || user.email.split('@')[0]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Email:</span>
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Role:</span>
              <Badge className="bg-purple-100 text-purple-800">
                {user.role.replace('_', ' ')}
              </Badge>
            </div>
            {user.branch_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Branch:</span>
                <span className="text-sm font-medium">{user.branch_name}</span>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Deleting this user will:
            </p>
            <ul className="list-disc list-inside text-sm text-yellow-700 mt-2 space-y-1">
              <li>Deactivate their account immediately</li>
              <li>Revoke all access permissions</li>
              <li>Prevent them from logging in</li>
            </ul>
          </div>
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
              'Delete User'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
