'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { adminToolsAPI, RuntimeSettings } from '@/lib/api/admin-tools';
import { useDevModeStore } from '@/lib/store/devModeStore';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Database,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info,
  Settings,
  Server,
  ScrollText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────────────

export default function AdminToolsPage() {
  const router = useRouter();
  const { devMode } = useDevModeStore();
  const queryClient = useQueryClient();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedDataResponse | null>(null);
  const [resetResult, setResetResult] = useState<ResetDatabaseResponse | null>(null);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [logLevel, setLogLevel] = useState<string>('all');
  const [logLimit, setLogLimit] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // ── Runtime Settings ────────────────────────────────────────────────────
  const { data: runtimeSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['runtime-settings'],
    queryFn: () => adminToolsAPI.getSettings(),
    enabled: devMode,
  });

  const settingsMutation = useMutation({
    mutationFn: (data: Partial<RuntimeSettings>) => adminToolsAPI.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime-settings'] });
    },
  });

  // ── System Info ─────────────────────────────────────────────────────────
  const {
    data: systemInfo,
    isLoading: systemInfoLoading,
    refetch: refetchSystemInfo,
    isFetching: systemInfoFetching,
  } = useQuery({
    queryKey: ['system-info'],
    queryFn: () => adminToolsAPI.getSystemInfo(),
    enabled: devMode,
  });

  // ── Request Logs ────────────────────────────────────────────────────────
  const {
    data: logEntries = [],
    isLoading: logsLoading,
    refetch: refetchLogs,
    isFetching: logsFetching,
  } = useQuery({
    queryKey: ['app-logs', logLevel, logLimit],
    queryFn: () =>
      adminToolsAPI.getLogs({
        level: logLevel === 'all' ? undefined : logLevel,
        limit: logLimit,
      }),
    refetchInterval: autoRefresh ? 5000 : false,
    enabled: devMode,
  });

  const scrollToTop = useCallback(() => {
    logContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  // ── Seed / Reset ───────────────────────────────────────────────────────

  const seedDataMutation = useMutation({
    mutationFn: () => apiClient.post<SeedDataResponse>('/admin/tools/seed-data'),
    onSuccess: (data) => {
      setSeedResult(data);
      setResetResult(null);
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

  // Redirect if dev mode is disabled
  useEffect(() => {
    if (!devMode) {
      router.replace('/admin');
    }
  }, [devMode, router]);

  // Don't render if dev mode is off
  if (!devMode) {
    return null;
  }

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

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getLevelBadge = (level: string) => {
    const upper = level.toUpperCase();
    switch (upper) {
      case 'ERROR':
      case 'CRITICAL':
        return <Badge variant="destructive">{upper}</Badge>;
      case 'WARNING':
        return <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700">{upper}</Badge>;
      case 'INFO':
        return <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700">{upper}</Badge>;
      case 'DEBUG':
        return <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">{upper}</Badge>;
      default:
        return <Badge variant="outline">{upper}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status.startsWith('connected') || status === 'healthy') {
      return <Badge className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700">{status}</Badge>;
    }
    if (status.startsWith('disconnected') || status.startsWith('unhealthy')) {
      return <Badge variant="destructive">{status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Developer Tools</h1>
        <p className="text-muted-foreground">Development utilities and database management</p>
      </div>

      {/* ── System Info ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle>System Info</CardTitle>
                <CardDescription>Server versions, connections, and environment</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSystemInfo()}
              disabled={systemInfoFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${systemInfoFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {systemInfoLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : systemInfo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Python Version</p>
                  <p className="text-sm font-mono">{systemInfo.python_version.split(' ')[0]}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">FastAPI Version</p>
                  <p className="text-sm font-mono">{systemInfo.fastapi_version}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Database</p>
                  {getStatusBadge(systemInfo.database_status)}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Redis</p>
                  {getStatusBadge(systemInfo.redis_status)}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Migration Version</p>
                  <p className="text-sm font-mono">{systemInfo.migration_version}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Uptime</p>
                  <p className="text-sm">{systemInfo.uptime}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Platform</p>
                  <p className="text-sm font-mono break-all">{systemInfo.platform}</p>
                </div>
              </div>

              {/* Env vars — collapsible */}
              <div className="border rounded-lg">
                <button
                  onClick={() => setShowEnvVars(!showEnvVars)}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {showEnvVars ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    Environment Variables ({Object.keys(systemInfo.env_vars).length})
                  </div>
                  {showEnvVars ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showEnvVars && (
                  <div className="border-t max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {Object.entries(systemInfo.env_vars).map(([key, value]) => (
                          <tr key={key} className="border-b last:border-0">
                            <td className="px-4 py-1.5 font-mono font-medium whitespace-nowrap">{key}</td>
                            <td className="px-4 py-1.5 font-mono text-muted-foreground break-all">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Runtime Settings ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-orange-600" />
            Runtime Settings
          </CardTitle>
          <CardDescription>
            In-memory overrides — resets to env vars on server restart
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : runtimeSettings ? (
            <div className="space-y-6">
              {/* Rate Limiting toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Rate Limiting</p>
                  <p className="text-xs text-muted-foreground">
                    Enable or disable API rate limiting
                  </p>
                </div>
                <Switch
                  checked={runtimeSettings.rate_limit_enabled}
                  disabled={settingsMutation.isPending}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({ rate_limit_enabled: checked })
                  }
                />
              </div>

              {/* Log Level dropdown */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Log Level</p>
                  <p className="text-xs text-muted-foreground">
                    Application log verbosity
                  </p>
                </div>
                <Select
                  value={runtimeSettings.log_level}
                  onValueChange={(v) => settingsMutation.mutate({ log_level: v })}
                  disabled={settingsMutation.isPending}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBUG">DEBUG</SelectItem>
                    <SelectItem value="INFO">INFO</SelectItem>
                    <SelectItem value="WARNING">WARNING</SelectItem>
                    <SelectItem value="ERROR">ERROR</SelectItem>
                    <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settingsMutation.isError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {settingsMutation.error instanceof Error
                      ? settingsMutation.error.message
                      : 'Failed to update settings'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Request Logs ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle>Request Logs</CardTitle>
                <CardDescription>Recent application log entries from logs/app.log</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Auto-refresh */}
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                Auto-refresh
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLogs()}
                disabled={logsFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${logsFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <Select value={logLevel} onValueChange={setLogLevel}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="DEBUG">DEBUG</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARNING">WARNING</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
                <SelectItem value="CRITICAL">CRITICAL</SelectItem>
              </SelectContent>
            </Select>

            <Select value={logLimit.toString()} onValueChange={(v) => setLogLimit(parseInt(v))}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 lines</SelectItem>
                <SelectItem value="100">100 lines</SelectItem>
                <SelectItem value="200">200 lines</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button variant="ghost" size="sm" onClick={scrollToTop}>
              <ArrowUp className="h-4 w-4 mr-1" /> Top
            </Button>
            <Button variant="ghost" size="sm" onClick={scrollToBottom}>
              <ArrowDown className="h-4 w-4 mr-1" /> Bottom
            </Button>
          </div>

          {/* Log table */}
          <div ref={logContainerRef} className="max-h-96 overflow-y-auto border rounded-lg">
            {logsLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : logEntries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No log entries found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[100px]">Level</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logEntries.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {entry.timestamp || '-'}
                      </TableCell>
                      <TableCell>{getLevelBadge(entry.level)}</TableCell>
                      <TableCell className="text-xs font-mono break-all">
                        {entry.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Showing {logEntries.length} entries (most recent first)
            {autoRefresh && ' — auto-refreshing every 5s'}
          </p>
        </CardContent>
      </Card>

      {/* ── Database Tools ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Database Tools
          </CardTitle>
          <CardDescription>
            Manage database seeding and reset operations for development
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900 dark:text-green-100">Seed Data Successful</AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="mt-2 space-y-2">
                  <p className="font-medium">
                    Created {seedResult.created.tenants} tenants, {seedResult.created.branches} branches,
                    and {seedResult.created.users} users
                  </p>
                  <div className="mt-3 space-y-2">
                    <p className="font-semibold">Sample Login Credentials:</p>
                    {seedResult.details.sample_credentials.map((cred) => (
                      <div key={cred.tenant} className="bg-white dark:bg-green-900 p-3 rounded border border-green-200 dark:border-green-700">
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
            <Alert className="border-red-500 bg-red-50 dark:bg-red-950 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-900 dark:text-red-100">Database Reset Complete</AlertTitle>
              <AlertDescription className="text-red-800 dark:text-red-200">
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

          {/* Database Tools Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Seed Dummy Data Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
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
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>3 demo tenants (Free, Basic, Premium tiers)</li>
                      <li>Multiple branches for each tenant</li>
                      <li>Admin, Manager, and Staff users</li>
                      <li>All users have simple passwords for testing</li>
                    </ul>
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Note</AlertTitle>
                    <AlertDescription className="text-xs">
                      This operation is safe and won&apos;t delete existing data. Duplicate tenants will be skipped.
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={handleSeedData}
                    disabled={seedDataMutation.isPending}
                    className="w-full"
                    variant="default"
                  >
                    {seedDataMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Seeding Data...</>
                    ) : (
                      <><Database className="mr-2 h-4 w-4" />Seed Dummy Data</>
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
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-red-600">
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
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>All tenants and their data</li>
                      <li>All branches</li>
                      <li>All tenant users (preserves super admins)</li>
                      <li>Audit logs will remain</li>
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
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</>
                    ) : (
                      <><Trash2 className="mr-2 h-4 w-4" />Reset Database</>
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
        </CardContent>
      </Card>

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
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</>
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
