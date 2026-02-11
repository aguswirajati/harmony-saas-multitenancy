'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Building2,
  Users,
  GitBranch,
  Crown,
  Globe,
  Database,
  CheckCircle,
  XCircle,
  Edit,
  Save,
  Trash2,
  Power,
  Settings,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

// API error type
interface ApiError extends Error {
  message: string;
}

// Subscription update data
interface SubscriptionUpdateData {
  tier: string;
  subscription_status: string;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
}

interface TenantDetail {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  logo_url?: string;
  tier: string;
  subscription_status: string;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  user_count: number;
  branch_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  features: Record<string, boolean>;
  settings?: Record<string, unknown>;
}

interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface TenantBranch {
  id: string;
  name: string;
  code: string;
  is_hq: boolean;
  is_active: boolean;
  created_at: string;
}

const AVAILABLE_FEATURES = [
  { key: 'inventory_module', label: 'Inventory Module', description: 'Stock management and tracking' },
  { key: 'sales_module', label: 'Sales Module', description: 'Sales and invoicing features' },
  { key: 'pos_module', label: 'POS Module', description: 'Point of Sale integration' },
  { key: 'analytics', label: 'Analytics', description: 'Advanced analytics and reporting' },
  { key: 'api_access', label: 'API Access', description: 'External API access' },
  { key: 'multi_branch', label: 'Multi-Branch', description: 'Multiple branch support' },
  { key: 'custom_branding', label: 'Custom Branding', description: 'Custom logo and colors' },
  { key: 'advanced_reports', label: 'Advanced Reports', description: 'Detailed reporting features' },
];

const TIERS = ['free', 'basic', 'premium', 'enterprise'];
const SUBSCRIPTION_STATUSES = ['active', 'trial', 'expired', 'cancelled', 'suspended'];

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: tenantId } = use(params);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');

  // Subscription form states
  const [subTier, setSubTier] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [subMaxUsers, setSubMaxUsers] = useState(0);
  const [subMaxBranches, setSubMaxBranches] = useState(0);
  const [subMaxStorage, setSubMaxStorage] = useState(0);

  // Feature flags state
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  // Fetch tenant details
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useQuery<TenantDetail>({
    queryKey: ['tenant', tenantId],
    queryFn: () => apiClient.get<TenantDetail>(`/admin/tenants/${tenantId}`),
  });

  // Fetch tenant users
  const { data: usersResponse, isLoading: usersLoading } = useQuery<{users: TenantUser[], total: number}>({
    queryKey: ['tenant-users', tenantId],
    queryFn: () => apiClient.get(`/admin/tenants/${tenantId}/users?limit=100`),
    enabled: !!tenant,
  });

  // Fetch tenant branches
  const { data: branchesResponse, isLoading: branchesLoading } = useQuery<{branches: TenantBranch[], total: number}>({
    queryKey: ['tenant-branches', tenantId],
    queryFn: () => apiClient.get(`/admin/tenants/${tenantId}/branches?limit=100`),
    enabled: !!tenant,
  });

  // Update tenant info mutation
  const updateTenantMutation = useMutation({
    mutationFn: (data: { name?: string; domain?: string; logo_url?: string }) =>
      apiClient.put(`/admin/tenants/${tenantId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Tenant information updated successfully');
      setEditDialogOpen(false);
    },
    onError: (error: ApiError) => {
      toast.error(error.message || 'Failed to update tenant');
    },
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: (data: SubscriptionUpdateData) =>
      apiClient.put(`/admin/tenants/${tenantId}/subscription`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Subscription updated successfully');
    },
    onError: (error: ApiError) => {
      toast.error(error.message || 'Failed to update subscription');
    },
  });

  // Update features mutation
  const updateFeaturesMutation = useMutation({
    mutationFn: (data: { features: Record<string, boolean> }) =>
      apiClient.put(`/admin/tenants/${tenantId}/features`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Features updated successfully');
    },
    onError: (error: ApiError) => {
      toast.error(error.message || 'Failed to update features');
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (data: { is_active: boolean; reason?: string }) =>
      apiClient.patch(`/admin/tenants/${tenantId}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Tenant status updated successfully');
    },
    onError: (error: ApiError) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  // Delete tenant mutation
  const deleteTenantMutation = useMutation({
    mutationFn: () => apiClient.delete(`/admin/tenants/${tenantId}`),
    onSuccess: () => {
      toast.success('Tenant deleted successfully');
      router.push('/admin/tenants');
    },
    onError: (error: ApiError) => {
      toast.error(error.message || 'Failed to delete tenant');
    },
  });

  // Initialize form when tenant loads
  const initializeEditForm = () => {
    if (tenant) {
      setEditName(tenant.name);
      setEditDomain(tenant.domain || '');
      setEditLogoUrl(tenant.logo_url || '');
    }
  };

  const initializeSubscriptionForm = () => {
    if (tenant) {
      setSubTier(tenant.tier);
      setSubStatus(tenant.subscription_status);
      setSubMaxUsers(tenant.max_users);
      setSubMaxBranches(tenant.max_branches);
      setSubMaxStorage(tenant.max_storage_gb);
    }
  };

  // Handlers
  const handleSaveInfo = () => {
    updateTenantMutation.mutate({
      name: editName,
      domain: editDomain || undefined,
      logo_url: editLogoUrl || undefined,
    });
  };

  const handleSaveSubscription = () => {
    updateSubscriptionMutation.mutate({
      tier: subTier,
      subscription_status: subStatus,
      max_users: subMaxUsers,
      max_branches: subMaxBranches,
      max_storage_gb: subMaxStorage,
    });
  };

  const handleSaveFeatures = () => {
    updateFeaturesMutation.mutate({ features });
  };

  const handleToggleStatus = () => {
    updateStatusMutation.mutate({
      is_active: !tenant?.is_active,
      reason: tenant?.is_active ? 'Deactivated by super admin' : 'Reactivated by super admin',
    });
  };

  const handleDeleteTenant = () => {
    if (deleteConfirmName === tenant?.name) {
      deleteTenantMutation.mutate();
    }
  };

  if (tenantLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              Error loading tenant details
              <div className="mt-4">
                <Button onClick={() => router.push('/admin/tenants')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Tenants
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700';
      case 'premium': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
      case 'basic': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
      case 'free': return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
      case 'trial': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
      case 'expired': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700';
      case 'suspended': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
    }
  };

  const users = usersResponse?.users || [];
  const branches = branchesResponse?.branches || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/tenants')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              {tenant.name}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Globe className="h-4 w-4" />
              {tenant.subdomain}.yourdomain.com
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenant.is_active ? (
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              <CheckCircle className="mr-1 h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
              <XCircle className="mr-1 h-3 w-3" />
              Inactive
            </Badge>
          )}
          {/* Edit Button */}
          <Dialog open={editDialogOpen} onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (open) initializeEditForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Tenant Information</DialogTitle>
                <DialogDescription>
                  Update the basic information for this tenant.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Tenant name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Custom Domain (optional)</Label>
                  <Input
                    id="domain"
                    value={editDomain}
                    onChange={(e) => setEditDomain(e.target.value)}
                    placeholder="custom.domain.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo URL (optional)</Label>
                  <Input
                    id="logo"
                    value={editLogoUrl}
                    onChange={(e) => setEditLogoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveInfo} disabled={updateTenantMutation.isPending}>
                  {updateTenantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription Tier</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={getTierColor(tenant.tier)}>
              {tenant.tier.toUpperCase()}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Status: <Badge variant="outline" className={getStatusColor(tenant.subscription_status)}>
                {tenant.subscription_status}
              </Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant.user_count}</div>
            <p className="text-xs text-muted-foreground">
              Limit: {tenant.max_users === -1 ? 'Unlimited' : tenant.max_users}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branches</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant.branch_count}</div>
            <p className="text-xs text-muted-foreground">
              Limit: {tenant.max_branches === -1 ? 'Unlimited' : tenant.max_branches}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant.max_storage_gb === -1 ? 'Unlimited' : `${tenant.max_storage_gb} GB`}</div>
            <p className="text-xs text-muted-foreground">
              Allocated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Management Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Subscription Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Subscription Management
            </CardTitle>
            <CardDescription>
              Manage tier, limits, and subscription status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select
                  value={subTier || tenant.tier}
                  onValueChange={setSubTier}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={subStatus || tenant.subscription_status}
                  onValueChange={setSubStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBSCRIPTION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Users</Label>
                <Input
                  type="number"
                  value={subMaxUsers || tenant.max_users}
                  onChange={(e) => setSubMaxUsers(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Branches</Label>
                <Input
                  type="number"
                  value={subMaxBranches || tenant.max_branches}
                  onChange={(e) => setSubMaxBranches(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Storage (GB)</Label>
                <Input
                  type="number"
                  value={subMaxStorage || tenant.max_storage_gb}
                  onChange={(e) => setSubMaxStorage(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <Button
              onClick={() => {
                initializeSubscriptionForm();
                handleSaveSubscription();
              }}
              disabled={updateSubscriptionMutation.isPending}
              className="w-full"
            >
              {updateSubscriptionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Subscription Changes
            </Button>
          </CardContent>
        </Card>

        {/* Tenant Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tenant ID</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">{tenant.id}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subdomain</span>
              <span className="text-sm font-medium">{tenant.subdomain}</span>
            </div>
            {tenant.domain && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Custom Domain</span>
                <span className="text-sm font-medium">{tenant.domain}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm font-medium">
                {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                {' '}
                <span className="text-xs text-muted-foreground">
                  ({formatDistanceToNow(new Date(tenant.created_at), { addSuffix: true })})
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Updated</span>
              <span className="text-sm">
                {tenant.updated_at
                  ? formatDistanceToNow(new Date(tenant.updated_at), { addSuffix: true })
                  : 'Never (since creation)'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Feature Flags
          </CardTitle>
          <CardDescription>
            Enable or disable features for this tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {AVAILABLE_FEATURES.map((feature) => {
              const isEnabled = (features[feature.key] !== undefined ? features[feature.key] : tenant.features?.[feature.key]) || false;
              return (
                <div key={feature.key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{feature.label}</Label>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => {
                      setFeatures((prev) => ({
                        ...prev,
                        [feature.key]: checked,
                      }));
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <Button
              onClick={handleSaveFeatures}
              disabled={updateFeaturesMutation.isPending}
            >
              {updateFeaturesMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Feature Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tenant Actions Card */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Tenant Actions
          </CardTitle>
          <CardDescription>
            Activate, deactivate, or delete this tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Activate/Deactivate */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant={tenant.is_active ? 'outline' : 'default'}>
                  <Power className="mr-2 h-4 w-4" />
                  {tenant.is_active ? 'Deactivate Tenant' : 'Activate Tenant'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {tenant.is_active ? 'Deactivate Tenant?' : 'Activate Tenant?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {tenant.is_active
                      ? 'Deactivating this tenant will prevent all users from logging in. The data will be preserved.'
                      : 'Activating this tenant will allow users to log in again.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleToggleStatus}
                    className={tenant.is_active ? 'bg-orange-600 hover:bg-orange-700' : ''}
                  >
                    {updateStatusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tenant.is_active ? 'Deactivate' : 'Activate'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Tenant
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Tenant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will soft-delete the tenant and all associated data. Users will no longer be able to access the system.
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-medium text-red-800">
                        To confirm deletion, type the tenant name: <strong>{tenant.name}</strong>
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Input
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder="Type tenant name to confirm"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmName('')}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteTenant}
                    disabled={deleteConfirmName !== tenant.name || deleteTenantMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleteTenantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Tenant
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                      {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.full_name || user.email}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{user.role}</Badge>
                    {user.is_active ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Inactive</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Branches ({branches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {branchesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : branches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No branches found</p>
          ) : (
            <div className="space-y-2">
              {branches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {branch.name}
                      {branch.is_hq && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">HQ</Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">Code: {branch.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {branch.is_active ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Inactive</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(branch.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
