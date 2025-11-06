'use client';

import { useAuthStore } from '@/lib/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Package, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { user, tenant } = useAuthStore();

  const stats = [
    {
      name: 'Total Branches',
      value: tenant ? `${tenant.tier === 'free' ? '1' : '5+'}` : '0',
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-100'
    },
    {
      name: 'Active Users',
      value: '12',
      icon: Users,
      color: 'text-green-600',
      bg: 'bg-green-100'
    },
    {
      name: 'Products',
      value: '48',
      icon: Package,
      color: 'text-purple-600',
      bg: 'bg-purple-100'
    },
    {
      name: 'Growth',
      value: '+12%',
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-100'
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
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stat.bg}`}>
                  <stat.icon className={stat.color} size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
            <button className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Building2 className="text-blue-600 mb-2" size={24} />
              <h3 className="font-medium">Add Branch</h3>
              <p className="text-sm text-gray-500 mt-1">
                Create a new branch location
              </p>
            </button>
            <button className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Users className="text-green-600 mb-2" size={24} />
              <h3 className="font-medium">Invite User</h3>
              <p className="text-sm text-gray-500 mt-1">
                Add a new team member
              </p>
            </button>
            <button className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Package className="text-purple-600 mb-2" size={24} />
              <h3 className="font-medium">Add Product</h3>
              <p className="text-sm text-gray-500 mt-1">
                Create a new product
              </p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
