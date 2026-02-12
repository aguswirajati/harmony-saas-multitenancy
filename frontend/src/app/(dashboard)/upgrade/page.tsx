'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionTiersAPI } from '@/lib/api/subscription-tiers';
import { paymentMethodsAPI } from '@/lib/api/payment-methods';
import { upgradeRequestsAPI } from '@/lib/api/upgrade-requests';
import { uploadFile, filesAPI } from '@/lib/api/files';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Star,
  Building2,
  QrCode,
  Wallet,
  ArrowRight,
  Sparkles,
  Clock,
  Upload,
  FileImage,
  AlertCircle,
  Pencil,
  Trash2,
  FileText,
  Loader2,
  Printer,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/authStore';
import type {
  PublicTier,
  PublicPaymentMethod,
  BillingPeriod,
  UpgradeRequest,
  InvoiceData,
} from '@/types/payment';
import { formatCurrency, getStatusColor, getStatusLabel } from '@/types/payment';
import { formatDistanceToNow, format } from 'date-fns';

type Step = 'tier' | 'billing' | 'payment' | 'confirm';
type Mode = 'create' | 'edit';

export default function UpgradePage() {
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [mode, setMode] = useState<Mode>('create');
  const [step, setStep] = useState<Step>('tier');
  const [selectedTier, setSelectedTier] = useState<PublicTier | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PublicPaymentMethod | null>(null);

  // UI state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [isLoadingProof, setIsLoadingProof] = useState(false);
  const [showProofPreview, setShowProofPreview] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);

  // Fetch existing requests
  const { data: existingRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['tenant-upgrade-requests'],
    queryFn: () => upgradeRequestsAPI.tenant.list(),
  });

  // Find active request (pending, payment_uploaded, or under_review)
  const activeRequest = existingRequests?.items?.find(
    (r: UpgradeRequest) =>
      r.status === 'pending' || r.status === 'payment_uploaded' || r.status === 'under_review'
  );

  // Fetch tiers
  const { data: tiersData, isLoading: tiersLoading } = useQuery({
    queryKey: ['public-tiers'],
    queryFn: () => subscriptionTiersAPI.public.list(),
    enabled: !activeRequest || mode === 'edit',
  });

  // Fetch payment methods
  const { data: paymentMethods, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['public-payment-methods'],
    queryFn: () => paymentMethodsAPI.public.list(),
    enabled: step === 'payment' || mode === 'edit',
  });

  const tiers = tiersData?.tiers || [];
  const currentTierCode = tenant?.tier || 'free';

  // Filter tiers to only show upgrades
  const availableTiers = tiers.filter(
    (tier) =>
      tier.code !== currentTierCode &&
      tier.price_monthly > (tiers.find((t) => t.code === currentTierCode)?.price_monthly || 0)
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () =>
      upgradeRequestsAPI.tenant.create({
        target_tier_code: selectedTier!.code,
        billing_period: billingPeriod,
        payment_method_id: selectedPaymentMethod!.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-upgrade-requests'] });
      toast.success('Upgrade request created!');
      resetWizard();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create upgrade request');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: () =>
      upgradeRequestsAPI.tenant.update(activeRequest!.id, {
        target_tier_code: selectedTier!.code,
        billing_period: billingPeriod,
        payment_method_id: selectedPaymentMethod!.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-upgrade-requests'] });
      toast.success('Upgrade request updated!');
      setMode('create');
      resetWizard();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update upgrade request');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => upgradeRequestsAPI.tenant.cancel(activeRequest!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-upgrade-requests'] });
      toast.success('Upgrade request cancelled');
      setShowCancelDialog(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel request');
    },
  });

  // Fetch payment proof URL when active request has proof uploaded
  useEffect(() => {
    const fetchPaymentProof = async () => {
      if (activeRequest?.payment_proof_file_id && mode === 'create') {
        setIsLoadingProof(true);
        try {
          // Use inline=true to view in browser instead of download
          const response = await filesAPI.getDownloadUrl(activeRequest.payment_proof_file_id, true);
          setPaymentProofUrl(response.download_url);
        } catch {
          console.error('Failed to load payment proof');
          setPaymentProofUrl(null);
        } finally {
          setIsLoadingProof(false);
        }
      } else {
        setPaymentProofUrl(null);
      }
    };

    fetchPaymentProof();
  }, [activeRequest?.payment_proof_file_id, mode]);

  // Reset wizard state
  const resetWizard = () => {
    setStep('tier');
    setSelectedTier(null);
    setBillingPeriod('monthly');
    setSelectedPaymentMethod(null);
  };

  // Start edit mode
  const startEditMode = () => {
    if (!activeRequest) return;

    // Pre-fill with current request data
    const tier = tiers.find((t) => t.code === activeRequest.target_tier_code);
    if (tier) setSelectedTier(tier);
    setBillingPeriod(activeRequest.billing_period);

    const method = paymentMethods?.find((m) => m.id === activeRequest.payment_method_id);
    if (method) setSelectedPaymentMethod(method);

    setMode('edit');
    setStep('tier');
  };

  // Cancel edit mode
  const cancelEditMode = () => {
    setMode('create');
    resetWizard();
  };

  // Handle file upload for payment proof
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeRequest) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > 10) {
        toast.error('Image must be smaller than 10MB');
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const uploadedFile = await uploadFile(file, 'payment_proof', {
          resourceType: 'upgrade_request',
          resourceId: activeRequest.id,
          onProgress: (progress) => setUploadProgress(progress),
        });

        await upgradeRequestsAPI.tenant.uploadProof(activeRequest.id, uploadedFile.id);
        queryClient.invalidateQueries({ queryKey: ['tenant-upgrade-requests'] });
        toast.success('Payment proof uploaded successfully');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to upload payment proof');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [activeRequest, queryClient]
  );

  // Download invoice
  const handleDownloadInvoice = async () => {
    if (!activeRequest) return;
    setIsLoadingInvoice(true);
    try {
      const invoice = await upgradeRequestsAPI.tenant.getInvoice(activeRequest.id);
      setInvoiceData(invoice);
      setShowInvoiceDialog(true);
    } catch {
      toast.error('Failed to get invoice');
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  // Print invoice
  const handlePrintInvoice = () => {
    if (!invoiceData) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print the invoice');
      return;
    }

    const statusColor = invoiceData.status === 'paid'
      ? '#166534'
      : invoiceData.status === 'cancelled'
      ? '#991b1b'
      : '#854d0e';
    const statusBg = invoiceData.status === 'paid'
      ? '#dcfce7'
      : invoiceData.status === 'cancelled'
      ? '#fee2e2'
      : '#fef9c3';

    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${invoiceData.status === 'paid' ? 'Receipt' : 'Invoice'} - ${invoiceData.transaction_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: bold; }
          .transaction-number { color: #6b7280; font-family: monospace; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${statusBg}; color: ${statusColor}; }
          .date { font-size: 14px; color: #6b7280; margin-top: 8px; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
          .party-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
          .party-name { font-weight: 600; }
          .party-detail { font-size: 14px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
          th { background: #f9fafb; text-align: left; padding: 12px; font-size: 14px; font-weight: 500; }
          th:last-child { text-align: right; }
          td { padding: 12px; border-top: 1px solid #e5e7eb; }
          td:last-child { text-align: right; font-family: monospace; }
          .item-desc { font-weight: 500; }
          .item-billing { font-size: 14px; color: #6b7280; }
          tfoot td { background: #f9fafb; font-weight: 600; }
          tfoot td:last-child { font-weight: bold; }
          .payment-method { margin-top: 16px; font-size: 14px; }
          .payment-method span { color: #6b7280; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${invoiceData.status === 'paid' ? 'RECEIPT' : 'INVOICE'}</div>
            <div class="transaction-number">#${invoiceData.transaction_number}</div>
          </div>
          <div style="text-align: right;">
            <div class="status">${invoiceData.status.toUpperCase()}</div>
            <div class="date">Date: ${new Date(invoiceData.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            ${invoiceData.paid_at ? `<div class="date">Paid: ${new Date(invoiceData.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>` : ''}
          </div>
        </div>

        <div class="parties">
          <div>
            <div class="party-label">From</div>
            <div class="party-name">${invoiceData.seller_name}</div>
            ${invoiceData.seller_address ? `<div class="party-detail">${invoiceData.seller_address.replace(/\n/g, '<br>')}</div>` : ''}
            ${invoiceData.seller_email ? `<div class="party-detail">${invoiceData.seller_email}</div>` : ''}
          </div>
          <div>
            <div class="party-label">Bill To</div>
            <div class="party-name">${invoiceData.buyer_name}</div>
            ${invoiceData.buyer_email ? `<div class="party-detail">${invoiceData.buyer_email}</div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="item-desc">${invoiceData.description}</div>
                <div class="item-billing">Billing: ${invoiceData.billing_period}</div>
              </td>
              <td>${formatCurrency(invoiceData.amount, invoiceData.currency)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>${formatCurrency(invoiceData.amount, invoiceData.currency)}</td>
            </tr>
          </tfoot>
        </table>

        ${invoiceData.payment_method_name ? `
          <div class="payment-method">
            <span>Payment Method:</span> ${invoiceData.payment_method_name}
          </div>
        ` : ''}

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
  };

  const getAmount = () => {
    if (!selectedTier) return 0;
    return billingPeriod === 'yearly' ? selectedTier.price_yearly : selectedTier.price_monthly;
  };

  const getSavings = () => {
    if (!selectedTier || billingPeriod !== 'yearly') return 0;
    return selectedTier.price_monthly * 12 - selectedTier.price_yearly;
  };

  const canProceed = () => {
    switch (step) {
      case 'tier':
        return !!selectedTier;
      case 'billing':
        return true;
      case 'payment':
        return !!selectedPaymentMethod;
      case 'confirm':
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    switch (step) {
      case 'tier':
        setStep('billing');
        break;
      case 'billing':
        setStep('payment');
        break;
      case 'payment':
        setStep('confirm');
        break;
      case 'confirm':
        if (mode === 'edit') {
          updateMutation.mutate();
        } else {
          createMutation.mutate();
        }
        break;
    }
  };

  const prevStep = () => {
    switch (step) {
      case 'billing':
        setStep('tier');
        break;
      case 'payment':
        setStep('billing');
        break;
      case 'confirm':
        setStep('payment');
        break;
    }
  };

  const steps = [
    { key: 'tier', label: 'Select Plan' },
    { key: 'billing', label: 'Billing Period' },
    { key: 'payment', label: 'Payment Method' },
    { key: 'confirm', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  // Loading state
  if (requestsLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // =========================================================================
  // ACTIVE REQUEST VIEW - Show when there's a pending/in-progress request
  // =========================================================================
  if (activeRequest && mode === 'create') {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Upgrade in Progress</h1>
          <p className="text-muted-foreground mt-2">
            You have an active upgrade request
          </p>
        </div>

        {/* Request Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-lg">{activeRequest.request_number}</CardTitle>
              <Badge className={getStatusColor(activeRequest.status)}>
                {getStatusLabel(activeRequest.status)}
              </Badge>
            </div>
            <CardDescription>
              Created {formatDistanceToNow(new Date(activeRequest.created_at), { addSuffix: true })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upgrade Details */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-muted-foreground text-xs">Current Plan</Label>
                <p className="font-medium">{activeRequest.current_tier_name || activeRequest.current_tier_code}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Target Plan</Label>
                <p className="font-medium">{activeRequest.target_tier_name || activeRequest.target_tier_code}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Billing Period</Label>
                <p className="font-medium capitalize">{activeRequest.billing_period}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Amount</Label>
                <p className="font-medium">{formatCurrency(activeRequest.amount, activeRequest.currency)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Payment Method</Label>
                <p className="font-medium">{activeRequest.payment_method_name || '-'}</p>
              </div>
              {activeRequest.expires_at && activeRequest.status === 'pending' && (
                <div>
                  <Label className="text-muted-foreground text-xs">Expires</Label>
                  <p className="font-medium text-orange-600">
                    {formatDistanceToNow(new Date(activeRequest.expires_at), { addSuffix: true })}
                  </p>
                </div>
              )}
            </div>

            {/* Status-specific content */}
            {activeRequest.status === 'pending' && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <p className="font-medium text-yellow-700 dark:text-yellow-400">
                    Upload Payment Proof
                  </p>
                </div>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Complete your payment and upload the receipt to continue.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />

                {isUploading ? (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">
                      Uploading... {uploadProgress}%
                    </p>
                  </div>
                ) : (
                  <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Payment Proof
                  </Button>
                )}
              </div>
            )}

            {activeRequest.status === 'payment_uploaded' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <p className="font-medium text-blue-700 dark:text-blue-400">
                    Payment Proof Uploaded
                  </p>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Your payment is being reviewed. You will be notified once approved.
                </p>
                {/* Payment Proof Preview */}
                {isLoadingProof ? (
                  <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400">
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading proof...</span>
                  </div>
                ) : paymentProofUrl ? (
                  <div
                    onClick={() => setShowProofPreview(true)}
                    className="cursor-pointer"
                  >
                    <img
                      src={paymentProofUrl}
                      alt="Payment Proof"
                      className="max-h-48 rounded-lg hover:opacity-90 transition-opacity border border-blue-200 dark:border-blue-700"
                    />
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">Click to view full size</p>
                  </div>
                ) : null}
                {activeRequest.payment_proof_uploaded_at && (
                  <p className="text-xs text-blue-500 dark:text-blue-400">
                    Uploaded {format(new Date(activeRequest.payment_proof_uploaded_at), 'PPpp')}
                  </p>
                )}
              </div>
            )}

            {activeRequest.status === 'under_review' && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <p className="font-medium text-purple-700 dark:text-purple-400">Under Review</p>
                </div>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Your upgrade request is being reviewed by our team.
                </p>
                {/* Payment Proof Preview */}
                {activeRequest.payment_proof_file_id && (
                  <>
                    {isLoadingProof ? (
                      <div className="flex items-center gap-2 text-purple-500 dark:text-purple-400">
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Loading proof...</span>
                      </div>
                    ) : paymentProofUrl ? (
                      <div>
                        <Label className="text-purple-600 dark:text-purple-400 text-xs mb-2 block">
                          Your Payment Proof
                        </Label>
                        <div
                          onClick={() => setShowProofPreview(true)}
                          className="cursor-pointer"
                        >
                          <img
                            src={paymentProofUrl}
                            alt="Payment Proof"
                            className="max-h-48 rounded-lg hover:opacity-90 transition-opacity border border-purple-200 dark:border-purple-700"
                          />
                          <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">Click to view full size</p>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}

            {/* Expiry Warning */}
            {activeRequest.status === 'pending' && activeRequest.expires_at && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-orange-700 dark:text-orange-400">
                  This request expires{' '}
                  {formatDistanceToNow(new Date(activeRequest.expires_at), { addSuffix: true })}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleDownloadInvoice} disabled={isLoadingInvoice}>
                {isLoadingInvoice ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {activeRequest.status === 'approved' ? 'View Receipt' : 'View Invoice'}
              </Button>

              {activeRequest.status === 'pending' && (
                <>
                  <Button variant="outline" onClick={startEditMode}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Request
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cancel Request
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Proof Preview Dialog */}
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

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
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
                onClick={() => cancelMutation.mutate()}
                className="bg-destructive hover:bg-destructive/90"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Invoice Dialog */}
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="max-w-2xl" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {invoiceData?.status === 'paid' ? 'Receipt' : 'Invoice'}
              </DialogTitle>
            </DialogHeader>

            {invoiceData && (
              <div className="space-y-6" id="invoice-content">
                {/* Invoice Header */}
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {invoiceData.status === 'paid' ? 'RECEIPT' : 'INVOICE'}
                    </h2>
                    <p className="text-muted-foreground font-mono">
                      #{invoiceData.transaction_number}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      className={
                        invoiceData.status === 'paid'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : invoiceData.status === 'cancelled'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }
                    >
                      {invoiceData.status.toUpperCase()}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      Date: {format(new Date(invoiceData.invoice_date), 'PPP')}
                    </p>
                    {invoiceData.paid_at && (
                      <p className="text-sm text-muted-foreground">
                        Paid: {format(new Date(invoiceData.paid_at), 'PPP')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Seller & Buyer Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground text-xs">From</Label>
                    <p className="font-semibold">{invoiceData.seller_name}</p>
                    {invoiceData.seller_address && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {invoiceData.seller_address}
                      </p>
                    )}
                    {invoiceData.seller_email && (
                      <p className="text-sm text-muted-foreground">{invoiceData.seller_email}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Bill To</Label>
                    <p className="font-semibold">{invoiceData.buyer_name}</p>
                    {invoiceData.buyer_email && (
                      <p className="text-sm text-muted-foreground">{invoiceData.buyer_email}</p>
                    )}
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Description</th>
                        <th className="text-right p-3 text-sm font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-3">
                          <p className="font-medium">{invoiceData.description}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            Billing: {invoiceData.billing_period}
                          </p>
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatCurrency(invoiceData.amount, invoiceData.currency)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-muted">
                      <tr className="border-t">
                        <td className="p-3 font-semibold">Total</td>
                        <td className="p-3 text-right font-bold font-mono">
                          {formatCurrency(invoiceData.amount, invoiceData.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Payment Method */}
                {invoiceData.payment_method_name && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Payment Method: </span>
                    <span className="font-medium">{invoiceData.payment_method_name}</span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="print:hidden">
              <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
              <Button onClick={handlePrintInvoice}>
                <Printer className="h-4 w-4 mr-2" />
                Print / Save PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // =========================================================================
  // WIZARD VIEW - Create new or edit existing request
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {mode === 'edit' ? 'Edit Upgrade Request' : 'Upgrade Your Plan'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {mode === 'edit'
            ? 'Modify your upgrade request details'
            : 'Unlock more features and grow your business'}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  i < currentStepIndex
                    ? 'bg-green-500 text-white'
                    : i === currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < currentStepIndex ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`ml-2 text-sm hidden sm:inline ${
                  i === currentStepIndex ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-2 sm:mx-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Select Tier */}
          {step === 'tier' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold">Choose Your New Plan</h2>
                <p className="text-sm text-muted-foreground">
                  Current plan: <Badge variant="outline">{currentTierCode}</Badge>
                </p>
              </div>

              {tiersLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-64" />
                  ))}
                </div>
              ) : availableTiers.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto text-amber-500" />
                  <h3 className="mt-4 text-lg font-semibold">You&apos;re on the highest tier!</h3>
                  <p className="text-muted-foreground">You already have access to all features.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableTiers.map((tier) => (
                    <Card
                      key={tier.code}
                      className={`relative cursor-pointer transition-all ${
                        selectedTier?.code === tier.code ? 'ring-2 ring-primary' : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedTier(tier)}
                    >
                      {tier.is_recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-amber-500 hover:bg-amber-500">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Recommended
                          </Badge>
                        </div>
                      )}
                      <CardHeader className="pt-6">
                        <CardTitle>{tier.display_name}</CardTitle>
                        <CardDescription>{tier.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold mb-4">
                          {formatCurrency(tier.price_monthly, tier.currency)}
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        </div>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            {tier.max_users_display}
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            {tier.max_branches_display}
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            {tier.max_storage_display}
                          </li>
                          {tier.features.slice(0, 3).map((feature, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Billing Period */}
          {step === 'billing' && selectedTier && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold">Choose Billing Period</h2>
                <p className="text-sm text-muted-foreground">Save more with yearly billing</p>
              </div>

              <RadioGroup
                value={billingPeriod}
                onValueChange={(v) => setBillingPeriod(v as BillingPeriod)}
                className="grid gap-4 md:grid-cols-2 max-w-xl mx-auto"
              >
                <Label
                  htmlFor="monthly"
                  className={`flex flex-col gap-2 p-4 border rounded-lg cursor-pointer ${
                    billingPeriod === 'monthly' ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="monthly" id="monthly" />
                    <span className="font-medium">Monthly</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(selectedTier.price_monthly, selectedTier.currency)}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </div>
                </Label>

                <Label
                  htmlFor="yearly"
                  className={`flex flex-col gap-2 p-4 border rounded-lg cursor-pointer ${
                    billingPeriod === 'yearly' ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yearly" id="yearly" />
                    <span className="font-medium">Yearly</span>
                    <Badge variant="secondary" className="text-xs">
                      Save {formatCurrency(getSavings(), selectedTier.currency)}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(selectedTier.price_yearly, selectedTier.currency)}
                    <span className="text-sm font-normal text-muted-foreground">/year</span>
                  </div>
                </Label>
              </RadioGroup>
            </div>
          )}

          {/* Step 3: Payment Method */}
          {step === 'payment' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold">Select Payment Method</h2>
                <p className="text-sm text-muted-foreground">Choose how you&apos;d like to pay</p>
              </div>

              {paymentMethodsLoading ? (
                <div className="space-y-4 max-w-md mx-auto">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : (
                <RadioGroup
                  value={selectedPaymentMethod?.id || ''}
                  onValueChange={(id) => {
                    const method = paymentMethods?.find((m) => m.id === id);
                    setSelectedPaymentMethod(method || null);
                  }}
                  className="space-y-4 max-w-md mx-auto"
                >
                  {paymentMethods?.map((method) => (
                    <Label
                      key={method.id}
                      htmlFor={method.id}
                      className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer ${
                        selectedPaymentMethod?.id === method.id ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <RadioGroupItem value={method.id} id={method.id} />
                      <div className="flex items-center gap-3 flex-1">
                        {method.type === 'bank_transfer' ? (
                          <Building2 className="h-6 w-6 text-blue-500" />
                        ) : method.type === 'qris' ? (
                          <QrCode className="h-6 w-6 text-purple-500" />
                        ) : (
                          <Wallet className="h-6 w-6 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium">{method.name}</p>
                          {method.type === 'bank_transfer' && (
                            <p className="text-sm text-muted-foreground">{method.account_number}</p>
                          )}
                        </div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && selectedTier && selectedPaymentMethod && (
            <div className="space-y-6 max-w-md mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold">Confirm Your Order</h2>
                <p className="text-sm text-muted-foreground">Review your upgrade details</p>
              </div>

              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Plan</span>
                  <span className="font-medium">{currentTierCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New Plan</span>
                  <span className="font-medium">{selectedTier.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing Period</span>
                  <span className="font-medium capitalize">{billingPeriod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium">{selectedPaymentMethod.name}</span>
                </div>
                <hr />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total Amount</span>
                  <span className="font-bold">
                    {formatCurrency(getAmount(), selectedTier.currency)}
                  </span>
                </div>
              </div>

              {/* Payment Instructions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Payment Instructions</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {selectedPaymentMethod.type === 'bank_transfer' ? (
                    <div className="space-y-2">
                      <p>Transfer to:</p>
                      <div className="p-3 bg-muted rounded-lg space-y-1">
                        <p className="font-medium">{selectedPaymentMethod.bank_name}</p>
                        <p className="font-mono text-lg">{selectedPaymentMethod.account_number}</p>
                        <p>{selectedPaymentMethod.account_name}</p>
                      </div>
                    </div>
                  ) : (
                    <p>QRIS code will be shown after confirmation.</p>
                  )}
                  {selectedPaymentMethod.instructions && (
                    <p className="mt-3 text-muted-foreground">{selectedPaymentMethod.instructions}</p>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-center text-muted-foreground">
                After creating the request, you&apos;ll need to upload proof of payment. The upgrade
                will be applied after admin approval.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        {step !== 'tier' ? (
          <Button variant="outline" onClick={prevStep}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        ) : mode === 'edit' ? (
          <Button variant="outline" onClick={cancelEditMode}>
            Cancel Edit
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={nextStep}
          disabled={!canProceed() || createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {mode === 'edit' ? 'Updating...' : 'Creating...'}
            </>
          ) : step === 'confirm' ? (
            mode === 'edit' ? (
              'Update Request'
            ) : (
              'Create Upgrade Request'
            )
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
