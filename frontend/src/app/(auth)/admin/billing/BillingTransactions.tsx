'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { adminBillingAPI } from '@/lib/api/admin-billing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  Clock,
  TrendingUp,
  CreditCard,
  Search,
  Filter,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type {
  BillingTransactionDetail,
  TransactionStatus,
  TransactionType,
} from '@/types/payment';

function formatCurrency(amount: number, currency: string = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(status: TransactionStatus) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Paid</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pending</Badge>;
    case 'cancelled':
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Cancelled</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Rejected</Badge>;
    case 'refunded':
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getTypeBadge(type: TransactionType) {
  switch (type) {
    case 'upgrade':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700">
          <ArrowUpRight className="h-3 w-3 mr-1" />
          Upgrade
        </Badge>
      );
    case 'downgrade':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700">
          <ArrowDownRight className="h-3 w-3 mr-1" />
          Downgrade
        </Badge>
      );
    case 'subscription':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">
          <CreditCard className="h-3 w-3 mr-1" />
          Subscription
        </Badge>
      );
    case 'renewal':
      return (
        <Badge variant="outline" className="text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700">
          <RefreshCw className="h-3 w-3 mr-1" />
          Renewal
        </Badge>
      );
    case 'credit_adjustment':
      return (
        <Badge variant="outline" className="text-cyan-600 border-cyan-300 dark:text-cyan-400 dark:border-cyan-700">
          Credit Adj.
        </Badge>
      );
    case 'extension':
      return (
        <Badge variant="outline" className="text-indigo-600 border-indigo-300 dark:text-indigo-400 dark:border-indigo-700">
          Extension
        </Badge>
      );
    case 'promo':
      return (
        <Badge variant="outline" className="text-pink-600 border-pink-300 dark:text-pink-400 dark:border-pink-700">
          Promo
        </Badge>
      );
    case 'refund':
      return (
        <Badge variant="outline" className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-700">
          Refund
        </Badge>
      );
    case 'manual':
      return (
        <Badge variant="outline" className="text-gray-600 border-gray-300 dark:text-gray-400 dark:border-gray-700">
          Manual
        </Badge>
      );
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export default function BillingTransactions() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNeedsReview, setShowNeedsReview] = useState(false);

  // Fetch billing stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-billing-stats'],
    queryFn: () => adminBillingAPI.getStats(),
  });

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading, refetch } = useQuery({
    queryKey: ['admin-transactions', page, statusFilter, typeFilter, showNeedsReview],
    queryFn: () =>
      adminBillingAPI.listTransactions({
        page,
        page_size: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        transaction_type: typeFilter !== 'all' ? typeFilter : undefined,
        requires_review: showNeedsReview ? true : undefined,
      }),
  });

  // Filter transactions by search
  const filteredTransactions = transactionsData?.items?.filter((tx) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.transaction_number?.toLowerCase().includes(query) ||
      tx.tenant_name?.toLowerCase().includes(query) ||
      tx.tenant_subdomain?.toLowerCase().includes(query) ||
      tx.description?.toLowerCase().includes(query)
    );
  }) || [];

  const handleRowClick = (transactionId: string) => {
    router.push(`/admin/billing/${transactionId}`);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats?.total_revenue || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats?.total_revenue_this_month || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats?.pending_amount || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{stats?.transaction_count || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Total count</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            showNeedsReview
              ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950/20'
              : 'hover:bg-muted/50'
          }`}
          onClick={() => {
            setShowNeedsReview(!showNeedsReview);
            setPage(1);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertCircle className={`h-4 w-4 ${(stats?.requires_review_count || 0) > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className={`text-2xl font-bold ${(stats?.requires_review_count || 0) > 0 ? 'text-orange-600' : ''}`}>
                {stats?.requires_review_count || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {showNeedsReview ? 'Click to show all' : 'Click to filter'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                {showNeedsReview
                  ? 'Showing transactions that need review'
                  : 'Manage billing transactions'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by transaction number, tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="upgrade">Upgrade</SelectItem>
                  <SelectItem value="downgrade">Downgrade</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="credit_adjustment">Credit Adj.</SelectItem>
                  <SelectItem value="extension">Extension</SelectItem>
                  <SelectItem value="promo">Promo</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {transactionsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No transactions found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : showNeedsReview
                  ? 'No transactions require review'
                  : 'No transactions match the current filters'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className={`cursor-pointer hover:bg-muted/50 ${
                        tx.can_approve ? 'bg-orange-50 dark:bg-orange-950/20' : ''
                      }`}
                      onClick={() => handleRowClick(tx.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm font-medium">{tx.transaction_number}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {tx.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tx.tenant_name || '-'}</p>
                          {tx.tenant_subdomain && (
                            <p className="text-xs text-muted-foreground">{tx.tenant_subdomain}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(tx.transaction_type)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{formatCurrency(tx.amount, tx.currency)}</p>
                          {tx.discount_amount > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              -{formatCurrency(tx.discount_amount)} discount
                            </p>
                          )}
                          {tx.bonus_days > 0 && (
                            <p className="text-xs text-cyan-600 dark:text-cyan-400">
                              +{tx.bonus_days} bonus days
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(tx.status)}
                          {tx.requires_review && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                              Review
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{format(new Date(tx.created_at), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {tx.can_approve && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowClick(tx.id);
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowClick(tx.id);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(tx.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {transactionsData && transactionsData.total > 20 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(transactionsData.total / 20)} ({transactionsData.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(transactionsData.total / 20)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
