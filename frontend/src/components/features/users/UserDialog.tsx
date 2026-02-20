'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { userAPI } from '@/lib/api/users';
import { UserWithBranch, UserCreate, UserUpdate, TenantRole } from '@/types/user';
import { Branch } from '@/types/branch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { AvatarUpload } from '@/components/features/files/AvatarUpload';
import { toast } from 'sonner';

interface UserDialogProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  user?: UserWithBranch | null;
  branches: Branch[];
}

export function UserDialog({ open, onClose, user, branches }: UserDialogProps) {
  const isEdit = !!user;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const [formData, setFormData] = useState<UserCreate>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    tenant_role: 'member',
    default_branch_id: '',
  });

  // Track initial values to detect changes
  const [initialData, setInitialData] = useState<UserCreate | null>(null);

  // Check if form has unsaved changes
  const isDirty = useMemo(() => {
    if (!initialData) return false;
    return (
      formData.first_name !== initialData.first_name ||
      formData.last_name !== initialData.last_name ||
      formData.phone !== initialData.phone ||
      formData.tenant_role !== initialData.tenant_role ||
      formData.default_branch_id !== initialData.default_branch_id ||
      (!isEdit && formData.email !== initialData.email) ||
      (!isEdit && formData.password !== initialData.password)
    );
  }, [formData, initialData, isEdit]);

  // Populate form when editing
  useEffect(() => {
    if (open) {
      const data: UserCreate = user
        ? {
            email: user.email,
            password: '',
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            phone: user.phone || '',
            tenant_role: (user.tenant_role as TenantRole) || 'member',
            default_branch_id: user.default_branch_id || '',
          }
        : {
            email: '',
            password: '',
            first_name: '',
            last_name: '',
            phone: '',
            tenant_role: 'member',
            default_branch_id: 'No_Branch',
          };
      setFormData(data);
      setInitialData(data);
      setError(null);
    }
  }, [user, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isEdit) {
        // For edit, send null for empty strings to clear fields
        const updateData: UserUpdate = {
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          phone: formData.phone || null,
          tenant_role: formData.tenant_role,
          default_branch_id: formData.default_branch_id || null,
        };
        await userAPI.update(user.id, updateData);
      } else {
        // For create, password is required
        if (!formData.password || formData.password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        if (!formData.default_branch_id || formData.default_branch_id === "No_Branch") {
          setError('Default branch must be selected');
          setLoading(false);
          return;
        }
        await userAPI.create(formData);
      }
      onClose(true); // Success
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      const errorMessage = axiosError.response?.data?.detail ||
        `Failed to ${isEdit ? 'update' : 'create'} user`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle dialog close with unsaved changes check
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setShowDiscardDialog(true);
    } else if (!newOpen) {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleCancelClick = useCallback(() => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardDialog(false);
    onClose();
  }, [onClose]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update user information and permissions'
                : 'Create a new user account for your organization'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Personal Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Personal Information</h3>

              {/* Avatar Upload - Only shown when editing */}
              {isEdit && user && (
                <div className="flex items-center gap-4">
                  <AvatarUpload
                    userId={user.id}
                    currentAvatarUrl={user.avatar_url}
                    userName={user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : user.email}
                    size="lg"
                    onSuccess={() => toast.success('Avatar updated successfully')}
                    onError={(err) => toast.error(err.message)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Profile Photo</p>
                    <p className="text-xs text-muted-foreground">
                      Click to upload a new avatar. Max 2MB.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">
                    First Name
                  </Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="John"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">
                    Last Name
                  </Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Doe"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+62 812 3456 7890"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Account Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Account Information</h3>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john.doe@company.com"
                  required
                  disabled={loading || isEdit}
                />
                {isEdit && (
                  <p className="text-xs text-gray-500">
                    Email cannot be changed after account creation
                  </p>
                )}
              </div>

              {!isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required={!isEdit}
                    minLength={8}
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500">
                    Minimum 8 characters with uppercase, lowercase, and number. User can change this later.
                  </p>
                </div>
              )}
            </div>

            {/* Role & Branch */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Role & Access</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant_role">
                    Role <span className="text-red-500">*</span>
                  </Label>
                  {isEdit && user?.tenant_role === 'owner' ? (
                    <>
                      <Input
                        value="Owner"
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Owner role cannot be changed. Use &quot;Transfer Ownership&quot; to assign a new owner.
                      </p>
                    </>
                  ) : (
                    <>
                      <Select
                        value={formData.tenant_role}
                        onValueChange={(value) => handleSelectChange('tenant_role', value)}
                        disabled={loading}
                      >
                        <SelectTrigger id="tenant_role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Admin: Full access | Member: Basic access
                      </p>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_branch_id">
                    Default Branch
                  </Label>
                  <Select
                    value={formData.default_branch_id || 'No_Branch'}
                    onValueChange={(value) => handleSelectChange('default_branch_id', value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="default_branch_id">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No_Branch">No Branch</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Primary branch assignment for this user
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelClick}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEdit ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>{isEdit ? 'Update User' : 'Create User'}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardConfirm}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
