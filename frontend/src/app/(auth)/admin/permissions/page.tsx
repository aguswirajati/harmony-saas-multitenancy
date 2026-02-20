'use client';

import { Shield, Check, X, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// System permissions with descriptions
const SYSTEM_PERMISSIONS = [
  // Tenants
  { key: 'system.tenants.view', category: 'Tenants', action: 'View', description: 'View tenant list and details' },
  { key: 'system.tenants.create', category: 'Tenants', action: 'Create', description: 'Create new tenants' },
  { key: 'system.tenants.update', category: 'Tenants', action: 'Update', description: 'Edit tenant settings and configuration' },
  { key: 'system.tenants.delete', category: 'Tenants', action: 'Delete', description: 'Delete tenants and all their data' },
  { key: 'system.tenants.impersonate', category: 'Tenants', action: 'Impersonate', description: 'Log in as tenant users for support' },
  // Billing
  { key: 'system.billing.view', category: 'Billing', action: 'View', description: 'View billing transactions and invoices' },
  { key: 'system.billing.manage', category: 'Billing', action: 'Manage', description: 'Approve/reject payments, apply discounts' },
  // Tiers
  { key: 'system.tiers.view', category: 'Tiers', action: 'View', description: 'View subscription tier configurations' },
  { key: 'system.tiers.manage', category: 'Tiers', action: 'Manage', description: 'Create, edit, delete subscription tiers' },
  // Coupons
  { key: 'system.coupons.view', category: 'Coupons', action: 'View', description: 'View coupon codes and redemptions' },
  { key: 'system.coupons.manage', category: 'Coupons', action: 'Manage', description: 'Create, edit, delete coupons' },
  // Payment Methods
  { key: 'system.payment_methods.view', category: 'Payment Methods', action: 'View', description: 'View payment method configurations' },
  { key: 'system.payment_methods.manage', category: 'Payment Methods', action: 'Manage', description: 'Configure payment methods' },
  // Users
  { key: 'system.users.view', category: 'System Users', action: 'View', description: 'View system admin/operator users' },
  { key: 'system.users.create', category: 'System Users', action: 'Create', description: 'Create system admin/operator users' },
  { key: 'system.users.update', category: 'System Users', action: 'Update', description: 'Edit system user details' },
  { key: 'system.users.delete', category: 'System Users', action: 'Delete', description: 'Remove system users' },
  // Tools
  { key: 'system.tools.access', category: 'Developer Tools', action: 'Access', description: 'Access dev tools (seed data, reset DB, logs)' },
  // Settings
  { key: 'system.settings.view', category: 'Platform Settings', action: 'View', description: 'View platform configuration' },
  { key: 'system.settings.manage', category: 'Platform Settings', action: 'Manage', description: 'Modify platform settings' },
  // Audit
  { key: 'system.audit.view', category: 'Audit Logs', action: 'View', description: 'View system-wide audit logs' },
  { key: 'system.audit.manage', category: 'Audit Logs', action: 'Manage', description: 'Archive or clear audit logs' },
  // Revenue
  { key: 'system.revenue.view', category: 'Revenue', action: 'View', description: 'View revenue analytics and reports' },
  // Usage
  { key: 'system.usage.view', category: 'Usage', action: 'View', description: 'View usage metrics and quotas' },
  { key: 'system.usage.manage', category: 'Usage', action: 'Manage', description: 'Set tenant quotas and limits' },
];

// Role permission mappings (matches backend)
const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  admin: new Set([
    'system.tenants.view', 'system.tenants.create', 'system.tenants.update', 'system.tenants.delete', 'system.tenants.impersonate',
    'system.billing.view', 'system.billing.manage',
    'system.tiers.view', 'system.tiers.manage',
    'system.coupons.view', 'system.coupons.manage',
    'system.payment_methods.view', 'system.payment_methods.manage',
    'system.users.view', 'system.users.create', 'system.users.update', 'system.users.delete',
    'system.tools.access',
    'system.settings.view', 'system.settings.manage',
    'system.audit.view', 'system.audit.manage',
    'system.revenue.view',
    'system.usage.view', 'system.usage.manage',
  ]),
  operator: new Set([
    'system.tenants.view',
    'system.billing.view',
    'system.tiers.view',
    'system.coupons.view',
    'system.payment_methods.view',
    'system.users.view',
    'system.settings.view',
    'system.audit.view',
    'system.revenue.view',
    'system.usage.view',
  ]),
};

// Group permissions by category
function groupByCategory(permissions: typeof SYSTEM_PERMISSIONS) {
  const grouped: Record<string, typeof SYSTEM_PERMISSIONS> = {};
  for (const perm of permissions) {
    if (!grouped[perm.category]) {
      grouped[perm.category] = [];
    }
    grouped[perm.category].push(perm);
  }
  return grouped;
}

export default function PermissionsPage() {
  const groupedPermissions = groupByCategory(SYSTEM_PERMISSIONS);
  const categories = Object.keys(groupedPermissions);

  const adminCount = ROLE_PERMISSIONS.admin.size;
  const operatorCount = ROLE_PERMISSIONS.operator.size;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Permission Matrix
          </h1>
          <p className="text-muted-foreground mt-1">
            System role permissions for platform administration
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {SYSTEM_PERMISSIONS.length} Permissions
          </Badge>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">About System Permissions</p>
              <p className="mt-1">
                System permissions control access to platform administration features. These are assigned
                based on the user&apos;s system role (Admin or Operator) and are defined in code.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className="bg-purple-500 hover:bg-purple-500">Admin</Badge>
              Full Access
            </CardTitle>
            <CardDescription>
              Complete control over the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {adminCount}
              </div>
              <div className="text-sm text-muted-foreground">
                permissions granted
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="secondary">Operator</Badge>
              Read-Only Access
            </CardTitle>
            <CardDescription>
              Support and monitoring role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                {operatorCount}
              </div>
              <div className="text-sm text-muted-foreground">
                permissions granted
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permission Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Details</CardTitle>
          <CardDescription>
            Detailed breakdown of permissions by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Category</TableHead>
                    <TableHead className="w-[150px]">Permission</TableHead>
                    <TableHead className="w-[100px] text-center">
                      <Badge className="bg-purple-500 hover:bg-purple-500">Admin</Badge>
                    </TableHead>
                    <TableHead className="w-[100px] text-center">
                      <Badge variant="secondary">Operator</Badge>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    groupedPermissions[category].map((perm, idx) => (
                      <TableRow key={perm.key}>
                        {idx === 0 && (
                          <TableCell
                            rowSpan={groupedPermissions[category].length}
                            className="font-medium bg-muted/30 align-top"
                          >
                            {category}
                          </TableCell>
                        )}
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>{perm.action}</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{perm.description}</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">
                                {perm.key}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center">
                          {ROLE_PERMISSIONS.admin.has(perm.key) ? (
                            <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {ROLE_PERMISSIONS.operator.has(perm.key) ? (
                            <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ))}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-muted-foreground">Permission granted</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-400 dark:text-red-600" />
              <span className="text-muted-foreground">Permission denied</span>
            </div>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Hover for details</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
