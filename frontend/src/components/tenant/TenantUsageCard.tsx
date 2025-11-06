/**
 * Tenant Usage Card Component
 * Displays current usage vs limits for tenant dashboard
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { tenantsAPI, getUsageColor } from '@/lib/api/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  GitBranch,
  HardDrive,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TenantUsageCard() {
  const { data: usage, isLoading, error } = useQuery({
    queryKey: ['tenant-usage'],
    queryFn: tenantsAPI.getUsage,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !usage) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load usage data</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const showWarning =
    usage.is_user_limit_reached ||
    usage.is_branch_limit_reached ||
    usage.is_storage_limit_reached;

  return (
    <div className="space-y-4">
      {/* Main Usage Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Usage & Limits</CardTitle>
            <Badge className="bg-purple-100 text-purple-700">
              {usage.tier.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Users */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Users</span>
              </div>
              <span className="text-sm text-gray-600">
                <span
                  className={`font-semibold ${getUsageColor(usage.users_percent)}`}
                >
                  {usage.users_current}
                </span>{' '}
                / {usage.users_limit === -1 ? '∞' : usage.users_limit}
              </span>
            </div>
            <Progress value={usage.users_percent} className="h-2" />
            <p className="text-xs text-gray-500">
              {usage.users_available > 0
                ? `${usage.users_available} available`
                : 'Limit reached'}
            </p>
          </div>

          {/* Branches */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Branches</span>
              </div>
              <span className="text-sm text-gray-600">
                <span
                  className={`font-semibold ${getUsageColor(usage.branches_percent)}`}
                >
                  {usage.branches_current}
                </span>{' '}
                / {usage.branches_limit === -1 ? '∞' : usage.branches_limit}
              </span>
            </div>
            <Progress value={usage.branches_percent} className="h-2" />
            <p className="text-xs text-gray-500">
              {usage.branches_available > 0
                ? `${usage.branches_available} available`
                : 'Limit reached'}
            </p>
          </div>

          {/* Storage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Storage</span>
              </div>
              <span className="text-sm text-gray-600">
                <span
                  className={`font-semibold ${getUsageColor(usage.storage_percent)}`}
                >
                  {usage.storage_used_gb.toFixed(2)} GB
                </span>{' '}
                / {usage.storage_limit_gb} GB
              </span>
            </div>
            <Progress value={usage.storage_percent} className="h-2" />
            <p className="text-xs text-gray-500">
              {usage.storage_available_gb.toFixed(2)} GB available
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Warning Alert */}
      {showWarning && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-1">Limits Reached</p>
            <ul className="text-sm space-y-1">
              {usage.is_user_limit_reached && (
                <li>• User limit reached - cannot add more users</li>
              )}
              {usage.is_branch_limit_reached && (
                <li>• Branch limit reached - cannot add more branches</li>
              )}
              {usage.is_storage_limit_reached && (
                <li>• Storage limit reached - cleanup required</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Upgrade CTA */}
      {usage.can_upgrade && usage.next_tier && (
        <Card className="bg-linear-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">
                  Upgrade to {usage.next_tier.toUpperCase()}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Get more users, branches, and storage. Contact your
                  administrator for upgrade options.
                </p>
                <Button size="sm" variant="default">
                  View Plans
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
