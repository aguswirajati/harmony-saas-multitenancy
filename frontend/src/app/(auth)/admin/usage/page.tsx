'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminUsageAPI } from '@/lib/api/usage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Activity,
  HardDrive,
  Users,
  Building2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Eye,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TenantUsageOverview, TenantUsageSummary, MetricType } from '@/types/usage';
import {
  formatMetricValue,
  formatLimit,
  getUsageProgressColor,
  METRIC_DISPLAY_NAMES,
} from '@/types/usage';

interface AdminUsagePageProps {
  embedded?: boolean;
}

export default function AdminUsagePage({ embedded = false }: AdminUsagePageProps) {
  const [filter, setFilter] = useState<'all' | 'warning' | 'exceeded'>('all');
  const [selectedTenant, setSelectedTenant] = useState<TenantUsageOverview | null>(null);
  const [tenantDetails, setTenantDetails] = useState<TenantUsageSummary | null>(null);
  const queryClient = useQueryClient();

  // Fetch usage overview
  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['admin-usage-overview', filter],
    queryFn: () => adminUsageAPI.getOverview({
      has_warning: filter === 'warning' ? true : undefined,
      has_exceeded: filter === 'exceeded' ? true : undefined,
      limit: 100,
    }),
  });

  // Reset usage mutation
  const resetMutation = useMutation({
    mutationFn: ({ tenantId, metricType }: { tenantId: string; metricType: MetricType }) =>
      adminUsageAPI.resetUsage(tenantId, metricType),
    onSuccess: () => {
      toast.success('Usage counter reset successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-usage-overview'] });
      if (selectedTenant) {
        loadTenantDetails(selectedTenant.tenant_id);
      }
    },
    onError: () => {
      toast.error('Failed to reset usage');
    },
  });

  // Sync with tier mutation
  const syncMutation = useMutation({
    mutationFn: (tenantId: string) => adminUsageAPI.syncWithTier(tenantId),
    onSuccess: (data) => {
      toast.success(`Quotas synced with tier: ${data.tier}`);
      queryClient.invalidateQueries({ queryKey: ['admin-usage-overview'] });
      if (selectedTenant) {
        loadTenantDetails(selectedTenant.tenant_id);
      }
    },
    onError: () => {
      toast.error('Failed to sync quotas');
    },
  });

  // Process monthly resets mutation
  const processResetsMutation = useMutation({
    mutationFn: () => adminUsageAPI.processResets(),
    onSuccess: (data) => {
      toast.success(`Processed ${data.count} quota resets`);
      queryClient.invalidateQueries({ queryKey: ['admin-usage-overview'] });
    },
    onError: () => {
      toast.error('Failed to process resets');
    },
  });

  const loadTenantDetails = async (tenantId: string) => {
    try {
      const details = await adminUsageAPI.getTenantSummary(tenantId);
      setTenantDetails(details);
    } catch {
      toast.error('Failed to load tenant details');
    }
  };

  const handleViewTenant = (tenant: TenantUsageOverview) => {
    setSelectedTenant(tenant);
    loadTenantDetails(tenant.tenant_id);
  };

  const getMetricIcon = (metricType: string) => {
    switch (metricType) {
      case 'api_calls':
        return <Zap className="h-4 w-4" />;
      case 'storage_bytes':
        return <HardDrive className="h-4 w-4" />;
      case 'active_users':
        return <Users className="h-4 w-4" />;
      case 'branches':
        return <Building2 className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className={embedded ? "space-y-4" : "space-y-6 p-6"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold">Usage Metering</h1>
            <p className="text-muted-foreground">Monitor tenant usage and quotas</p>
          </div>
        )}
        <div className={`flex items-center gap-2 ${embedded ? 'ml-auto' : ''}`}>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              <SelectItem value="warning">With Warnings</SelectItem>
              <SelectItem value="exceeded">Exceeded Limits</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => processResetsMutation.mutate()}
            disabled={processResetsMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Process Resets
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : overview ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tenants</p>
                    <p className="text-2xl font-bold">{overview.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">With Warnings</p>
                    <p className="text-2xl font-bold">{overview.tenants_with_warnings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Exceeded Limits</p>
                    <p className="text-2xl font-bold">{overview.tenants_exceeded}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Healthy</p>
                    <p className="text-2xl font-bold">
                      {overview.total - overview.tenants_with_warnings - overview.tenants_exceeded}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Usage</CardTitle>
          <CardDescription>
            Usage metrics for all tenants ({overview?.items.length || 0} shown)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : overview?.items.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No tenants found</h3>
              <p className="text-muted-foreground">
                {filter !== 'all' ? 'Try changing the filter' : 'No tenants with usage data yet'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>API Calls</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Branches</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview?.items.map((tenant) => (
                    <TableRow key={tenant.tenant_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tenant.tenant_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{tenant.tier}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <UsageCell
                          value={tenant.api_calls}
                          limit={tenant.api_calls_limit}
                          percentage={tenant.api_calls_percentage}
                          metricType="api_calls"
                        />
                      </TableCell>
                      <TableCell>
                        <UsageCell
                          value={tenant.storage_bytes}
                          limit={tenant.storage_limit_bytes}
                          percentage={tenant.storage_percentage}
                          metricType="storage_bytes"
                        />
                      </TableCell>
                      <TableCell>
                        <UsageCell
                          value={tenant.active_users}
                          limit={tenant.users_limit}
                          percentage={tenant.users_percentage}
                          metricType="active_users"
                        />
                      </TableCell>
                      <TableCell>
                        <UsageCell
                          value={tenant.branches}
                          limit={tenant.branches_limit}
                          percentage={tenant.branches_percentage}
                          metricType="branches"
                        />
                      </TableCell>
                      <TableCell>
                        {tenant.has_exceeded ? (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Exceeded
                          </Badge>
                        ) : tenant.has_warning ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Warning
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Healthy
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTenant(tenant)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Detail Dialog */}
      <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTenant?.tenant_name}</DialogTitle>
            <DialogDescription>
              Usage details and quota management
            </DialogDescription>
          </DialogHeader>

          {tenantDetails ? (
            <div className="space-y-6">
              {/* Period Info */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  Current period started: {new Date(tenantDetails.period_start).toLocaleDateString()}
                </span>
                {tenantDetails.has_alerts && (
                  <Badge variant="destructive">
                    {tenantDetails.unacknowledged_alerts} unread alerts
                  </Badge>
                )}
              </div>

              {/* Metrics */}
              <div className="space-y-4">
                {tenantDetails.metrics.map((metric) => (
                  <div key={metric.metric_type} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getMetricIcon(metric.metric_type)}
                        <span className="font-medium">{metric.metric_display_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {formatMetricValue(metric.metric_type as MetricType, metric.current_value)} / {formatLimit(metric.metric_type as MetricType, metric.limit_value)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetMutation.mutate({
                            tenantId: selectedTenant!.tenant_id,
                            metricType: metric.metric_type as MetricType,
                          })}
                          disabled={resetMutation.isPending}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Progress
                      value={metric.is_unlimited ? 0 : Math.min(metric.usage_percentage, 100)}
                      className={`h-2 ${getUsageProgressColor(metric.usage_percentage)}`}
                    />
                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                      <span>
                        {metric.is_unlimited ? 'Unlimited' : `${metric.usage_percentage.toFixed(1)}%`}
                      </span>
                      <span>
                        {metric.is_exceeded
                          ? 'Exceeded'
                          : metric.is_near_limit
                          ? 'Near limit'
                          : `${formatMetricValue(metric.metric_type as MetricType, metric.remaining)} remaining`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => syncMutation.mutate(selectedTenant!.tenant_id)}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync with Tier
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    adminUsageAPI.resetAllUsage(selectedTenant!.tenant_id).then(() => {
                      toast.success('All usage counters reset');
                      loadTenantDetails(selectedTenant!.tenant_id);
                      queryClient.invalidateQueries({ queryKey: ['admin-usage-overview'] });
                    });
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset All
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Usage cell component for the table
function UsageCell({
  value,
  limit,
  percentage,
  metricType,
}: {
  value: number;
  limit: number;
  percentage: number;
  metricType: MetricType;
}) {
  const isUnlimited = limit === -1;

  return (
    <div className="w-24">
      <div className="text-sm">
        {formatMetricValue(metricType, value)}
      </div>
      {!isUnlimited && (
        <Progress
          value={Math.min(percentage, 100)}
          className={`h-1.5 mt-1 ${getUsageProgressColor(percentage)}`}
        />
      )}
      <div className="text-xs text-muted-foreground">
        {isUnlimited ? 'Unlimited' : `${percentage.toFixed(0)}%`}
      </div>
    </div>
  );
}
