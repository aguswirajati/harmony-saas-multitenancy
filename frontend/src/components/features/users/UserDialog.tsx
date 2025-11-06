'use client';

import { useState, useEffect } from 'react';
import { userAPI } from '@/lib/api/users';
import { UserWithBranch, UserCreate, UserUpdate } from '@/types/user';
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

  const [formData, setFormData] = useState<UserCreate>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'staff',
    default_branch_id: '',
  });

  // Populate form when editing
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        password: '', // Don't populate password for edit
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        role: user.role,
        default_branch_id: user.default_branch_id || '',
      });
    } else {
      // Reset form for create
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: 'staff',
        default_branch_id: 'No_Branch',
      });
    }
    setError(null);
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
        // For edit, don't send password if empty
        const updateData: UserUpdate = {
          first_name: formData.first_name || undefined,
          last_name: formData.last_name || undefined,
          phone: formData.phone || undefined,
          role: formData.role,
          default_branch_id: formData.default_branch_id || undefined,
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
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 
        `Failed to ${isEdit ? 'update' : 'create'} user`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
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
            <h3 className="text-sm font-semibold text-gray-700">Personal Information</h3>
            
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
            <h3 className="text-sm font-semibold text-gray-700">Account Information</h3>
            
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
                  Minimum 8 characters. User can change this later.
                </p>
              </div>
            )}
          </div>

          {/* Role & Branch */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Role & Access</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">
                  Role <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleSelectChange('role', value)}
                  disabled={loading}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Staff: Basic access | Manager: Branch management | Admin: Full access
                </p>
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
              onClick={() => onClose()}
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
  );
}