'use client';

import { useState, useEffect } from 'react';
import { branchAPI } from '@/lib/api/branches';
import { Branch, BranchCreate, BranchUpdate } from '@/types/branch';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface BranchDialogProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  branch?: Branch | null;
}

export function BranchDialog({ open, onClose, branch }: BranchDialogProps) {
  const isEdit = !!branch;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<BranchCreate>({
    name: '',
    code: '',
    is_hq: false,
    address: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'Indonesia',
    phone: '',
    email: '',
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
  });

  // Populate form when editing
  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name,
        code: branch.code,
        is_hq: branch.is_hq,
        address: branch.address || '',
        city: branch.city || '',
        province: branch.province || '',
        postal_code: branch.postal_code || '',
        country: branch.country,
        phone: branch.phone || '',
        email: branch.email || '',
        timezone: branch.timezone,
        currency: branch.currency,
      });
    } else {
      // Reset form for create
      setFormData({
        name: '',
        code: '',
        is_hq: false,
        address: '',
        city: '',
        province: '',
        postal_code: '',
        country: 'Indonesia',
        phone: '',
        email: '',
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
      });
    }
    setError(null);
  }, [branch, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isEdit) {
        await branchAPI.update(branch.id, formData as BranchUpdate);
      } else {
        await branchAPI.create(formData);
      }
      onClose(true); // Success
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail ||
        `Failed to ${isEdit ? 'update' : 'create'} branch`;
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
            {isEdit ? 'Edit Branch' : 'Add New Branch'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update branch information'
              : 'Create a new branch location for your organization'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Basic Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Branch Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Main Office"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">
                  Branch Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="HQ"
                  required
                  disabled={loading || (isEdit && branch?.is_hq)}
                  maxLength={10}
                />
                <p className="text-xs text-gray-500">
                  Unique code for this branch (e.g., HQ, BR1, SBY)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_hq"
                name="is_hq"
                checked={formData.is_hq}
                onChange={handleChange}
                disabled={loading || (isEdit && branch?.is_hq)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_hq" className="font-normal cursor-pointer">
                This is the headquarters branch
              </Label>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Location</h3>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Jl. Sudirman No. 123"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Jakarta"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Input
                  id="province"
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  placeholder="DKI Jakarta"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder="12345"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Indonesia"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Contact Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+62 21 1234567"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="branch@company.com"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  disabled={loading}
                  maxLength={3}
                />
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
                <>{isEdit ? 'Update Branch' : 'Create Branch'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
