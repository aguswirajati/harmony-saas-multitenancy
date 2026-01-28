'use client';

import { useAuthStore } from '@/lib/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, HardDrive, TrendingUp, Settings, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface TenantUsage {
  tenant_id: string;
  tenant_name: string;
  tier: string;
  users_current: number;
  users_limit: number;
  users_percent: number;
  users_available: number;
  branches_current: number;
  branches_limit: number;
  branches_percent: number;
  branches_available: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  storage_percent: number;
  storage_available_gb: number;
  warnings: string[];
  can_upgrade: boolean;
  next_tier: string | null;
}

export default function DashboardPage() {
  const { user, tenant } = useAuthStore();

  const { data: usage, isLoading } = useQuery({
    queryKey: ['tenant-usage'],
    queryFn: () => apiClient.get<TenantUsage>('/tenant-settings/usage'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const stats = [
    {
      name: 'Total Branches',
      value: usage ? `${usage.branches_current}` : '-',
      subtext: usage ? `of ${usage.branches_limit === -1 ? '∞' : usage.branches_limit} limit` : '',
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      percent: usage?.branches_percent || 0
    },
    {
      name: 'Active Users',
      value: usage ? `${usage.users_current}` : '-',
      subtext: usage ? `of ${usage.users_limit === -1 ? '∞' : usage.users_limit} limit` : '',
      icon: Users,
      color: 'text-green-600',
      bg: 'bg-green-100',
      percent: usage?.users_percent || 0
    },
    {
      name: 'Storage Used',
      value: usage ? `${usage.storage_used_gb.toFixed(1)} GB` : '-',
      subtext: usage ? `of ${usage.storage_limit_gb === -1 ? 'Unlimited' : `${usage.storage_limit_gb} GB`} limit` : '',
      icon: HardDrive,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      percent: usage?.storage_percent || 0
    },
    {
      name: 'Plan',
      value: tenant?.tier ? tenant.tier.charAt(0).toUpperCase() + tenant.tier.slice(1) : '-',
      subtext: usage?.can_upgrade ? `Upgrade to ${usage.next_tier}` : 'Current plan',
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      percent: null,
      href: usage?.can_upgrade ? '/settings?tab=subscription' : undefined
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.first_name || user?.email}!
        </h1>
        <p className="text-gray-500 mt-1">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {stat.name}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-2" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-gray-900 mt-2">
                        {stat.value}
                      </p>
                      {stat.subtext && stat.href ? (
                        <Link href={stat.href} className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-flex items-center gap-1">
                          {stat.subtext}
                          <ArrowRight size={12} />
                        </Link>
                      ) : stat.subtext ? (
                        <p className="text-xs text-gray-500 mt-1">
                          {stat.subtext}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className={`p-3 rounded-full ${stat.bg}`}>
                  <stat.icon className={stat.color} size={24} />
                </div>
              </div>
              {stat.percent !== null && stat.percent > 0 && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        stat.percent >= 90 ? 'bg-red-500' :
                        stat.percent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(stat.percent, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Warnings */}
      {usage?.warnings && usage.warnings.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="text-yellow-600 mt-0.5" size={20} />
              <div>
                <p className="font-medium text-yellow-800">Usage Warnings</p>
                <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                  {usage.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Email</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Role</span>
              <span className="font-medium capitalize">{user?.role}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Status</span>
              <span className="font-medium text-green-600">
                {user?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Verified</span>
              <span className="font-medium">
                {user?.is_verified ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Tenant information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Company</span>
              <span className="font-medium">{tenant?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Subdomain</span>
              <span className="font-medium">{tenant?.subdomain}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Plan</span>
              <span className="font-medium capitalize">{tenant?.tier}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">ID</span>
              <span className="font-mono text-xs text-gray-500">
                {tenant?.id}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/branches" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left block">
              <Building2 className="text-blue-600 mb-2" size={24} />
              <h3 className="font-medium">Add Branch</h3>
              <p className="text-sm text-gray-500 mt-1">
                Create a new branch location
              </p>
            </Link>
            <Link href="/users" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left block">
              <Users className="text-green-600 mb-2" size={24} />
              <h3 className="font-medium">Invite User</h3>
              <p className="text-sm text-gray-500 mt-1">
                Add a new team member
              </p>
            </Link>
            <Link href="/settings?tab=subscription" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left block">
              <Settings className="text-purple-600 mb-2" size={24} />
              <h3 className="font-medium">Subscription</h3>
              <p className="text-sm text-gray-500 mt-1">
                View plans and usage
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
