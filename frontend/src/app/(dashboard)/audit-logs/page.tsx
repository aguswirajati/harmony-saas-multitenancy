'use client';

import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantAuditAPI, AuditLog } from '@/lib/api/audit';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow, format } from 'date-fns';

export default function TenantAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: actions = [] } = useQuery({
    queryKey: ['tenant-audit-actions'],
    queryFn: () => tenantAuditAPI.getActions(),
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['tenant-audit-resources'],
    queryFn: () => tenantAuditAPI.getResources(),
  });

  const { data: stats } = useQuery({
    queryKey: ['tenant-audit-statistics'],
    queryFn: () => tenantAuditAPI.getStatistics(),
    refetchInterval: 60000,
  });

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
    queryKey: ['tenant-audit-logs', params],
    queryFn: () => tenantAuditAPI.getAuditLogs(params),
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
          <Badge variant="outline" className="bg-gray-100 text-gray-800">
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Activity and security event monitoring</p>
        </div>
        <div className="flex items-center gap-2">
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
                  <p className="text-sm text-muted-foreground">Total Logs</p>
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
                  <p className="text-sm text-muted-foreground">Logins (24h)</p>
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
                  <p className="text-sm text-muted-foreground">Failed Logins (24h)</p>
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
                  <p className="text-sm text-muted-foreground">Unique Users</p>
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
                      ? 'bg-green-100 text-green-800 border-green-300'
                      : status === 'failure'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                        : status === 'error'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-gray-100 text-gray-800'
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
                    <div className="text-muted-foreground">No audit logs found</div>
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
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">
                              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-muted-foreground">
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
                          <div className="text-xs text-muted-foreground">
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
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                          {log.user_id || 'System'}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRow === log.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">Log ID</p>
                                <p className="text-sm font-mono">{log.id}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">Request ID</p>
                                <p className="text-sm font-mono">{log.request_id || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">Resource ID</p>
                                <p className="text-sm font-mono">{log.resource_id || 'N/A'}</p>
                              </div>
                            </div>

                            {log.user_agent && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">User Agent</p>
                                <p className="text-xs text-muted-foreground bg-background p-2 rounded border break-all">
                                  {log.user_agent}
                                </p>
                              </div>
                            )}

                            {log.details && Object.keys(log.details).length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Details</p>
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
            <div className="text-sm text-muted-foreground">
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
                <span className="text-sm text-muted-foreground">
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
    </div>
  );
}
