'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Crown,
  Users,
  GitBranch,
  Database,
  Building2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface TenantSummary {
  id: string;
  name: string;
  subdomain: string;
  tier: string;
  subscription_status: string;
  is_active: boolean;
  created_at: string;
  user_count: number;
  branch_count: number;
}

interface TenantListResponse {
  items: TenantSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface SystemStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_branches: number;
  tenants_by_tier: Record<string, number>;
  tenants_by_status: Record<string, number>;
}

const TIER_CONFIGS = {
  free: { max_users: 5, max_branches: 1, max_storage_gb: 1, color: 'bg-gray-100 border-gray-300 text-gray-800' },
  basic: { max_users: 20, max_branches: 5, max_storage_gb: 10, color: 'bg-green-100 border-green-300 text-green-800' },
  premium: { max_users: 100, max_branches: 20, max_storage_gb: 50, color: 'bg-blue-100 border-blue-300 text-blue-800' },
  enterprise: { max_users: -1, max_branches: -1, max_storage_gb: 200, color: 'bg-purple-100 border-purple-300 text-purple-800' },
};

const TIERS = ['free', 'basic', 'premium', 'enterprise'] as const;

export default function SubscriptionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [updatingTenantId, setUpdatingTenantId] = useState<string | null>(null);

  // Fetch system stats
  const { data: stats, isLoading: statsLoading } = useQuery<SystemStats>({
    queryKey: ['system-stats'],
    queryFn: () => apiClient.get('/admin/tenants/stats'),
  });

  // Fetch tenants with tier filter
  const { data: tenantsResponse, isLoading: tenantsLoading } = useQuery<TenantListResponse>({
    queryKey: ['tenants', selectedTier],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedTier) params.append('tier', selectedTier);
      params.append('limit', '100');
      return apiClient.get(`/admin/tenants?${params.toString()}`);
    },
  });

  // Update tenant tier mutation
  const updateTierMutation = useMutation({
    mutationFn: ({ tenantId, tier }: { tenantId: string; tier: string }) =>
      apiClient.put(`/admin/tenants/${tenantId}/subscription`, { tier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['system-stats'] });
      toast.success('Tenant tier updated successfully');
      setUpdatingTenantId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update tier');
      setUpdatingTenantId(null);
    },
  });

  const handleTierChange = (tenantId: string, newTier: string) => {
    setUpdatingTenantId(tenantId);
    updateTierMutation.mutate({ tenantId, tier: newTier });
  };

  const getTierColor = (tier: string) => {
    return TIER_CONFIGS[tier as keyof typeof TIER_CONFIGS]?.color || 'bg-gray-100 border-gray-300 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'trial': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'expired': return 'bg-red-100 text-red-800 border-red-300';
      case 'suspended': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const tenants = tenantsResponse?.items || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-8 w-8" />
          Subscription Management
        </h1>
        <p className="text-gray-500 mt-1">
          Manage subscription tiers and view tenant distribution
        </p>
      </div>

      {/* Tier Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => {
          const config = TIER_CONFIGS[tier];
          const count = stats?.tenants_by_tier?.[tier] || 0;
          const isSelected = selectedTier === tier;

          return (
            <Card
              key={tier}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
              }`}
              onClick={() => setSelectedTier(isSelected ? null : tier)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <Badge variant="outline" className={config.color}>
                    {tier.toUpperCase()}
                  </Badge>
                  {isSelected && (
                    <Badge variant="default" className="text-xs">
                      Filtered
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{config.max_users === -1 ? 'Unlimited' : config.max_users} users</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GitBranch className="h-4 w-4" />
                    <span>{config.max_branches === -1 ? 'Unlimited' : config.max_branches} branches</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Database className="h-4 w-4" />
                    <span>{config.max_storage_gb} GB storage</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <span className="text-2xl font-bold">{count}</span>
                      <span className="text-muted-foreground">tenants</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total_tenants || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats?.active_tenants || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Branches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total_branches || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Tenants by Tier
            </div>
            {selectedTier && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTier(null)}
              >
                Clear Filter
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            {selectedTier
              ? `Showing ${tenants.length} ${selectedTier} tier tenants`
              : `Showing all ${tenants.length} tenants`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenantsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {selectedTier
                ? `No tenants found with ${selectedTier} tier`
                : 'No tenants found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => {
                  const tierConfig = TIER_CONFIGS[tenant.tier as keyof typeof TIER_CONFIGS];
                  const isUpdating = updatingTenantId === tenant.id;

                  return (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {tenant.subdomain}.yourdomain.com
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tenant.tier}
                          onValueChange={(value) => handleTierChange(tenant.id, value)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-32">
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {TIERS.map((tier) => (
                              <SelectItem key={tier} value={tier}>
                                <Badge variant="outline" className={TIER_CONFIGS[tier].color}>
                                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                                </Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(tenant.subscription_status)}>
                          {tenant.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={tenant.user_count >= (tierConfig?.max_users || 0) && tierConfig?.max_users !== -1 ? 'text-red-600 font-medium' : ''}>
                          {tenant.user_count}
                        </span>
                        <span className="text-muted-foreground">
                          /{tierConfig?.max_users === -1 ? '∞' : tierConfig?.max_users}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={tenant.branch_count >= (tierConfig?.max_branches || 0) && tierConfig?.max_branches !== -1 ? 'text-red-600 font-medium' : ''}>
                          {tenant.branch_count}
                        </span>
                        <span className="text-muted-foreground">
                          /{tierConfig?.max_branches === -1 ? '∞' : tierConfig?.max_branches}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tenant.is_active ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Subscription Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Status Distribution</CardTitle>
          <CardDescription>
            Overview of tenant subscription statuses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 flex-1" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-5">
              {['active', 'trial', 'expired', 'cancelled', 'suspended'].map((status) => {
                const count = stats?.tenants_by_status?.[status] || 0;
                return (
                  <div
                    key={status}
                    className="flex flex-col items-center p-4 border rounded-lg"
                  >
                    <Badge variant="outline" className={getStatusColor(status)}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                    <span className="text-2xl font-bold mt-2">{count}</span>
                    <span className="text-xs text-muted-foreground">tenants</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
