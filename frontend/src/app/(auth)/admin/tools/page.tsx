'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Database,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SeedDataResponse {
  message: string;
  created: {
    tenants: number;
    branches: number;
    users: number;
  };
  details: {
    tenants: Array<{ name: string; subdomain: string; tier: string }>;
    sample_credentials: Array<{ tenant: string; email: string; password: string }>;
  };
}

interface ResetDatabaseResponse {
  message: string;
  deleted: {
    tenants: number;
    branches: number;
    users: number;
  };
  preserved: {
    super_admins: number;
  };
  warning: string;
}

export default function AdminToolsPage() {
  const queryClient = useQueryClient();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedDataResponse | null>(null);
  const [resetResult, setResetResult] = useState<ResetDatabaseResponse | null>(null);

  const seedDataMutation = useMutation({
    mutationFn: () => apiClient.post<SeedDataResponse>('/admin/tools/seed-data'),
    onSuccess: (data) => {
      setSeedResult(data);
      setResetResult(null);
      // Invalidate all related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['system-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-branches'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['audit-statistics'] });
    },
  });

  const resetDatabaseMutation = useMutation({
    mutationFn: () => apiClient.post<ResetDatabaseResponse>('/admin/tools/reset-database'),
    onSuccess: (data) => {
      setResetResult(data);
      setSeedResult(null);
      setShowResetDialog(false);
      // Invalidate all related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['system-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-branches'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['audit-statistics'] });
    },
  });

  const handleSeedData = () => {
    setSeedResult(null);
    setResetResult(null);
    seedDataMutation.mutate();
  };

  const handleResetDatabase = () => {
    setShowResetDialog(true);
  };

  const confirmReset = () => {
    setSeedResult(null);
    setResetResult(null);
    resetDatabaseMutation.mutate();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Database Tools</h1>
        <p className="text-gray-500">Manage database seeding and reset operations</p>
      </div>

      {/* Warning Banner */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Caution</AlertTitle>
        <AlertDescription>
          These are powerful tools that modify database data. Use with caution, especially in production environments.
          Always backup your database before performing destructive operations.
        </AlertDescription>
      </Alert>

      {/* Seed Data Result */}
      {seedResult && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">Seed Data Successful</AlertTitle>
          <AlertDescription className="text-green-800">
            <div className="mt-2 space-y-2">
              <p className="font-medium">
                Created {seedResult.created.tenants} tenants, {seedResult.created.branches} branches,
                and {seedResult.created.users} users
              </p>
              <div className="mt-3 space-y-2">
                <p className="font-semibold">Sample Login Credentials:</p>
                {seedResult.details.sample_credentials.map((cred) => (
                  <div key={cred.tenant} className="bg-white p-3 rounded border border-green-200">
                    <p className="text-sm">
                      <span className="font-medium">Tenant:</span> {cred.tenant}<br />
                      <span className="font-medium">Email:</span> {cred.email}<br />
                      <span className="font-medium">Password:</span> {cred.password}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Reset Result */}
      {resetResult && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900">Database Reset Complete</AlertTitle>
          <AlertDescription className="text-red-800">
            <div className="mt-2 space-y-2">
              <p className="font-medium">
                Deleted {resetResult.deleted.tenants} tenants, {resetResult.deleted.branches} branches,
                and {resetResult.deleted.users} users
              </p>
              <p>Preserved {resetResult.preserved.super_admins} super admin accounts</p>
              <p className="text-sm font-semibold mt-2">{resetResult.warning}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tools Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Seed Dummy Data Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Seed Dummy Data
            </CardTitle>
            <CardDescription>
              Create sample tenants, branches, and users for testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">What will be created:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 3 demo tenants (Free, Basic, Premium tiers)</li>
                  <li>• Multiple branches for each tenant</li>
                  <li>• Admin, Manager, and Staff users</li>
                  <li>• All users have simple passwords for testing</li>
                </ul>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Note</AlertTitle>
                <AlertDescription className="text-xs">
                  This operation is safe and won't delete existing data. Duplicate tenants will be skipped.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleSeedData}
                disabled={seedDataMutation.isPending}
                className="w-full"
                variant="default"
              >
                {seedDataMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Seeding Data...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Seed Dummy Data
                  </>
                )}
              </Button>

              {seedDataMutation.isError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {seedDataMutation.error instanceof Error
                      ? seedDataMutation.error.message
                      : 'Failed to seed data'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reset Database Card */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Reset Database
            </CardTitle>
            <CardDescription>
              Delete all tenant data and return to clean state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">What will be deleted:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• All tenants and their data</li>
                  <li>• All branches</li>
                  <li>• All tenant users (preserves super admins)</li>
                  <li>• Audit logs will remain</li>
                </ul>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Danger Zone</AlertTitle>
                <AlertDescription className="text-xs">
                  This action is IRREVERSIBLE! All tenant data will be permanently deleted.
                  Always backup your database before proceeding.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleResetDatabase}
                disabled={resetDatabaseMutation.isPending}
                className="w-full"
                variant="destructive"
              >
                {resetDatabaseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset Database
                  </>
                )}
              </Button>

              {resetDatabaseMutation.isError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {resetDatabaseMutation.error instanceof Error
                      ? resetDatabaseMutation.error.message
                      : 'Failed to reset database'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog for Reset */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Database Reset
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>All tenant organizations</li>
              <li>All branches and branch data</li>
              <li>All tenant users and their data</li>
            </ul>
            <p className="text-sm font-medium mt-4">
              Super admin users will be preserved.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={resetDatabaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReset}
              disabled={resetDatabaseMutation.isPending}
            >
              {resetDatabaseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Yes, Reset Database'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
