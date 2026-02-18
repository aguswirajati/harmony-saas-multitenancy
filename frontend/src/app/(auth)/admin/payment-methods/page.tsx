'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentMethodsAPI } from '@/lib/api/payment-methods';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Building2, QrCode, CreditCard, Wallet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type {
  PaymentMethod,
  PaymentMethodCreate,
  PaymentMethodUpdate,
  PaymentMethodType,
  WalletProvider,
} from '@/types/payment';
import { getPaymentTypeLabel, getWalletTypeLabel } from '@/types/payment';

interface PaymentMethodsPageProps {
  embedded?: boolean;
}

export default function PaymentMethodsPage({ embedded = false }: PaymentMethodsPageProps) {
  const queryClient = useQueryClient();
  const { devMode } = useDevModeStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPermanentDeleteDialogOpen, setIsPermanentDeleteDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<PaymentMethodCreate>>({
    code: '',
    name: '',
    type: 'bank_transfer',
    bank_name: '',
    account_number: '',
    account_name: '',
    wallet_type: undefined,
    instructions: '',
    sort_order: 0,
    is_public: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payment-methods', includeInactive],
    queryFn: () => paymentMethodsAPI.admin.list(includeInactive),
  });

  const createMutation = useMutation({
    mutationFn: (data: PaymentMethodCreate) => paymentMethodsAPI.admin.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      toast.success('Payment method created successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create payment method');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaymentMethodUpdate }) =>
      paymentMethodsAPI.admin.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      toast.success('Payment method updated successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update payment method');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentMethodsAPI.admin.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      toast.success('Payment method deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedMethod(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete payment method');
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => paymentMethodsAPI.admin.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      toast.success('Payment method permanently deleted');
      setIsPermanentDeleteDialogOpen(false);
      setSelectedMethod(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to permanently delete payment method');
    },
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'bank_transfer',
      bank_name: '',
      account_number: '',
      account_name: '',
      wallet_type: undefined,
      instructions: '',
      sort_order: 0,
      is_public: true,
    });
    setSelectedMethod(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setFormData({
      code: method.code,
      name: method.name,
      type: method.type,
      bank_name: method.bank_name || '',
      account_number: method.account_number || '',
      account_name: method.account_name || '',
      wallet_type: method.wallet_type || undefined,
      instructions: method.instructions || '',
      sort_order: method.sort_order,
      is_public: method.is_public,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setIsDeleteDialogOpen(true);
  };

  const openPermanentDeleteDialog = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setIsPermanentDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedMethod) {
      updateMutation.mutate({ id: selectedMethod.id, data: formData as PaymentMethodUpdate });
    } else {
      createMutation.mutate(formData as PaymentMethodCreate);
    }
  };

  const methods = data?.items || [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  const getTypeIcon = (type: PaymentMethodType) => {
    switch (type) {
      case 'bank_transfer':
        return <Building2 className="h-4 w-4" />;
      case 'qris':
        return <QrCode className="h-4 w-4" />;
      case 'wallet':
        return <Wallet className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  return (
    <div className={embedded ? "space-y-4" : "space-y-6 p-6"}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Payment Methods
            </h1>
            <p className="text-muted-foreground">
              Manage bank accounts and QRIS for manual payments
            </p>
          </div>
        )}
        <div className={`flex items-center gap-4 ${embedded ? 'w-full justify-between' : ''}`}>
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive-pm"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label htmlFor="include-inactive-pm" className="text-sm">
              Show inactive
            </Label>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Method
          </Button>
        </div>
      </div>

      {/* Payment Methods Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account Info</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : methods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-8 w-8" />
                      <p>No payment methods found</p>
                      <Button variant="outline" size="sm" onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Method
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                methods.map((method) => (
                  <TableRow key={method.id} className={!method.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono">{method.code}</TableCell>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(method.type)}
                        {getPaymentTypeLabel(method.type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {method.type === 'bank_transfer' ? (
                        <div className="text-sm">
                          <p className="font-medium">{method.bank_name}</p>
                          <p className="text-muted-foreground">
                            {method.account_number} - {method.account_name}
                          </p>
                        </div>
                      ) : method.type === 'wallet' ? (
                        <div className="text-sm">
                          <p className="font-medium">{getWalletTypeLabel(method.wallet_type)}</p>
                          <p className="text-muted-foreground">
                            {method.account_number} - {method.account_name}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">QRIS Code</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {method.is_active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                            Inactive
                          </Badge>
                        )}
                        {method.is_public && (
                          <Badge variant="outline" className="text-xs">
                            Public
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(method)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {method.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(method)}
                            className="text-red-600 hover:text-red-700"
                            title="Soft delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : devMode ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPermanentDeleteDialog(method)}
                            className="text-red-600 hover:text-red-700"
                            title="Permanently delete (DEV_MODE)"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedMethod ? 'Edit Payment Method' : 'Create Payment Method'}
            </DialogTitle>
            <DialogDescription>
              {selectedMethod
                ? 'Update payment method details'
                : 'Add a new payment method for manual payments'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info - Create Mode */}
            {!selectedMethod && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toLowerCase() })
                    }
                    placeholder="e.g., bca"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: PaymentMethodType) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="qris">QRIS</SelectItem>
                      <SelectItem value="wallet">E-Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Basic Info - Edit Mode (Read-only code and type) */}
            {selectedMethod && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Code</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted font-mono text-sm">
                    {formData.code}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Type</Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted text-sm">
                    {getTypeIcon(formData.type as PaymentMethodType)}
                    {getPaymentTypeLabel(formData.type as PaymentMethodType)}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Bank BCA"
                required
              />
            </div>

            {/* Bank Transfer Fields */}
            {formData.type === 'bank_transfer' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_name: e.target.value })
                    }
                    placeholder="e.g., Bank Central Asia (BCA)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_number">Account Number</Label>
                    <Input
                      id="account_number"
                      value={formData.account_number || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, account_number: e.target.value })
                      }
                      placeholder="e.g., 1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_name">Account Name</Label>
                    <Input
                      id="account_name"
                      value={formData.account_name || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, account_name: e.target.value })
                      }
                      placeholder="e.g., PT Company Name"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Wallet Fields */}
            {formData.type === 'wallet' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wallet_type">Wallet Provider</Label>
                  <Select
                    value={formData.wallet_type || ''}
                    onValueChange={(value: WalletProvider) =>
                      setFormData({ ...formData, wallet_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select wallet provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shopeepay">ShopeePay</SelectItem>
                      <SelectItem value="gopay">GoPay</SelectItem>
                      <SelectItem value="dana">DANA</SelectItem>
                      <SelectItem value="ovo">OVO</SelectItem>
                      <SelectItem value="linkaja">LinkAja</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_number">Phone Number</Label>
                    <Input
                      id="account_number"
                      value={formData.account_number || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, account_number: e.target.value })
                      }
                      placeholder="e.g., 08123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_name">Account Name</Label>
                    <Input
                      id="account_name"
                      value={formData.account_name || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, account_name: e.target.value })
                      }
                      placeholder="e.g., John Doe"
                    />
                  </div>
                </div>
              </>
            )}

            {/* QRIS Info */}
            {formData.type === 'qris' && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-700 dark:text-blue-400">
                {selectedMethod
                  ? 'To update the QRIS image, use the file upload feature separately.'
                  : 'After creating the QRIS payment method, you can upload the QRIS image using the file upload feature.'}
              </div>
            )}

            {/* Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Payment Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions || ''}
                onChange={(e) =>
                  setFormData({ ...formData, instructions: e.target.value })
                }
                placeholder="Instructions shown to users when making payment..."
                rows={3}
              />
            </div>

            {/* Display Settings */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                  }
                  className="w-24"
                  min={0}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_public"
                  checked={formData.is_public ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_public: checked })
                  }
                />
                <Label htmlFor="is_public">Available for selection</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : selectedMethod ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedMethod?.name}&quot;?
              This will soft-delete the record (mark as inactive).
              <br /><br />
              <strong>Note:</strong> Payment methods with pending upgrade requests cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMethod && deleteMutation.mutate(selectedMethod.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog (DEV_MODE only) */}
      <AlertDialog open={isPermanentDeleteDialogOpen} onOpenChange={setIsPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Payment Method
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to <strong>permanently delete</strong> &quot;{selectedMethod?.name}&quot; (code: {selectedMethod?.code})?
              <br /><br />
              This will remove the record from the database completely. This action cannot be undone.
              <br /><br />
              <span className="text-amber-600 dark:text-amber-400">
                This is only available in DEV_MODE and allows the code to be reused.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMethod && permanentDeleteMutation.mutate(selectedMethod.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {permanentDeleteMutation.isPending ? 'Deleting...' : 'Permanently Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
