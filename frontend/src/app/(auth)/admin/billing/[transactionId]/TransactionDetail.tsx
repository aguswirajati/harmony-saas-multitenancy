'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminBillingAPI } from '@/lib/api/admin-billing';
import { filesAPI } from '@/lib/api/files';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
  ArrowLeft,
  Check,
  X,
  Ticket,
  DollarSign,
  Gift,
  MessageSquare,
  ExternalLink,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Image as ImageIcon,
  Printer,
  Download,
} from 'lucide-react';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import type { BillingTransactionDetail } from '@/types/payment';
import { toast } from 'sonner';

interface TransactionDetailProps {
  transactionId: string;
}

export default function TransactionDetail({ transactionId }: TransactionDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showProofPreview, setShowProofPreview] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  // Payment proof state
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [paymentProofLoading, setPaymentProofLoading] = useState(false);

  // Invoice ref for printing
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Form states
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [discountDescription, setDiscountDescription] = useState('');
  const [bonusDays, setBonusDays] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [adminNote, setAdminNote] = useState('');

  // Fetch transaction detail
  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ['admin-transaction', transactionId],
    queryFn: () => adminBillingAPI.getTransaction(transactionId),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (data: { notes?: string }) =>
      adminBillingAPI.approveTransaction(transactionId, data),
    onSuccess: () => {
      toast.success('Transaction approved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-transaction', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-billing-stats'] });
      setShowApproveDialog(false);
      setApproveNotes('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve transaction');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { rejection_reason: string }) =>
      adminBillingAPI.rejectTransaction(transactionId, data),
    onSuccess: () => {
      toast.success('Transaction rejected');
      queryClient.invalidateQueries({ queryKey: ['admin-transaction', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-billing-stats'] });
      setShowRejectDialog(false);
      setRejectReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject transaction');
    },
  });

  const couponMutation = useMutation({
    mutationFn: (data: { coupon_code: string }) =>
      adminBillingAPI.applyCoupon(transactionId, data),
    onSuccess: () => {
      toast.success('Coupon applied successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-transaction', transactionId] });
      setShowCouponDialog(false);
      setCouponCode('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to apply coupon');
    },
  });

  const discountMutation = useMutation({
    mutationFn: (data: { discount_type: 'percentage' | 'fixed'; discount_value: number; description?: string }) =>
      adminBillingAPI.applyDiscount(transactionId, data),
    onSuccess: () => {
      toast.success('Discount applied successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-transaction', transactionId] });
      setShowDiscountDialog(false);
      setDiscountType('percentage');
      setDiscountValue('');
      setDiscountDescription('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to apply discount');
    },
  });

  const bonusMutation = useMutation({
    mutationFn: (data: { bonus_days: number; reason?: string }) =>
      adminBillingAPI.addBonus(transactionId, data),
    onSuccess: () => {
      toast.success('Bonus days added successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-transaction', transactionId] });
      setShowBonusDialog(false);
      setBonusDays('');
      setBonusReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add bonus days');
    },
  });

  const noteMutation = useMutation({
    mutationFn: (data: { notes: string }) =>
      adminBillingAPI.addNote(transactionId, data),
    onSuccess: () => {
      toast.success('Note added successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-transaction', transactionId] });
      setShowNoteDialog(false);
      setAdminNote('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add note');
    },
  });

  // Fetch payment proof URL
  const fetchPaymentProofUrl = async (fileId: string) => {
    setPaymentProofLoading(true);
    try {
      const response = await filesAPI.adminGetDownloadUrl(fileId, true);
      setPaymentProofUrl(response.download_url);
    } catch (error) {
      toast.error('Failed to load payment proof');
      setPaymentProofUrl(null);
    } finally {
      setPaymentProofLoading(false);
    }
  };

  // Handle opening payment proof preview
  const handleOpenProofPreview = () => {
    if (transaction?.payment_proof_file_id && !paymentProofUrl) {
      fetchPaymentProofUrl(transaction.payment_proof_file_id);
    }
    setShowProofPreview(true);
  };

  // Print invoice
  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${transaction?.transaction_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { font-size: 24px; margin-bottom: 5px; }
            .header p { color: #666; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .info-section h3 { font-size: 14px; color: #666; margin-bottom: 10px; text-transform: uppercase; }
            .info-section p { margin-bottom: 5px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .items-table th { background: #f5f5f5; font-weight: 600; }
            .items-table .amount { text-align: right; }
            .totals { margin-left: auto; width: 300px; }
            .totals .row { display: flex; justify-content: space-between; padding: 8px 0; }
            .totals .row.total { border-top: 2px solid #333; font-weight: bold; font-size: 18px; margin-top: 10px; padding-top: 15px; }
            .totals .discount { color: #16a34a; }
            .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
            .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 500; }
            .status.paid { background: #dcfce7; color: #166534; }
            .status.pending { background: #fef9c3; color: #854d0e; }
            .status.cancelled { background: #fee2e2; color: #991b1b; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Helpers
  const formatCurrency = (amount: number, currency = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      pending: { variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
      paid: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
      cancelled: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
      rejected: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    };
    const config = variants[status] || { variant: 'outline' as const, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      subscription: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      upgrade: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      downgrade: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      renewal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      credit_adjustment: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      extension: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      promo: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      refund: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      manual: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };
    return (
      <Badge className={colors[type] || 'bg-gray-100 text-gray-800'}>
        {type.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Transaction not found</h2>
        <p className="text-muted-foreground mb-4">
          The transaction you're looking for doesn't exist or you don't have access.
        </p>
        <Button onClick={() => router.push('/admin/billing')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Transactions
        </Button>
      </div>
    );
  }

  const tx = transaction;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/billing')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono">{tx.transaction_number}</h1>
              {getStatusBadge(tx.status)}
              {tx.requires_review && (
                <Badge variant="outline" className="border-orange-500 text-orange-600">
                  Needs Review
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Created {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        {tx.can_approve && (
          <div className="flex gap-2">
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setShowApproveDialog(true)}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectDialog(true)}
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transaction Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <div className="mt-1">{getTypeBadge(tx.transaction_type)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Billing Period</Label>
                  <p className="font-medium capitalize">{tx.billing_period}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Invoice Date</Label>
                  <p className="font-medium">
                    {tx.invoice_date ? format(new Date(tx.invoice_date), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  <p className="font-medium">{tx.payment_method_name || '-'}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Subscription Period</Label>
                <p className="font-medium">
                  {tx.period_start && tx.period_end ? (
                    <>
                      {format(new Date(tx.period_start), 'MMM d, yyyy')} - {format(new Date(tx.period_end), 'MMM d, yyyy')}
                    </>
                  ) : (
                    <span className="text-muted-foreground italic">Not set (will be set when approved)</span>
                  )}
                </p>
              </div>

              {tx.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{tx.description}</p>
                </div>
              )}

              <Separator />

              {/* Pricing Breakdown */}
              <div>
                <Label className="text-muted-foreground mb-2 block">Pricing Breakdown</Label>
                <div className="space-y-2 bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between">
                    <span>Original Amount</span>
                    <span className="font-medium">{formatCurrency(tx.original_amount, tx.currency)}</span>
                  </div>
                  {tx.credit_applied > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Credit Applied</span>
                      <span>-{formatCurrency(tx.credit_applied, tx.currency)}</span>
                    </div>
                  )}
                  {tx.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>
                        Discount
                        {tx.coupon_code && <span className="text-xs ml-1">({tx.coupon_code})</span>}
                      </span>
                      <span>-{formatCurrency(tx.discount_amount, tx.currency)}</span>
                    </div>
                  )}
                  {tx.discount_description && (
                    <p className="text-xs text-muted-foreground pl-2">{tx.discount_description}</p>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Final Amount</span>
                    <span>{formatCurrency(tx.amount, tx.currency)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Subscription Duration Breakdown */}
              <div>
                <Label className="text-muted-foreground mb-2 block">Subscription Duration</Label>
                <div className="space-y-2 bg-muted/50 rounded-lg p-4">
                  {(() => {
                    const periodDays = tx.billing_period === 'yearly' ? 365 : 30;
                    const bonusDays = tx.bonus_days || 0;
                    const totalDays = periodDays + bonusDays;
                    const startDate = tx.period_start ? new Date(tx.period_start) : new Date();
                    const endDate = tx.period_end
                      ? new Date(tx.period_end)
                      : addDays(startDate, totalDays);

                    return (
                      <>
                        <div className="flex justify-between">
                          <span>Subscription Period</span>
                          <span className="font-medium">
                            {periodDays} days ({tx.billing_period})
                          </span>
                        </div>
                        <div className="flex justify-between text-cyan-600">
                          <span>Bonus Days</span>
                          <span className="font-medium">+{bonusDays} days</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total Duration</span>
                          <span>{totalDays} days</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-dashed">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {tx.status === 'pending' ? 'Estimated Start' : 'Start Date'}
                            </span>
                            <span className="font-medium">
                              {tx.status === 'pending' && !tx.period_start
                                ? 'Upon approval'
                                : format(startDate, 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">
                              {tx.status === 'pending' ? 'Estimated End' : 'End Date'}
                            </span>
                            <span className="font-medium">
                              {format(endDate, 'MMM d, yyyy')}
                              {tx.status === 'pending' && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (if approved today)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tenant Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Tenant Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Organization</Label>
                  <p className="font-medium">{tx.tenant_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Subdomain</Label>
                  <p className="font-medium">{tx.tenant_subdomain || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade Request Info */}
          {tx.upgrade_request_id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Linked Upgrade Request
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Request Number</Label>
                    <p className="font-mono font-medium">{tx.request_number || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Request Status</Label>
                    <p className="font-medium capitalize">{tx.request_status?.replace('_', ' ') || '-'}</p>
                  </div>
                </div>

                {tx.has_payment_proof && (
                  <div>
                    <Label className="text-muted-foreground">Payment Proof</Label>
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        onClick={handleOpenProofPreview}
                        className="gap-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        View Payment Proof
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Admin Notes */}
          {tx.admin_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Admin Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">{tx.admin_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Rejection Info */}
          {tx.status === 'rejected' && tx.rejection_reason && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  Rejection Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="whitespace-pre-wrap">{tx.rejection_reason}</p>
                {tx.rejected_by_name && (
                  <p className="text-sm text-muted-foreground">
                    Rejected by {tx.rejected_by_name} on {tx.rejected_at && format(new Date(tx.rejected_at), 'MMM d, yyyy HH:mm')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Manage this transaction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tx.can_approve && (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => setShowApproveDialog(true)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve Transaction
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowRejectDialog(true)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject Transaction
                  </Button>
                  <Separator />
                </>
              )}

              {tx.status === 'pending' && !tx.coupon_id && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCouponDialog(true)}
                >
                  <Ticket className="h-4 w-4 mr-2" />
                  Apply Coupon
                </Button>
              )}

              {tx.status === 'pending' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowDiscountDialog(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Add Discount
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowBonusDialog(true)}
              >
                <Gift className="h-4 w-4 mr-2" />
                Add Bonus Days
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNoteDialog(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Note
              </Button>

              <Separator />

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowInvoiceDialog(true)}
              >
                <Printer className="h-4 w-4 mr-2" />
                View Invoice
              </Button>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <div className="w-0.5 h-full bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">Transaction Created</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>

                {tx.adjusted_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <div className="w-0.5 h-full bg-border" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">Adjusted</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.adjusted_at), 'MMM d, yyyy HH:mm')}
                        {tx.adjusted_by_name && ` by ${tx.adjusted_by_name}`}
                      </p>
                    </div>
                  </div>
                )}

                {tx.paid_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Paid</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.paid_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                )}

                {tx.rejected_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Rejected</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.rejected_at), 'MMM d, yyyy HH:mm')}
                        {tx.rejected_by_name && ` by ${tx.rejected_by_name}`}
                      </p>
                    </div>
                  </div>
                )}

                {tx.cancelled_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 bg-gray-500 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Cancelled</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.cancelled_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the transaction as paid and apply any associated changes (tier upgrade, bonus days, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="approve-notes">Notes (optional)</Label>
            <Textarea
              id="approve-notes"
              placeholder="Add any notes about this approval..."
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => approveMutation.mutate({ notes: approveNotes || undefined })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject the transaction and notify the tenant. Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Reason *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Explain why this transaction is being rejected..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => rejectMutation.mutate({ rejection_reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Coupon Dialog */}
      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Coupon</DialogTitle>
            <DialogDescription>
              Enter a coupon code to apply a discount to this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="coupon-code">Coupon Code</Label>
            <Input
              id="coupon-code"
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCouponDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => couponMutation.mutate({ coupon_code: couponCode })}
              disabled={!couponCode.trim() || couponMutation.isPending}
            >
              {couponMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Discount</DialogTitle>
            <DialogDescription>
              Apply a manual discount to this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Discount Type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percentage' | 'fixed')}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="discount-value">
                {discountType === 'percentage' ? 'Percentage' : 'Amount'}
              </Label>
              <Input
                id="discount-value"
                type="number"
                placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 50000'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="discount-description">Description (optional)</Label>
              <Input
                id="discount-description"
                placeholder="e.g., Loyalty discount"
                value={discountDescription}
                onChange={(e) => setDiscountDescription(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscountDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => discountMutation.mutate({
                discount_type: discountType,
                discount_value: parseFloat(discountValue),
                description: discountDescription || undefined,
              })}
              disabled={!discountValue || discountMutation.isPending}
            >
              {discountMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bonus Dialog */}
      <Dialog open={showBonusDialog} onOpenChange={setShowBonusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bonus Days</DialogTitle>
            <DialogDescription>
              Add bonus subscription days to this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="bonus-days">Number of Days</Label>
              <Input
                id="bonus-days"
                type="number"
                placeholder="e.g., 7"
                value={bonusDays}
                onChange={(e) => setBonusDays(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="bonus-reason">Reason (optional)</Label>
              <Input
                id="bonus-reason"
                placeholder="e.g., Compensation for downtime"
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBonusDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => bonusMutation.mutate({
                bonus_days: parseInt(bonusDays),
                reason: bonusReason || undefined,
              })}
              disabled={!bonusDays || bonusMutation.isPending}
            >
              {bonusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Bonus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add an admin note to this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="admin-note">Note</Label>
            <Textarea
              id="admin-note"
              placeholder="Enter your note..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => noteMutation.mutate({ notes: adminNote })}
              disabled={!adminNote.trim() || noteMutation.isPending}
            >
              {noteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Proof Preview Dialog */}
      <Dialog open={showProofPreview} onOpenChange={setShowProofPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
            <DialogDescription>
              Uploaded payment proof for this transaction
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {paymentProofLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Loading payment proof...</p>
              </div>
            ) : paymentProofUrl ? (
              <img
                src={paymentProofUrl}
                alt="Payment Proof"
                className="w-full rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-4" />
                <p>Payment proof image not available</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProofPreview(false)}>
              Close
            </Button>
            {paymentProofUrl && (
              <Button asChild>
                <a href={paymentProofUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice</DialogTitle>
            <DialogDescription>
              Transaction invoice for {tx.transaction_number}
            </DialogDescription>
          </DialogHeader>

          {/* Printable Invoice Content */}
          <div ref={invoiceRef} className="py-4">
            <div className="header">
              <h1>INVOICE</h1>
              <p>Transaction #{tx.transaction_number}</p>
            </div>

            <div className="info-grid">
              <div className="info-section">
                <h3>Bill To</h3>
                <p><strong>{tx.tenant_name}</strong></p>
                {tx.tenant_subdomain && <p>{tx.tenant_subdomain}</p>}
              </div>
              <div className="info-section" style={{ textAlign: 'right' }}>
                <h3>Invoice Details</h3>
                <p>Date: {format(new Date(tx.invoice_date), 'MMMM d, yyyy')}</p>
                <p>Status: <span className={`status ${tx.status}`}>{tx.status.toUpperCase()}</span></p>
                {tx.paid_at && <p>Paid: {format(new Date(tx.paid_at), 'MMMM d, yyyy')}</p>}
              </div>
            </div>

            <table className="items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Period</th>
                  <th className="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>{tx.transaction_type.replace('_', ' ').charAt(0).toUpperCase() + tx.transaction_type.replace('_', ' ').slice(1)}</strong>
                    {tx.description && <br />}
                    {tx.description && <span style={{ color: '#666', fontSize: '14px' }}>{tx.description}</span>}
                  </td>
                  <td>
                    {tx.period_start && tx.period_end ? (
                      <>
                        {format(new Date(tx.period_start), 'MMM d, yyyy')} -<br />
                        {format(new Date(tx.period_end), 'MMM d, yyyy')}
                      </>
                    ) : (
                      <span style={{ textTransform: 'capitalize' }}>{tx.billing_period}</span>
                    )}
                  </td>
                  <td className="amount">{formatCurrency(tx.original_amount, tx.currency)}</td>
                </tr>
              </tbody>
            </table>

            <div className="totals">
              <div className="row">
                <span>Subtotal</span>
                <span>{formatCurrency(tx.original_amount, tx.currency)}</span>
              </div>
              {tx.credit_applied > 0 && (
                <div className="row discount">
                  <span>Credit Applied</span>
                  <span>-{formatCurrency(tx.credit_applied, tx.currency)}</span>
                </div>
              )}
              {tx.discount_amount > 0 && (
                <div className="row discount">
                  <span>Discount {tx.coupon_code && `(${tx.coupon_code})`}</span>
                  <span>-{formatCurrency(tx.discount_amount, tx.currency)}</span>
                </div>
              )}
              <div className="row total">
                <span>Total</span>
                <span>{formatCurrency(tx.amount, tx.currency)}</span>
              </div>
            </div>

            {/* Subscription Duration Breakdown */}
            {(() => {
              const periodDays = tx.billing_period === 'yearly' ? 365 : 30;
              const bonusDays = tx.bonus_days || 0;
              const totalDays = periodDays + bonusDays;
              const startDate = tx.period_start ? new Date(tx.period_start) : new Date();
              const endDate = tx.period_end ? new Date(tx.period_end) : addDays(startDate, totalDays);

              return (
                <div style={{ marginTop: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '10px', textTransform: 'uppercase', color: '#666' }}>Subscription Duration</h3>
                  <table style={{ width: '100%', fontSize: '14px' }}>
                    <tbody>
                      <tr>
                        <td>Subscription Period</td>
                        <td style={{ textAlign: 'right' }}>{periodDays} days ({tx.billing_period})</td>
                      </tr>
                      <tr style={{ color: '#0891b2' }}>
                        <td>Bonus Days</td>
                        <td style={{ textAlign: 'right' }}>+{bonusDays} days</td>
                      </tr>
                      <tr style={{ fontWeight: 'bold', borderTop: '1px solid #ddd' }}>
                        <td style={{ paddingTop: '8px' }}>Total Duration</td>
                        <td style={{ textAlign: 'right', paddingTop: '8px' }}>{totalDays} days</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px dashed #ccc' }}>
                    <p style={{ marginBottom: '5px' }}>
                      <strong>{tx.status === 'pending' ? 'Est. Start:' : 'Start:'}</strong>{' '}
                      {tx.status === 'pending' && !tx.period_start ? 'Upon approval' : format(startDate, 'MMMM d, yyyy')}
                    </p>
                    <p>
                      <strong>{tx.status === 'pending' ? 'Est. End:' : 'End:'}</strong>{' '}
                      {format(endDate, 'MMMM d, yyyy')}
                      {tx.status === 'pending' && <span style={{ fontSize: '12px', color: '#666' }}> (if approved today)</span>}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="footer">
              <p>Thank you for your business!</p>
              <p style={{ marginTop: '10px' }}>Generated on {format(new Date(), 'MMMM d, yyyy HH:mm')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>
              Close
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
