'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Building2,
  GitBranch,
  TrendingUp,
  TrendingDown,
  Activity,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SystemStats {
  overview: {
    total_tenants: number;
    total_users: number;
    total_branches: number;
    verified_users: number;
    unverified_users: number;
    inactive_tenants: number;
  };
  users_by_role: Record<string, number>;
  tenants_by_tier: Record<string, number>;
  recent_activity: {
    new_tenants_30d: number;
    new_users_30d: number;
    logins_24h: number;
    total_actions_24h: number;
  };
  growth: {
    tenants_last_7d: number;
    tenants_prev_7d: number;
    tenant_growth_percentage: number;
    users_last_7d: number;
    users_prev_7d: number;
    user_growth_percentage: number;
  };
}

interface AdminStatsPageProps {
  embedded?: boolean;
}

export default function AdminStatsPage({ embedded = false }: AdminStatsPageProps) {
  const { data: stats, isLoading, error } = useQuery<SystemStats>({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get<SystemStats>('/admin/stats'),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className={embedded ? "space-y-4" : "space-y-6 p-6"}>
        {!embedded && <Skeleton className="h-12 w-64" />}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={embedded ? "" : "p-6"}>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              Error loading statistics: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700';
      case 'premium':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
      case 'basic':
        return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
      case 'free':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700';
      case 'admin':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
      case 'staff':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
    }
  };

  return (
    <div className={embedded ? "space-y-4" : "space-y-6 p-6"}>
      {/* Page Header */}
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">System Statistics</h1>
          <p className="text-muted-foreground">Overview of system-wide metrics and activity</p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.total_tenants}</div>
            <p className="text-xs text-muted-foreground">
              {stats.recent_activity.new_tenants_30d} new in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.total_users}</div>
            <p className="text-xs text-muted-foreground">
              {stats.recent_activity.new_users_30d} new in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.total_branches}</div>
            <p className="text-xs text-muted-foreground">
              Across all tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recent_activity.logins_24h}</div>
            <p className="text-xs text-muted-foreground">
              {stats.recent_activity.total_actions_24h} total actions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Growth (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Last 7 days</p>
                  <p className="text-2xl font-bold">{stats.growth.tenants_last_7d}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Previous 7 days</p>
                  <p className="text-xl font-semibold text-muted-foreground">{stats.growth.tenants_prev_7d}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {stats.growth.tenant_growth_percentage >= 0 ? (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="text-green-500 font-medium">
                      +{stats.growth.tenant_growth_percentage}%
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <span className="text-red-500 font-medium">
                      {stats.growth.tenant_growth_percentage}%
                    </span>
                  </>
                )}
                <span className="text-sm text-muted-foreground">vs previous week</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Growth (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Last 7 days</p>
                  <p className="text-2xl font-bold">{stats.growth.users_last_7d}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Previous 7 days</p>
                  <p className="text-xl font-semibold text-muted-foreground">{stats.growth.users_prev_7d}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {stats.growth.user_growth_percentage >= 0 ? (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="text-green-500 font-medium">
                      +{stats.growth.user_growth_percentage}%
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <span className="text-red-500 font-medium">
                      {stats.growth.user_growth_percentage}%
                    </span>
                  </>
                )}
                <span className="text-sm text-muted-foreground">vs previous week</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              User Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Verified</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  {stats.overview.verified_users}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Unverified</span>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                  {stats.overview.unverified_users}
                </Badge>
              </div>
              {stats.overview.inactive_tenants > 0 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm flex items-center gap-1">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    Inactive Tenants
                  </span>
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                    {stats.overview.inactive_tenants}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.users_by_role).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{role.replace('_', ' ')}</span>
                  <Badge variant="outline" className={getRoleBadgeColor(role)}>
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenants by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.tenants_by_tier).map(([tier, count]) => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{tier}</span>
                  <Badge variant="outline" className={getTierBadgeColor(tier)}>
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
