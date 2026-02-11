'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { subscriptionTiersAPI } from '@/lib/api/subscription-tiers';
import { paymentMethodsAPI } from '@/lib/api/payment-methods';
import { upgradeRequestsAPI } from '@/lib/api/upgrade-requests';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Check,
  ChevronRight,
  Star,
  Building2,
  QrCode,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/authStore';
import type { PublicTier, PublicPaymentMethod, BillingPeriod } from '@/types/payment';
import { formatCurrency } from '@/types/payment';

type Step = 'tier' | 'billing' | 'payment' | 'confirm';

export default function UpgradePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();

  const [step, setStep] = useState<Step>('tier');
  const [selectedTier, setSelectedTier] = useState<PublicTier | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PublicPaymentMethod | null>(null);

  const { data: tiersData, isLoading: tiersLoading } = useQuery({
    queryKey: ['public-tiers'],
    queryFn: () => subscriptionTiersAPI.public.list(),
  });

  const { data: paymentMethods, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['public-payment-methods'],
    queryFn: () => paymentMethodsAPI.public.list(),
    enabled: step === 'payment',
  });

  const createRequestMutation = useMutation({
    mutationFn: () =>
      upgradeRequestsAPI.tenant.create({
        target_tier_code: selectedTier!.code,
        billing_period: billingPeriod,
        payment_method_id: selectedPaymentMethod!.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-upgrade-requests'] });
      toast.success('Upgrade request created! Please complete the payment.');
      router.push(`/upgrade/history`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create upgrade request');
    },
  });

  const tiers = tiersData?.tiers || [];
  const currentTierCode = tenant?.tier || 'free';

  // Filter tiers to only show upgrades
  const availableTiers = tiers.filter(
    (tier) =>
      tier.code !== currentTierCode &&
      tier.price_monthly > (tiers.find((t) => t.code === currentTierCode)?.price_monthly || 0)
  );

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
        createRequestMutation.mutate();
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Upgrade Your Plan</h1>
        <p className="text-muted-foreground mt-2">
          Unlock more features and grow your business
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
                className={`ml-2 text-sm ${
                  i === currentStepIndex
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-4 text-muted-foreground" />
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
                  <h3 className="mt-4 text-lg font-semibold">
                    You&apos;re on the highest tier!
                  </h3>
                  <p className="text-muted-foreground">
                    You already have access to all features.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableTiers.map((tier) => (
                    <Card
                      key={tier.code}
                      className={`relative cursor-pointer transition-all ${
                        selectedTier?.code === tier.code
                          ? 'ring-2 ring-primary'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedTier(tier)}
                    >
                      {tier.is_recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-amber-500">
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
                          <span className="text-sm font-normal text-muted-foreground">
                            /month
                          </span>
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
                <p className="text-sm text-muted-foreground">
                  Save more with yearly billing
                </p>
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
                    <span className="text-sm font-normal text-muted-foreground">
                      /month
                    </span>
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
                    <span className="text-sm font-normal text-muted-foreground">
                      /year
                    </span>
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
                <p className="text-sm text-muted-foreground">
                  Choose how you&apos;d like to pay
                </p>
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
                        selectedPaymentMethod?.id === method.id
                          ? 'ring-2 ring-primary'
                          : ''
                      }`}
                    >
                      <RadioGroupItem value={method.id} id={method.id} />
                      <div className="flex items-center gap-3 flex-1">
                        {method.type === 'bank_transfer' ? (
                          <Building2 className="h-6 w-6 text-blue-500" />
                        ) : (
                          <QrCode className="h-6 w-6 text-purple-500" />
                        )}
                        <div>
                          <p className="font-medium">{method.name}</p>
                          {method.type === 'bank_transfer' && (
                            <p className="text-sm text-muted-foreground">
                              {method.account_number}
                            </p>
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
                <p className="text-sm text-muted-foreground">
                  Review your upgrade details
                </p>
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
                        <p className="font-mono text-lg">
                          {selectedPaymentMethod.account_number}
                        </p>
                        <p>{selectedPaymentMethod.account_name}</p>
                      </div>
                    </div>
                  ) : (
                    <p>QRIS code will be shown after confirmation.</p>
                  )}
                  {selectedPaymentMethod.instructions && (
                    <p className="mt-3 text-muted-foreground">
                      {selectedPaymentMethod.instructions}
                    </p>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-center text-muted-foreground">
                After creating the request, you&apos;ll need to upload proof of payment.
                The upgrade will be applied after admin approval.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        {step !== 'tier' ? (
          <Button variant="outline" onClick={prevStep}>
            Back
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={nextStep}
          disabled={!canProceed() || createRequestMutation.isPending}
        >
          {createRequestMutation.isPending
            ? 'Creating...'
            : step === 'confirm'
            ? 'Create Upgrade Request'
            : 'Continue'}
          {step !== 'confirm' && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
