/**
 * System Stats Grid Component
 * Displays system-wide statistics for Super Admin dashboard
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { tenantsAPI } from '@/lib/api/tenants';
import {
  Building2,
  Users,
  GitBranch,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  Crown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SystemStatsGrid() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['system-stats'],
    queryFn: tenantsAPI.getSystemStats,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center gap-2 p-6">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-600">
            Failed to load system statistics
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Main Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Tenants
            </CardTitle>
            <Building2 className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_tenants}</div>
            <p className="text-xs text-gray-500">
              {stats.active_tenants} active, {stats.inactive_tenants} inactive
            </p>
          </CardContent>
        </Card>

        {/* Active Tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.active_tenants}
            </div>
            <p className="text-xs text-gray-500">
              {((stats.active_tenants / stats.total_tenants) * 100).toFixed(1)}%
              of total
            </p>
          </CardContent>
        </Card>

        {/* Trial Tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Trial</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.trial_tenants}
            </div>
            <p className="text-xs text-gray-500">
              {stats.trials_expiring_soon} expiring soon
            </p>
          </CardContent>
        </Card>

        {/* Premium + Enterprise */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium+</CardTitle>
            <Crown className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.premium_tier_count + stats.enterprise_tier_count}
            </div>
            <p className="text-xs text-gray-500">
              {stats.premium_tier_count} Premium, {stats.enterprise_tier_count}{' '}
              Enterprise
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution Row */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Free Tier */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Free Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {stats.free_tier_count}
            </div>
          </CardContent>
        </Card>

        {/* Basic Tier */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">
              Basic Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.basic_tier_count}
            </div>
          </CardContent>
        </Card>

        {/* Premium Tier */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">
              Premium Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.premium_tier_count}
            </div>
          </CardContent>
        </Card>

        {/* Enterprise Tier */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">
              Enterprise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.enterprise_tier_count}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users & Branches + Activity Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Users & Branches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Users & Branches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium">Users</span>
              </div>
              <span className="text-2xl font-bold">{stats.total_users}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium">Branches</span>
              </div>
              <span className="text-2xl font-bold">{stats.total_branches}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Today</span>
              <span className="text-sm font-semibold">
                {stats.tenants_created_today} tenants
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">This Week</span>
              <span className="text-sm font-semibold">
                {stats.tenants_created_this_week} tenants
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">This Month</span>
              <span className="text-sm font-semibold">
                {stats.tenants_created_this_month} tenants
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings / Alerts */}
      {(stats.trials_expiring_soon > 0 ||
        stats.subscriptions_expiring_soon > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.trials_expiring_soon > 0 && (
              <p className="text-yellow-700">
                <strong>{stats.trials_expiring_soon}</strong> trial
                {stats.trials_expiring_soon !== 1 ? 's' : ''} expiring in the
                next 7 days
              </p>
            )}
            {stats.subscriptions_expiring_soon > 0 && (
              <p className="text-yellow-700">
                <strong>{stats.subscriptions_expiring_soon}</strong>{' '}
                subscription{stats.subscriptions_expiring_soon !== 1 ? 's' : ''}{' '}
                expiring in the next 7 days
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
