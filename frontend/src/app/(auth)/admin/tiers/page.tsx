'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionTiersAPI } from '@/lib/api/subscription-tiers';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Star, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type {
  SubscriptionTier,
  SubscriptionTierCreate,
  SubscriptionTierUpdate,
} from '@/types/payment';
import { formatCurrency, formatLimit } from '@/types/payment';

export default function TiersPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<SubscriptionTierCreate>>({
    code: '',
    display_name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'IDR',
    max_users: 5,
    max_branches: 1,
    max_storage_gb: 1,
    features: [],
    sort_order: 0,
    is_public: true,
    is_recommended: false,
    trial_days: 0,
  });
  const [featuresText, setFeaturesText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tiers', includeInactive],
    queryFn: () => subscriptionTiersAPI.admin.list(includeInactive),
  });

  const createMutation = useMutation({
    mutationFn: (data: SubscriptionTierCreate) => subscriptionTiersAPI.admin.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] });
      toast.success('Tier created successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create tier');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubscriptionTierUpdate }) =>
      subscriptionTiersAPI.admin.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] });
      toast.success('Tier updated successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tier');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionTiersAPI.admin.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] });
      toast.success('Tier deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedTier(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tier');
    },
  });

  const resetForm = () => {
    setFormData({
      code: '',
      display_name: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      currency: 'IDR',
      max_users: 5,
      max_branches: 1,
      max_storage_gb: 1,
      features: [],
      sort_order: 0,
      is_public: true,
      is_recommended: false,
      trial_days: 0,
    });
    setFeaturesText('');
    setSelectedTier(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setFormData({
      display_name: tier.display_name,
      description: tier.description || '',
      price_monthly: tier.price_monthly,
      price_yearly: tier.price_yearly,
      currency: tier.currency,
      max_users: tier.max_users,
      max_branches: tier.max_branches,
      max_storage_gb: tier.max_storage_gb,
      features: tier.features,
      sort_order: tier.sort_order,
      is_public: tier.is_public,
      is_recommended: tier.is_recommended,
      trial_days: tier.trial_days,
    });
    setFeaturesText(tier.features.join('\n'));
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const features = featuresText.split('\n').map(f => f.trim()).filter(Boolean);
    const submitData = { ...formData, features };

    if (selectedTier) {
      updateMutation.mutate({ id: selectedTier.id, data: submitData as SubscriptionTierUpdate });
    } else {
      createMutation.mutate(submitData as SubscriptionTierCreate);
    }
  };

  const tiers = data?.items || [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Subscription Tiers
          </h1>
          <p className="text-muted-foreground">
            Manage pricing tiers and limits
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label htmlFor="include-inactive" className="text-sm">
              Show inactive
            </Label>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tier
          </Button>
        </div>
      </div>

      {/* Tiers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Yearly</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Branches</TableHead>
                <TableHead className="text-center">Storage</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : tiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Layers className="h-8 w-8" />
                      <p>No subscription tiers found</p>
                      <Button variant="outline" size="sm" onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Tier
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tiers.map((tier) => (
                  <TableRow key={tier.id} className={!tier.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono">{tier.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tier.display_name}
                        {tier.is_recommended && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(tier.price_monthly, tier.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(tier.price_yearly, tier.currency)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatLimit(tier.max_users, 'user')}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatLimit(tier.max_branches, 'branch')}
                    </TableCell>
                    <TableCell className="text-center">
                      {tier.max_storage_gb === -1 ? 'Unlimited' : `${tier.max_storage_gb} GB`}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {tier.is_active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                            Inactive
                          </Badge>
                        )}
                        {tier.is_public && (
                          <Badge variant="outline" className="text-xs">
                            Public
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(tier)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(tier)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTier ? 'Edit Tier' : 'Create Tier'}
            </DialogTitle>
            <DialogDescription>
              {selectedTier
                ? 'Update subscription tier details'
                : 'Add a new subscription tier'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toLowerCase() })
                  }
                  placeholder="e.g., basic"
                  disabled={!!selectedTier}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="e.g., Basic Plan"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Tier description for pricing page"
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_monthly">Monthly Price (IDR)</Label>
                <Input
                  id="price_monthly"
                  type="number"
                  value={formData.price_monthly || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, price_monthly: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_yearly">Yearly Price (IDR)</Label>
                <Input
                  id="price_yearly"
                  type="number"
                  value={formData.price_yearly || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, price_yearly: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trial_days">Trial Days</Label>
                <Input
                  id="trial_days"
                  type="number"
                  value={formData.trial_days || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, trial_days: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                />
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_users">Max Users (-1 = unlimited)</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={formData.max_users ?? 5}
                  onChange={(e) =>
                    setFormData({ ...formData, max_users: parseInt(e.target.value) })
                  }
                  min={-1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_branches">Max Branches (-1 = unlimited)</Label>
                <Input
                  id="max_branches"
                  type="number"
                  value={formData.max_branches ?? 1}
                  onChange={(e) =>
                    setFormData({ ...formData, max_branches: parseInt(e.target.value) })
                  }
                  min={-1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_storage_gb">Max Storage GB (-1 = unlimited)</Label>
                <Input
                  id="max_storage_gb"
                  type="number"
                  value={formData.max_storage_gb ?? 1}
                  onChange={(e) =>
                    setFormData({ ...formData, max_storage_gb: parseInt(e.target.value) })
                  }
                  min={-1}
                />
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <Label htmlFor="features">Features (one per line)</Label>
              <Textarea
                id="features"
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder="Basic Dashboard&#10;User Management&#10;Email Support"
                rows={4}
              />
            </div>

            {/* Display Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="is_public"
                  checked={formData.is_public ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_public: checked })
                  }
                />
                <Label htmlFor="is_public">Public</Label>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="is_recommended"
                  checked={formData.is_recommended ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_recommended: checked })
                  }
                />
                <Label htmlFor="is_recommended">Recommended</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : selectedTier ? 'Update Tier' : 'Create Tier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tier &quot;{selectedTier?.display_name}&quot;?
              This action cannot be undone.
              <br /><br />
              <strong>Note:</strong> Tiers with active tenants cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedTier && deleteMutation.mutate(selectedTier.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
