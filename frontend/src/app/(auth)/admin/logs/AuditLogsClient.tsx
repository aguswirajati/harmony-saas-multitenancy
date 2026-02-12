'use client';

import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auditAPI, type ArchiveResult } from '@/lib/api/audit';
import { useDevModeStore } from '@/lib/store/devModeStore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Users,
  Clock,
  Trash2,
  Archive,
  Loader2,
  CalendarDays,
  Download,
  FileJson,
  FolderArchive,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow, format, subDays } from 'date-fns';
import { toast } from 'sonner';

export default function AuditLogsClient() {
  const queryClient = useQueryClient();
  const { devMode } = useDevModeStore();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showArchivesPanel, setShowArchivesPanel] = useState(false);
  const [archiveDays, setArchiveDays] = useState(0); // Default to "All logs"
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [archiveResult, setArchiveResult] = useState<ArchiveResult | null>(null);

  // Fetch archived files
  const { data: archivesData, refetch: refetchArchives } = useQuery({
    queryKey: ['audit-archives'],
    queryFn: () => auditAPI.listArchives(),
    enabled: showArchivesPanel,
  });

  // Clear logs mutation
  const clearLogsMutation = useMutation({
    mutationFn: () => auditAPI.clearLogs(),
    onSuccess: (data) => {
      setShowClearDialog(false);
      setClearResult(`Cleared ${data.deleted} audit log records`);
      setArchiveResult(null);
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['audit-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['audit-actions'] });
      queryClient.invalidateQueries({ queryKey: ['audit-resources'] });
    },
  });

  // Archive logs mutation
  const archiveLogsMutation = useMutation({
    mutationFn: (beforeDate: string) => auditAPI.archiveLogs(beforeDate),
    onSuccess: (data) => {
      setShowArchiveDialog(false);
      setArchiveResult(data);
      setClearResult(null);
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['audit-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['audit-actions'] });
      queryClient.invalidateQueries({ queryKey: ['audit-resources'] });
      queryClient.invalidateQueries({ queryKey: ['audit-archives'] });
    },
  });

  // Delete archive file mutation
  const deleteArchiveMutation = useMutation({
    mutationFn: (filename: string) => auditAPI.deleteArchive(filename),
    onSuccess: () => {
      toast.success('Archive file deleted');
      queryClient.invalidateQueries({ queryKey: ['audit-archives'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete archive');
    },
  });

  // Download archive file
  const handleDownloadArchive = async (filename: string) => {
    try {
      await auditAPI.downloadArchive(filename);
    } catch (error) {
      toast.error('Failed to download archive file');
      console.error('Download error:', error);
    }
  };

  // Fetch filter options
  const { data: actions = [] } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: () => auditAPI.getActions(),
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['audit-resources'],
    queryFn: () => auditAPI.getResources(),
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['audit-statistics'],
    queryFn: () => auditAPI.getStatistics(),
    refetchInterval: 60000, // Refresh every minute
  });

  // Build query params
  const params = {
    skip: (page - 1) * pageSize,
    limit: pageSize,
    ...(search && { search }),
    ...(actionFilter !== 'all' && { action: actionFilter }),
    ...(resourceFilter !== 'all' && { resource: resourceFilter }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
  };

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditAPI.getAuditLogs(params),
  });

  const logs = response?.logs || [];
  const total = response?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case 'failure':
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Failure
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
            {status}
          </Badge>
        );
    }
  };

  const getActionCategory = (action: string): string => {
    if (action.startsWith('auth.')) return 'Authentication';
    if (action.startsWith('tenant.')) return 'Tenant';
    if (action.startsWith('user.')) return 'User';
    if (action.startsWith('branch.')) return 'Branch';
    if (action.startsWith('settings.')) return 'Settings';
    if (action.startsWith('system.')) return 'System';
    if (action.startsWith('tier.')) return 'Subscription Tier';
    if (action.startsWith('payment_method.')) return 'Payment Method';
    if (action.startsWith('upgrade.')) return 'Upgrade Request';
    if (action.startsWith('file.')) return 'File';
    return 'Other';
  };

  const formatAction = (action: string): string => {
    return action.split('.').pop()?.replace(/_/g, ' ') || action;
  };

  const clearFilters = () => {
    setSearch('');
    setActionFilter('all');
    setResourceFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  const hasActiveFilters = search || actionFilter !== 'all' || resourceFilter !== 'all' || statusFilter !== 'all';

  const toggleRowExpansion = (logId: string) => {
    setExpandedRow(expandedRow === logId ? null : logId);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-gray-500">System activity and security event monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowArchivesPanel(!showArchivesPanel);
              if (!showArchivesPanel) refetchArchives();
            }}
          >
            <FolderArchive className="h-4 w-4 mr-2" />
            View Archives
            {archivesData?.total ? (
              <Badge variant="secondary" className="ml-2">{archivesData.total}</Badge>
            ) : null}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchiveDialog(true)}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive Old Logs
          </Button>
          {devMode && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Logs
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge variant="outline" className="px-3 py-1">
            <Shield className="mr-2 h-4 w-4" />
            Total: {total.toLocaleString()}
          </Badge>
        </div>
      </div>

      {/* Clear/Archive Result Alerts */}
      {clearResult && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">{clearResult}</AlertDescription>
        </Alert>
      )}
      {archiveResult && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <div className="flex flex-col gap-2">
              <span>{archiveResult.message}</span>
              {archiveResult.file && (
                <div className="flex items-center gap-2 mt-1">
                  <FileJson className="h-4 w-4" />
                  <span className="font-mono text-sm">{archiveResult.file.name}</span>
                  <span className="text-xs">({archiveResult.file.size_readable})</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => handleDownloadArchive(archiveResult.file!.name)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Archives Panel */}
      {showArchivesPanel && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderArchive className="h-5 w-5" />
              Archived Audit Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {archivesData?.archives && archivesData.archives.length > 0 ? (
              <div className="space-y-2">
                {archivesData.archives.map((archive) => (
                  <div
                    key={archive.name}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileJson className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="font-mono text-sm font-medium">{archive.name}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{archive.total_records.toLocaleString()} records</span>
                          <span>•</span>
                          <span>{archive.size_readable}</span>
                          <span>•</span>
                          <span>Created {formatDistanceToNow(new Date(archive.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadArchive(archive.name)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      {devMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-100"
                          onClick={() => deleteArchiveMutation.mutate(archive.name)}
                          disabled={deleteArchiveMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderArchive className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No archived files found</p>
                <p className="text-sm">Archive old logs to create backup files</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Logs</p>
                  <p className="text-2xl font-bold">{stats.total_logs.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Logins (24h)</p>
                  <p className="text-2xl font-bold">{stats.successful_logins_24h}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Failed Logins (24h)</p>
                  <p className="text-2xl font-bold">{stats.failed_logins_24h}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Unique Users</p>
                  <p className="text-2xl font-bold">{stats.total_users}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions by Status */}
      {stats?.actions_by_status && Object.keys(stats.actions_by_status).length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground mb-2">Actions by Status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.actions_by_status).map(([status, count]) => (
                <Badge
                  key={status}
                  variant="outline"
                  className={
                    status === 'success'
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700'
                      : status === 'failure'
                        ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700'
                        : status === 'error'
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                  }
                >
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by request ID or IP..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              {/* Action Filter */}
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Resource Filter */}
              <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {resources.map((resource) => (
                    <SelectItem key={resource} value={resource}>
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>User ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-red-500">
                      Error loading audit logs: {error instanceof Error ? error.message : 'Unknown error'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-gray-500">No audit logs found</div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <Fragment key={log.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRowExpansion(log.id)}
                    >
                      <TableCell>
                        {expandedRow === log.id ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium">
                              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm font-medium capitalize">
                            {formatAction(log.action)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {getActionCategory(log.action)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {log.resource}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {log.ip_address || 'N/A'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-600 font-mono truncate max-w-[150px]">
                          {log.user_id || 'System'}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRow === log.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Log ID</p>
                                <p className="text-sm font-mono">{log.id}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Request ID</p>
                                <p className="text-sm font-mono">{log.request_id || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Resource ID</p>
                                <p className="text-sm font-mono">{log.resource_id || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Tenant ID</p>
                                <p className="text-sm font-mono">{log.tenant_id || 'System'}</p>
                              </div>
                            </div>

                            {log.user_agent && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase mb-1">User Agent</p>
                                <p className="text-xs text-muted-foreground bg-background p-2 rounded border break-all">
                                  {log.user_agent}
                                </p>
                              </div>
                            )}

                            {log.details && Object.keys(log.details).length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Details</p>
                                <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, total)} of {total.toLocaleString()} logs
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Clear All Logs Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Clear All Audit Logs
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all audit log records from the database.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Only available in DEV_MODE. A meta audit log entry will be created to record the clear action.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              disabled={clearLogsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
            >
              {clearLogsMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Clearing...</>
              ) : (
                'Yes, Clear All Logs'
              )}
            </Button>
          </DialogFooter>
          {clearLogsMutation.isError && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {clearLogsMutation.error instanceof Error
                  ? clearLogsMutation.error.message
                  : 'Failed to clear audit logs'}
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive Old Logs Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Archive Old Audit Logs
            </DialogTitle>
            <DialogDescription>
              Export audit logs to a JSON file, then remove them from the database.
              Archived files can be downloaded from the &quot;View Archives&quot; panel.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <label className="text-sm font-medium">Delete logs older than</label>
                <Select
                  value={archiveDays.toString()}
                  onValueChange={(v) => setArchiveDays(parseInt(v))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All logs (archive everything)</SelectItem>
                    <SelectItem value="1">1 day ago</SelectItem>
                    <SelectItem value="7">7 days ago</SelectItem>
                    <SelectItem value="14">14 days ago</SelectItem>
                    <SelectItem value="30">30 days ago</SelectItem>
                    <SelectItem value="60">60 days ago</SelectItem>
                    <SelectItem value="90">90 days ago</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {archiveDays === 0
                    ? 'Will archive ALL audit logs'
                    : `Will archive logs older than ${format(subDays(new Date(), archiveDays), 'MMM d, yyyy')}`}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(false)}
              disabled={archiveLogsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // If archiveDays is 0, use tomorrow's date to archive all logs
                const cutoff = archiveDays === 0
                  ? new Date(Date.now() + 24 * 60 * 60 * 1000) // tomorrow
                  : subDays(new Date(), archiveDays);
                archiveLogsMutation.mutate(cutoff.toISOString());
              }}
              disabled={archiveLogsMutation.isPending}
            >
              {archiveLogsMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Archiving...</>
              ) : (
                <><Archive className="mr-2 h-4 w-4" />Archive Logs</>
              )}
            </Button>
          </DialogFooter>
          {archiveLogsMutation.isError && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {archiveLogsMutation.error instanceof Error
                  ? archiveLogsMutation.error.message
                  : 'Failed to archive audit logs'}
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
