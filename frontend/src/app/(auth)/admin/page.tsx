/**
 * Admin Dashboard Page
 * Super Admin main dashboard with system overview
 * 
 * Location: app/(admin)/admin/page.tsx
 */

'use client';

import { SystemStatsGrid } from '@/components/admin/SystemStatsGrid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Building2, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500">
            System overview and statistics
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Tenant
          </Link>
        </Button>
      </div>

      {/* System Stats */}
      <SystemStatsGrid />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/admin/tenants">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Manage Tenants
              </CardTitle>
              <Building2 className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500">
                View and manage all tenant organizations
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/admin/stats">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                View Statistics
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500">
                Detailed analytics and reports
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/admin/users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                All Users
              </CardTitle>
              <Users className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500">
                View all users across tenants
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Welcome Message */}
      <Card className="bg-linear-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-2">
            Welcome to Super Admin Dashboard
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            From here you can manage all tenant organizations, monitor system
            health, and configure global settings. Use the sidebar navigation
            to access different sections.
          </p>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href="/admin/tenants/new">Create First Tenant</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="http://localhost:8000/api/docs" target="_blank" rel="noopener noreferrer">View API Docs</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
