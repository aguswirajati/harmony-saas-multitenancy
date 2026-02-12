'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { upgradeRequestsAPI } from '@/lib/api/upgrade-requests';
import { filesAPI } from '@/lib/api/files';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  Eye,
  Check,
  X,
  FileImage,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import type {
  UpgradeRequest,
  UpgradeRequestSummary,
  UpgradeRequestReview,
} from '@/types/payment';
import {
  formatCurrency,
  getStatusColor,
  getStatusLabel,
} from '@/types/payment';

export default function UpgradeRequestsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequest | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [isLoadingProof, setIsLoadingProof] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showProofPreview, setShowProofPreview] = useState(false);

  const params = {
    skip: (page - 1) * pageSize,
    limit: pageSize,
    ...(statusFilter !== 'all' && { status: statusFilter }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-upgrade-requests', params],
    queryFn: () => upgradeRequestsAPI.admin.list(params),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-upgrade-stats'],
    queryFn: () => upgradeRequestsAPI.admin.getStats(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpgradeRequestReview }) =>
      upgradeRequestsAPI.admin.review(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-upgrade-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-upgrade-stats'] });
      toast.success(
        variables.data.action === 'approve'
          ? 'Upgrade request approved'
          : 'Upgrade request rejected'
      );
      setIsReviewDialogOpen(false);
      setSelectedRequest(null);
      resetReviewForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to review request');
    },
  });

  const resetReviewForm = () => {
    setReviewAction('approve');
    setReviewNotes('');
    setRejectionReason('');
  };

  const openReviewDialog = async (summary: UpgradeRequestSummary) => {
    try {
      const request = await upgradeRequestsAPI.admin.get(summary.id);
      setSelectedRequest(request);
      setPaymentProofUrl(null);
      resetReviewForm();
      setIsReviewDialogOpen(true);

      // Fetch payment proof URL if available (inline=true to view in browser)
      if (request.payment_proof_file_id) {
        setIsLoadingProof(true);
        try {
          const downloadResponse = await filesAPI.adminGetDownloadUrl(request.payment_proof_file_id, true);
          setPaymentProofUrl(downloadResponse.download_url);
        } catch {
          console.error('Failed to load payment proof');
        } finally {
          setIsLoadingProof(false);
        }
      }
    } catch {
      toast.error('Failed to load request details');
    }
  };

  const handleReview = () => {
    if (!selectedRequest) return;

    const reviewData: UpgradeRequestReview = {
      action: reviewAction,
      notes: reviewNotes || undefined,
      rejection_reason: reviewAction === 'reject' ? rejectionReason : undefined,
    };

    reviewMutation.mutate({ id: selectedRequest.id, data: reviewData });
  };

  const requests = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Upgrade Requests
          </h1>
          <p className="text-muted-foreground">
            Review and approve subscription upgrades
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Awaiting Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">
                  {stats.payment_uploaded_count}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">
                  {stats.approved_this_month}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rejected This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <X className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold">
                  {stats.rejected_this_month}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenue This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">
                  {formatCurrency(stats.total_revenue_this_month, stats.currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="payment_uploaded">Payment Uploaded</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="px-3 py-1">
              Total: {total}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request #</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Upgrade</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Proof</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ArrowUpCircle className="h-8 w-8" />
                      <p>No upgrade requests found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">
                      {request.request_number}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{request.tenant_name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{request.current_tier_code}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge>{request.target_tier_code}</Badge>
                        <span className="text-xs text-muted-foreground">
                          ({request.billing_period})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(request.amount, request.currency)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getStatusColor(request.status)}>
                        {getStatusLabel(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {request.has_payment_proof ? (
                        <FileImage className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openReviewDialog(request)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {request.status === 'payment_uploaded' ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, total)} of {total} requests
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Upgrade Request</DialogTitle>
            <DialogDescription>
              Request #{selectedRequest?.request_number}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-muted-foreground">Current Tier</Label>
                  <p className="font-medium">{selectedRequest.current_tier_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Target Tier</Label>
                  <p className="font-medium">{selectedRequest.target_tier_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Billing Period</Label>
                  <p className="font-medium capitalize">{selectedRequest.billing_period}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-medium">
                    {formatCurrency(selectedRequest.amount, selectedRequest.currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  <p className="font-medium">
                    {selectedRequest.payment_method_name || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Requested By</Label>
                  <p className="font-medium">
                    {selectedRequest.requested_by_name || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="font-medium">
                    {format(new Date(selectedRequest.created_at), 'PPpp')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedRequest.status)}>
                    {getStatusLabel(selectedRequest.status)}
                  </Badge>
                </div>
              </div>

              {/* Payment Proof */}
              {selectedRequest.payment_proof_file_id && (
                <div className="p-4 border rounded-lg">
                  <Label className="text-muted-foreground mb-2 block">
                    Payment Proof
                  </Label>
                  {isLoadingProof ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Loading payment proof...</span>
                    </div>
                  ) : paymentProofUrl ? (
                    <div
                      onClick={() => setShowProofPreview(true)}
                      className="cursor-pointer"
                    >
                      <img
                        src={paymentProofUrl}
                        alt="Payment Proof"
                        className="max-h-64 rounded-lg hover:opacity-90 transition-opacity"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Click to view full size</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileImage className="h-5 w-5" />
                      <span>Payment proof uploaded (preview unavailable)</span>
                    </div>
                  )}
                  {selectedRequest.payment_proof_uploaded_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Uploaded{' '}
                      {format(
                        new Date(selectedRequest.payment_proof_uploaded_at),
                        'PPpp'
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Review Form - Only show for reviewable requests */}
              {selectedRequest.status === 'payment_uploaded' && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex gap-4">
                    <Button
                      variant={reviewAction === 'approve' ? 'default' : 'outline'}
                      className={reviewAction === 'approve' ? 'bg-green-600' : ''}
                      onClick={() => setReviewAction('approve')}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant={reviewAction === 'reject' ? 'default' : 'outline'}
                      className={reviewAction === 'reject' ? 'bg-red-600' : ''}
                      onClick={() => setReviewAction('reject')}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review_notes">Internal Notes (optional)</Label>
                    <Textarea
                      id="review_notes"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Notes for internal reference..."
                      rows={2}
                    />
                  </div>

                  {reviewAction === 'reject' && (
                    <div className="space-y-2">
                      <Label htmlFor="rejection_reason">
                        Rejection Reason (shown to tenant)
                      </Label>
                      <Textarea
                        id="rejection_reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        rows={2}
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Show rejection reason if already rejected */}
              {selectedRequest.status === 'rejected' &&
                selectedRequest.rejection_reason && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <Label className="text-red-700 dark:text-red-400">
                      Rejection Reason
                    </Label>
                    <p className="mt-1">{selectedRequest.rejection_reason}</p>
                  </div>
                )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReviewDialogOpen(false)}
            >
              Close
            </Button>
            {selectedRequest?.status === 'payment_uploaded' && (
              <Button
                onClick={handleReview}
                disabled={
                  reviewMutation.isPending ||
                  (reviewAction === 'reject' && !rejectionReason)
                }
                className={
                  reviewAction === 'approve' ? 'bg-green-600' : 'bg-red-600'
                }
              >
                {reviewMutation.isPending
                  ? 'Processing...'
                  : reviewAction === 'approve'
                  ? 'Approve Request'
                  : 'Reject Request'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Proof Full Size Preview */}
      <Dialog open={showProofPreview} onOpenChange={setShowProofPreview}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-2 flex items-center justify-center" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Payment Proof Preview</DialogTitle>
          {paymentProofUrl && (
            <img
              src={paymentProofUrl}
              alt="Payment Proof"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
