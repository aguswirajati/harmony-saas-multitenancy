'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminCouponsAPI } from '@/lib/api/coupons';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Ticket,
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  Users,
  TrendingUp,
  Percent,
  DollarSign,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
} from 'lucide-react';
import type { Coupon, CouponCreate, CouponUpdate, DiscountType } from '@/types/coupon';

interface AdminCouponsPageProps {
  embedded?: boolean;
}

export default function AdminCouponsPage({ embedded = false }: AdminCouponsPageProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState<CouponCreate>({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    currency: 'IDR',
    max_redemptions: undefined,
    max_redemptions_per_tenant: 1,
    valid_for_tiers: undefined,
    valid_for_billing_periods: undefined,
    valid_from: undefined,
    valid_until: undefined,
    first_time_only: false,
    new_customers_only: false,
    duration_months: undefined,
    minimum_amount: undefined,
  });

  // Fetch coupons
  const { data: couponsData, isLoading } = useQuery({
    queryKey: ['admin-coupons', page, includeExpired],
    queryFn: () => adminCouponsAPI.list({ page, page_size: 10, include_expired: includeExpired }),
  });

  // Fetch overview stats
  const { data: statsData } = useQuery({
    queryKey: ['admin-coupons-stats'],
    queryFn: () => adminCouponsAPI.getOverviewStats(),
  });

  // Fetch specific coupon stats
  const { data: couponStats } = useQuery({
    queryKey: ['admin-coupon-stats', selectedCoupon?.id],
    queryFn: () => selectedCoupon ? adminCouponsAPI.getCouponStats(selectedCoupon.id) : null,
    enabled: !!selectedCoupon && isStatsDialogOpen,
  });

  // Create coupon mutation
  const createMutation = useMutation({
    mutationFn: (data: CouponCreate) => adminCouponsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-coupons-stats'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success('Coupon created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create coupon');
    },
  });

  // Update coupon mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CouponUpdate }) =>
      adminCouponsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setIsEditDialogOpen(false);
      setSelectedCoupon(null);
      toast.success('Coupon updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update coupon');
    },
  });

  // Delete coupon mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCouponsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-coupons-stats'] });
      setIsDeleteDialogOpen(false);
      setSelectedCoupon(null);
      toast.success('Coupon deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete coupon');
    },
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      currency: 'IDR',
      max_redemptions: undefined,
      max_redemptions_per_tenant: 1,
      first_time_only: false,
      new_customers_only: false,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedCoupon) return;
    const updateData: CouponUpdate = {
      name: formData.name,
      description: formData.description,
      max_redemptions: formData.max_redemptions,
      max_redemptions_per_tenant: formData.max_redemptions_per_tenant,
      valid_from: formData.valid_from,
      valid_until: formData.valid_until,
      first_time_only: formData.first_time_only,
      new_customers_only: formData.new_customers_only,
      duration_months: formData.duration_months,
      minimum_amount: formData.minimum_amount,
    };
    updateMutation.mutate({ id: selectedCoupon.id, data: updateData });
  };

  const handleDelete = () => {
    if (!selectedCoupon) return;
    deleteMutation.mutate(selectedCoupon.id);
  };

  const openEditDialog = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      currency: coupon.currency,
      max_redemptions: coupon.max_redemptions || undefined,
      max_redemptions_per_tenant: coupon.max_redemptions_per_tenant,
      valid_from: coupon.valid_from || undefined,
      valid_until: coupon.valid_until || undefined,
      first_time_only: coupon.first_time_only,
      new_customers_only: coupon.new_customers_only,
      duration_months: coupon.duration_months || undefined,
      minimum_amount: coupon.minimum_amount || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const getDiscountTypeIcon = (type: DiscountType) => {
    switch (type) {
      case 'percentage':
        return <Percent className="w-4 h-4" />;
      case 'fixed_amount':
        return <DollarSign className="w-4 h-4" />;
      case 'trial_extension':
        return <Clock className="w-4 h-4" />;
    }
  };

  const getDiscountDisplay = (coupon: Coupon) => {
    switch (coupon.discount_type) {
      case 'percentage':
        return `${coupon.discount_value}%`;
      case 'fixed_amount':
        return `${coupon.currency} ${coupon.discount_value.toLocaleString()}`;
      case 'trial_extension':
        return `${coupon.discount_value} days`;
    }
  };

  const getStatusBadge = (coupon: Coupon) => {
    if (!coupon.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (coupon.is_expired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (coupon.is_maxed_out) {
      return <Badge variant="outline">Maxed Out</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={embedded ? "space-y-4" : "p-6 space-y-6"}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Ticket className="w-6 h-6" />
              Coupon Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Create and manage promotional coupons and discounts
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Coupon
          </Button>
        </div>
      )}

      {/* Create button for embedded mode */}
      {embedded && (
        <div className="flex justify-end">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Coupon
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Coupons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{statsData?.total_coupons || 0}</span>
              <Ticket className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Coupons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600">{statsData?.active_coupons || 0}</span>
              <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Redemptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{statsData?.total_redemptions || 0}</span>
              <Users className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Discounts Given</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(statsData?.total_discount_given || 0)}</span>
              <BarChart3 className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Coupons</CardTitle>
              <CardDescription>Manage your promotional coupons</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="include-expired" className="text-sm">Show Expired</Label>
              <Switch
                id="include-expired"
                checked={includeExpired}
                onCheckedChange={setIncludeExpired}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Redemptions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {couponsData?.items.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-bold">{coupon.code}</TableCell>
                      <TableCell>{coupon.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getDiscountTypeIcon(coupon.discount_type)}
                          <span className="capitalize">{coupon.discount_type.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{getDiscountDisplay(coupon)}</TableCell>
                      <TableCell>
                        {coupon.current_redemptions}
                        {coupon.max_redemptions && ` / ${coupon.max_redemptions}`}
                      </TableCell>
                      <TableCell>{getStatusBadge(coupon)}</TableCell>
                      <TableCell>
                        {coupon.valid_until
                          ? new Date(coupon.valid_until).toLocaleDateString()
                          : 'No expiry'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCoupon(coupon);
                              setIsStatsDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(coupon)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              setSelectedCoupon(coupon);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {couponsData?.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No coupons found. Create your first coupon to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {couponsData && couponsData.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Page {page} of {couponsData.pages} ({couponsData.total} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(couponsData.pages, p + 1))}
                      disabled={page === couponsData.pages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Coupon Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Coupon</DialogTitle>
            <DialogDescription>
              Create a promotional coupon for customers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Coupon Code</Label>
                <Input
                  id="code"
                  placeholder="SAVE20"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="20% Off Summer Sale"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Coupon description for users..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount_type">Discount Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value: DiscountType) =>
                    setFormData({ ...formData, discount_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                    <SelectItem value="trial_extension">Trial Extension (days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value">
                  {formData.discount_type === 'percentage'
                    ? 'Percentage'
                    : formData.discount_type === 'fixed_amount'
                    ? 'Amount'
                    : 'Days'}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  value={formData.discount_value}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_redemptions">Max Redemptions (Optional)</Label>
                <Input
                  id="max_redemptions"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.max_redemptions || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_redemptions: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_per_tenant">Max Per Tenant</Label>
                <Input
                  id="max_per_tenant"
                  type="number"
                  min="1"
                  value={formData.max_redemptions_per_tenant}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_redemptions_per_tenant: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_from">Valid From (Optional)</Label>
                <Input
                  id="valid_from"
                  type="datetime-local"
                  value={formData.valid_from || ''}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until">Valid Until (Optional)</Label>
                <Input
                  id="valid_until"
                  type="datetime-local"
                  value={formData.valid_until || ''}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value || undefined })}
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="first_time_only"
                  checked={formData.first_time_only}
                  onCheckedChange={(checked) => setFormData({ ...formData, first_time_only: checked })}
                />
                <Label htmlFor="first_time_only">First-time subscriptions only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="new_customers_only"
                  checked={formData.new_customers_only}
                  onCheckedChange={(checked) => setFormData({ ...formData, new_customers_only: checked })}
                />
                <Label htmlFor="new_customers_only">New customers only</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Coupon Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Coupon</DialogTitle>
            <DialogDescription>
              Update coupon settings (code and type cannot be changed)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Coupon Code</Label>
                <Input value={formData.code} disabled className="bg-gray-100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Display Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Input value={formData.discount_type} disabled className="bg-gray-100 capitalize" />
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input value={formData.discount_value} disabled className="bg-gray-100" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-max_redemptions">Max Redemptions</Label>
                <Input
                  id="edit-max_redemptions"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.max_redemptions || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_redemptions: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max_per_tenant">Max Per Tenant</Label>
                <Input
                  id="edit-max_per_tenant"
                  type="number"
                  min="1"
                  value={formData.max_redemptions_per_tenant}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_redemptions_per_tenant: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-valid_until">Valid Until</Label>
                <Input
                  id="edit-valid_until"
                  type="datetime-local"
                  value={formData.valid_until || ''}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value || undefined })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Coupon</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the coupon &quot;{selectedCoupon?.code}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coupon Stats Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Coupon Statistics</DialogTitle>
            <DialogDescription>
              Performance metrics for {selectedCoupon?.code}
            </DialogDescription>
          </DialogHeader>
          {couponStats ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500">Total Redemptions</p>
                  <p className="text-2xl font-bold">{couponStats.total_redemptions}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500">Unique Tenants</p>
                  <p className="text-2xl font-bold">{couponStats.unique_tenants}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500">Total Discount Given</p>
                  <p className="text-2xl font-bold">{formatCurrency(couponStats.total_discount_given)}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500">Active / Expired</p>
                  <p className="text-2xl font-bold">
                    {couponStats.active_redemptions} / {couponStats.expired_redemptions}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
