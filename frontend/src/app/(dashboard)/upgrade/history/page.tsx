'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { upgradeRequestsAPI } from '@/lib/api/upgrade-requests';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowUpCircle,
  Clock,
  Check,
  X,
  Upload,
  FileImage,
  Plus,
  AlertCircle,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import type { UpgradeRequest } from '@/types/payment';
import { formatCurrency, getStatusColor, getStatusLabel } from '@/types/payment';

export default function UpgradeHistoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequest | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-upgrade-requests'],
    queryFn: () => upgradeRequestsAPI.tenant.list(),
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => upgradeRequestsAPI.tenant.cancel(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-upgrade-requests'] });
      toast.success('Request cancelled');
      setIsCancelDialogOpen(false);
      setIsDetailDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel request');
    },
  });

  const openDetailDialog = (request: UpgradeRequest) => {
    setSelectedRequest(request);
    setIsDetailDialogOpen(true);
  };

  const openCancelDialog = (request: UpgradeRequest) => {
    setSelectedRequest(request);
    setIsCancelDialogOpen(true);
  };

  const requests = data?.items || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5" />;
      case 'payment_uploaded':
      case 'under_review':
        return <FileImage className="h-5 w-5" />;
      case 'approved':
        return <Check className="h-5 w-5" />;
      case 'rejected':
        return <X className="h-5 w-5" />;
      case 'cancelled':
        return <Ban className="h-5 w-5" />;
      case 'expired':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upgrade History</h1>
          <p className="text-muted-foreground">
            Track your subscription upgrade requests
          </p>
        </div>
        <Button onClick={() => router.push('/upgrade')}>
          <Plus className="h-4 w-4 mr-2" />
          New Upgrade
        </Button>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowUpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No upgrade requests yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by upgrading your subscription plan
            </p>
            <Button onClick={() => router.push('/upgrade')}>
              <Plus className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card
              key={request.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetailDialog(request)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-full ${getStatusColor(request.status)}`}
                    >
                      {getStatusIcon(request.status)}
                    </div>
                    <div>
                      <p className="font-mono text-sm text-muted-foreground">
                        {request.request_number}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{request.current_tier_code}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge>{request.target_tier_code}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(request.amount, request.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>

                {/* Action needed indicator */}
                {request.status === 'pending' && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center gap-2">
                    <Upload className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-400">
                      Payment proof required - please upload your transfer receipt
                    </span>
                  </div>
                )}

                {/* Rejection reason */}
                {request.status === 'rejected' && request.rejection_reason && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
                    <X className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">
                        Rejected:
                      </span>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {request.rejection_reason}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              {selectedRequest?.request_number}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-center">
                <Badge className={`${getStatusColor(selectedRequest.status)} px-4 py-2 text-base`}>
                  {getStatusIcon(selectedRequest.status)}
                  <span className="ml-2">{getStatusLabel(selectedRequest.status)}</span>
                </Badge>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-muted-foreground">From</Label>
                  <p className="font-medium">{selectedRequest.current_tier_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">To</Label>
                  <p className="font-medium">{selectedRequest.target_tier_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Billing</Label>
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
                  <p className="font-medium">{selectedRequest.payment_method_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="font-medium">
                    {format(new Date(selectedRequest.created_at), 'PP')}
                  </p>
                </div>
              </div>

              {/* Payment proof status */}
              {selectedRequest.payment_proof_file_id ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Payment proof uploaded
                    </p>
                    {selectedRequest.payment_proof_uploaded_at && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {format(
                          new Date(selectedRequest.payment_proof_uploaded_at),
                          'PPpp'
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ) : selectedRequest.status === 'pending' ? (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">
                      Upload payment proof
                    </p>
                  </div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-3">
                    Please upload your transfer receipt to continue.
                  </p>
                  <Button variant="outline" size="sm" disabled>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Proof (Coming Soon)
                  </Button>
                </div>
              ) : null}

              {/* Expiry warning */}
              {selectedRequest.status === 'pending' && selectedRequest.expires_at && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm text-orange-700 dark:text-orange-400">
                    Expires {formatDistanceToNow(new Date(selectedRequest.expires_at), { addSuffix: true })}
                  </span>
                </div>
              )}

              {/* Rejection reason */}
              {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <Label className="text-red-700 dark:text-red-400">
                    Rejection Reason
                  </Label>
                  <p className="mt-1 text-red-600 dark:text-red-400">
                    {selectedRequest.rejection_reason}
                  </p>
                </div>
              )}

              {/* Approval info */}
              {selectedRequest.status === 'approved' && selectedRequest.applied_at && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Label className="text-green-700 dark:text-green-400">
                    Upgrade Applied
                  </Label>
                  <p className="mt-1 text-green-600 dark:text-green-400">
                    Your plan was upgraded on{' '}
                    {format(new Date(selectedRequest.applied_at), 'PPpp')}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedRequest &&
              (selectedRequest.status === 'pending' ||
                selectedRequest.status === 'payment_uploaded') && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsDetailDialogOpen(false);
                    openCancelDialog(selectedRequest);
                  }}
                >
                  Cancel Request
                </Button>
              )}
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Upgrade Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this upgrade request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRequest && cancelMutation.mutate(selectedRequest.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
