'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Building2, Users, HardDrive, Check, Loader2, Save, Globe, DollarSign, Calendar, Hash, Clock, CreditCard, ArrowRight, X, Shield, Info } from 'lucide-react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import type { SubscriptionInfo, UpgradeRequest } from '@/types/payment';
import { upgradeRequestsTenantAPI } from '@/lib/api/upgrade-requests';
import {
  FormatSettings,
  DEFAULT_FORMAT_SETTINGS,
  getFormatPreview,
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/utils/format';
import { TenantLogoUpload } from '@/components/features/tenant/TenantLogoUpload';
import { useTenantPermission } from '@/hooks/use-permission';

interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  tier: string;
  subscription_status: string;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  settings: Record<string, unknown>;
}

interface UsageData {
  tenant_id: string;
  tenant_name: string;
  tier: string;
  users_current: number;
  users_limit: number;
  users_available: number;
  users_percent: number;
  branches_current: number;
  branches_limit: number;
  branches_available: number;
  branches_percent: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  storage_available_gb: number;
  storage_percent: number;
  is_user_limit_reached: boolean;
  is_branch_limit_reached: boolean;
  is_storage_limit_reached: boolean;
  can_upgrade: boolean;
  next_tier: string | null;
}

interface TierInfo {
  tier: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  features: string[];
  is_recommended: boolean;
}

interface AvailableTiers {
  tiers: TierInfo[];
  current_tier: string;
}

function formatLimit(value: number): string {
  return value === -1 ? 'Unlimited' : String(value);
}

function getProgressColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

export default function SettingsPage() {
  const searchParams = useSearchParams();

  // Permission checks
  const canEditSettings = useTenantPermission('tenant.settings.edit');
  const canViewBilling = useTenantPermission('tenant.billing.view');
  const canManageBilling = useTenantPermission('tenant.billing.manage');

  // Backward compatibility alias
  const canEdit = canEditSettings;

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'organization');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Organization form state
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [formName, setFormName] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formLanguage, setFormLanguage] = useState('id');

  // Format settings state
  const [formatSettings, setFormatSettings] = useState<FormatSettings>(DEFAULT_FORMAT_SETTINGS);
  const [formatSaving, setFormatSaving] = useState(false);
  const [formatSaveSuccess, setFormatSaveSuccess] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  // Subscription state
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [tiers, setTiers] = useState<AvailableTiers | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);
  const [pendingUpgrade, setPendingUpgrade] = useState<UpgradeRequest | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tenantData, usageData, tiersData, formatData, subInfoData, upgradeData] = await Promise.all([
        apiClient.get<TenantInfo>('/tenant-settings/'),
        apiClient.get<UsageData>('/tenant-settings/usage'),
        apiClient.get<AvailableTiers>('/tenant-settings/tiers'),
        apiClient.get<FormatSettings>('/tenant-settings/format'),
        apiClient.get<SubscriptionInfo>('/tenant-settings/subscription').catch(() => null),
        upgradeRequestsTenantAPI.list('pending').catch(() => ({ items: [], total: 0 })),
      ]);

      setTenantInfo(tenantData);
      setUsage(usageData);
      setTiers(tiersData);
      setFormatSettings(formatData);
      setSubscriptionInfo(subInfoData);
      // Get the most recent pending upgrade request
      setPendingUpgrade(upgradeData.items?.[0] || null);

      // Populate form
      setFormName(tenantData.name);
      setFormLogoUrl(tenantData.logo_url || '');
      setFormLanguage((tenantData.settings?.language as string) || 'id');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError?.response?.data?.detail || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const updated = await apiClient.put<TenantInfo>('/tenant-settings/settings', {
        name: formName,
        logo_url: formLogoUrl || null,
        settings: {
          ...tenantInfo?.settings,
          language: formLanguage,
        },
      });
      setTenantInfo(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError?.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleFormatSave = async () => {
    setFormatSaving(true);
    setFormatSaveSuccess(false);
    setFormatError(null);
    try {
      const updated = await apiClient.put<FormatSettings>('/tenant-settings/format', formatSettings);
      setFormatSettings(updated);
      setFormatSaveSuccess(true);
      setTimeout(() => setFormatSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setFormatError(axiosError?.response?.data?.detail || 'Failed to save format settings');
    } finally {
      setFormatSaving(false);
    }
  };

  const updateFormatSetting = <K extends keyof FormatSettings>(
    key: K,
    value: FormatSettings[K]
  ) => {
    setFormatSettings((prev) => ({ ...prev, [key]: value }));
  };

  const preview = getFormatPreview(formatSettings);

  const handleCancelScheduledChange = async () => {
    setCancellingSchedule(true);
    try {
      await apiClient.post('/tenant-settings/subscription/cancel-scheduled');
      await loadData();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError?.response?.data?.detail || 'Failed to cancel scheduled change');
    } finally {
      setCancellingSchedule(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organization</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="format">Format Settings</TabsTrigger>
          {canViewBilling && (
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          )}
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Organization Information</CardTitle>
                <CardDescription>
                  {canEdit
                    ? 'Update your organization details'
                    : 'View your organization details'}
                </CardDescription>
              </div>
              {canEdit && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Saved' : 'Save'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Your company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organization Logo</Label>
                  {canEdit ? (
                    <TenantLogoUpload
                      currentLogoUrl={tenantInfo?.logo_url || undefined}
                      tenantName={tenantInfo?.name}
                      onSuccess={() => {
                        // Refresh tenant info to show updated logo
                        loadData();
                      }}
                      onError={(err) => {
                        setError(err.message);
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      {tenantInfo?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tenantInfo.logo_url}
                          alt="Organization logo"
                          className="h-16 w-16 rounded-lg object-cover border"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Contact an admin to change the logo
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={formLanguage}
                    onValueChange={setFormLanguage}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">Indonesian</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Format Settings Tab */}
        <TabsContent value="format" className="mt-6 space-y-6">
          {formatError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
              {formatError}
            </div>
          )}

          {/* Preview Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Format Preview
              </CardTitle>
              <CardDescription>
                See how values will be displayed with your current settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Currency</p>
                  <p className="text-lg font-semibold">{preview.currency}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Number</p>
                  <p className="text-lg font-semibold">{preview.number}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Date</p>
                  <p className="text-lg font-semibold">{preview.date}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Currency Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Currency Settings
                </CardTitle>
                <CardDescription>
                  Configure how currency values are displayed
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Currency Code</Label>
                  <Select
                    value={formatSettings.currency_code}
                    onValueChange={(v) => updateFormatSetting('currency_code', v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Symbol Position</Label>
                  <RadioGroup
                    value={formatSettings.currency_symbol_position}
                    onValueChange={(v) => updateFormatSetting('currency_symbol_position', v as 'before' | 'after')}
                    disabled={!canEdit}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="before" id="pos-before" />
                      <Label htmlFor="pos-before" className="font-normal">Before (Rp 1.000)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="after" id="pos-after" />
                      <Label htmlFor="pos-after" className="font-normal">After (1.000 Rp)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Price Decimal Places</Label>
                  <Select
                    value={String(formatSettings.price_decimal_places)}
                    onValueChange={(v) => updateFormatSetting('price_decimal_places', parseInt(v))}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 (1.000)</SelectItem>
                      <SelectItem value="1">1 (1.000,0)</SelectItem>
                      <SelectItem value="2">2 (1.000,00)</SelectItem>
                      <SelectItem value="3">3 (1.000,000)</SelectItem>
                      <SelectItem value="4">4 (1.000,0000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Number Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Number Format
              </CardTitle>
              <CardDescription>
                Configure decimal and thousands separators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Decimal Separator</Label>
                  <Select
                    value={formatSettings.decimal_separator}
                    onValueChange={(v) => updateFormatSetting('decimal_separator', v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=".">Period (.)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Thousands Separator</Label>
                  <Select
                    value={formatSettings.thousands_separator}
                    onValueChange={(v) => updateFormatSetting('thousands_separator', v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=".">Period (.)</SelectItem>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=" ">Space</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity Decimal Places</Label>
                  <Select
                    value={String(formatSettings.quantity_decimal_places)}
                    onValueChange={(v) => updateFormatSetting('quantity_decimal_places', parseInt(v))}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 (1.234)</SelectItem>
                      <SelectItem value="1">1 (1.234,5)</SelectItem>
                      <SelectItem value="2">2 (1.234,56)</SelectItem>
                      <SelectItem value="3">3 (1.234,567)</SelectItem>
                      <SelectItem value="4">4 (1.234,5678)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date & Time Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Date & Time
              </CardTitle>
              <CardDescription>
                Configure date format and timezone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select
                    value={formatSettings.date_format}
                    onValueChange={(v) => updateFormatSetting('date_format', v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMAT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label} ({opt.example})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={formatSettings.timezone}
                    onValueChange={(v) => updateFormatSetting('timezone', v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={handleFormatSave} disabled={formatSaving} size="lg">
                {formatSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : formatSaveSuccess ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {formatSaveSuccess ? 'Saved' : 'Save Format Settings'}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="mt-6 space-y-6">
          {/* Subscription Info Card */}
          {subscriptionInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription Details
                </CardTitle>
                <CardDescription>
                  Your current subscription information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Current Plan</p>
                    <p className="text-lg font-semibold">{subscriptionInfo.tier_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      Billed {subscriptionInfo.billing_period}
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Subscription Period</p>
                    {subscriptionInfo.subscription_started_at && subscriptionInfo.subscription_ends_at ? (
                      <>
                        <p className="text-lg font-semibold">
                          {format(new Date(subscriptionInfo.subscription_started_at), 'MMM d')} - {format(new Date(subscriptionInfo.subscription_ends_at), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {subscriptionInfo.days_remaining} days remaining
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-semibold text-muted-foreground">Not set</p>
                    )}
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Days Remaining</p>
                    <p className="text-lg font-semibold">{subscriptionInfo.days_remaining}</p>
                    {subscriptionInfo.subscription_ends_at && (
                      <p className="text-xs text-muted-foreground">
                        Expires {formatDistanceToNow(new Date(subscriptionInfo.subscription_ends_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Credit Balance</p>
                    <p className="text-lg font-semibold">{formatCurrency(subscriptionInfo.credit_balance)}</p>
                    <p className="text-xs text-muted-foreground">
                      Available for future payments
                    </p>
                  </div>
                </div>

                {/* Scheduled Change Alert */}
                {subscriptionInfo.scheduled_change && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-300">
                            Scheduled Plan Change
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            Your plan will change to <strong>{subscriptionInfo.scheduled_change.tier_name || subscriptionInfo.scheduled_change.tier_code}</strong> on{' '}
                            <strong>{format(new Date(subscriptionInfo.scheduled_change.effective_at), 'PPP')}</strong>
                            {subscriptionInfo.scheduled_change.days_until > 0 && (
                              <> ({subscriptionInfo.scheduled_change.days_until} days)</>
                            )}
                          </p>
                        </div>
                      </div>
                      {canManageBilling && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelScheduledChange}
                          disabled={cancellingSchedule}
                          className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                        >
                          {cancellingSchedule ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <X className="h-4 w-4 mr-2" />
                          )}
                          Cancel Change
                        </Button>
                      )}
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          )}

          {/* Usage Cards */}
          {usage && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Users</p>
                      <p className="text-xl font-bold">
                        {usage.users_current} / {formatLimit(usage.users_limit)}
                      </p>
                    </div>
                  </div>
                  {usage.users_limit !== -1 && (
                    <div className="space-y-1">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(usage.users_percent)}`}
                          style={{ width: `${Math.min(usage.users_percent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {usage.users_available === -1 ? 'Unlimited' : `${usage.users_available} available`}
                      </p>
                    </div>
                  )}
                  {usage.users_limit === -1 && (
                    <p className="text-xs text-muted-foreground">Unlimited</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Branches</p>
                      <p className="text-xl font-bold">
                        {usage.branches_current} / {formatLimit(usage.branches_limit)}
                      </p>
                    </div>
                  </div>
                  {usage.branches_limit !== -1 && (
                    <div className="space-y-1">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(usage.branches_percent)}`}
                          style={{ width: `${Math.min(usage.branches_percent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {usage.branches_available === -1 ? 'Unlimited' : `${usage.branches_available} available`}
                      </p>
                    </div>
                  )}
                  {usage.branches_limit === -1 && (
                    <p className="text-xs text-muted-foreground">Unlimited</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <HardDrive className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Storage</p>
                      <p className="text-xl font-bold">
                        {usage.storage_used_gb.toFixed(1)} / {formatLimit(usage.storage_limit_gb)}
                        {usage.storage_limit_gb !== -1 && ' GB'}
                      </p>
                    </div>
                  </div>
                  {usage.storage_limit_gb !== -1 && (
                    <div className="space-y-1">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(usage.storage_percent)}`}
                          style={{ width: `${Math.min(usage.storage_percent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {usage.storage_available_gb.toFixed(1)} GB available
                      </p>
                    </div>
                  )}
                  {usage.storage_limit_gb === -1 && (
                    <p className="text-xs text-muted-foreground">Unlimited</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tier Cards */}
          {tiers && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Subscription Plans</CardTitle>
                  <CardDescription>
                    Current plan: <Badge variant="outline" className="ml-1">{tiers.current_tier.charAt(0).toUpperCase() + tiers.current_tier.slice(1)}</Badge>
                  </CardDescription>
                </div>
                {canManageBilling && (
                  <Link href="/upgrade">
                    <Button>
                      Upgrade Subscription
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pending Upgrade Alert */}
                {pendingUpgrade && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="font-medium text-blue-800 dark:text-blue-300">
                            Pending Upgrade Request
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-400">
                            Upgrade to <strong>{pendingUpgrade.target_tier_name || pendingUpgrade.target_tier_code}</strong> is pending
                            {pendingUpgrade.status === 'pending' && ' (awaiting payment proof)'}
                            {pendingUpgrade.status === 'payment_uploaded' && ' (awaiting admin review)'}
                            {pendingUpgrade.status === 'under_review' && ' (under admin review)'}
                          </p>
                        </div>
                      </div>
                      <Link href="/upgrade">
                        <Button variant="outline" size="sm" className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                          View Details
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tiers.tiers.map((tier) => {
                    const isCurrent = tier.tier === tiers.current_tier;
                    const canUpgrade = canManageBilling && !isCurrent && tier.price_monthly > 0;
                    return (
                      <div
                        key={tier.tier}
                        className={`border rounded-lg p-4 relative ${
                          isCurrent
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 ring-2 ring-blue-200 dark:ring-blue-800'
                            : 'border-border'
                        }`}
                      >
                        {isCurrent && (
                          <Badge className="absolute -top-2 left-4 bg-blue-500">
                            Current Plan
                          </Badge>
                        )}
                        {tier.is_recommended && !isCurrent && (
                          <Badge className="absolute -top-2 left-4 bg-green-500">
                            Recommended
                          </Badge>
                        )}
                        <div className="mt-2">
                          <h3 className="font-semibold text-lg">{tier.display_name}</h3>
                          <p className="text-2xl font-bold mt-1">
                            ${tier.price_monthly}
                            <span className="text-sm font-normal text-muted-foreground">/mo</span>
                          </p>
                        </div>
                        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-center">
                            <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                            {formatLimit(tier.max_users)} users
                          </li>
                          <li className="flex items-center">
                            <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                            {formatLimit(tier.max_branches)} branches
                          </li>
                          <li className="flex items-center">
                            <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                            {formatLimit(tier.max_storage_gb)} {tier.max_storage_gb !== -1 ? 'GB' : ''} storage
                          </li>
                          {tier.features.map((feature) => (
                            <li key={feature} className="flex items-center">
                              <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-4">
                          {isCurrent ? (
                            <Button variant="outline" className="w-full" disabled>
                              Current Plan
                            </Button>
                          ) : canUpgrade ? (
                            <Link href={`/upgrade?tier=${tier.tier}`} className="block">
                              <Button variant="outline" className="w-full">
                                Select Plan
                              </Button>
                            </Link>
                          ) : (
                            <Button variant="outline" className="w-full" disabled>
                              {tier.price_monthly === 0 ? 'Free Plan' : 'Select Plan'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="mt-6 space-y-6">
          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium">About Tenant Permissions</p>
                  <p className="mt-1">
                    Permissions control what actions users can perform within your organization.
                    Permissions are assigned based on the user&apos;s role (Owner, Admin, or Member).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className="bg-purple-500 hover:bg-purple-500">Owner</Badge>
                  Full Control
                </CardTitle>
                <CardDescription>
                  Complete access to all organization features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    22
                  </div>
                  <div className="text-sm text-muted-foreground">
                    permissions granted
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className="bg-blue-500 hover:bg-blue-500">Admin</Badge>
                  Management Access
                </CardTitle>
                <CardDescription>
                  Can manage users, branches, and settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    17
                  </div>
                  <div className="text-sm text-muted-foreground">
                    permissions granted
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="secondary">Member</Badge>
                  Basic Access
                </CardTitle>
                <CardDescription>
                  View-only access to most features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                    7
                  </div>
                  <div className="text-sm text-muted-foreground">
                    permissions granted
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Permission Matrix Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Permission Matrix
              </CardTitle>
              <CardDescription>
                Detailed breakdown of permissions by role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TooltipProvider>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Category</TableHead>
                        <TableHead className="w-[150px]">Permission</TableHead>
                        <TableHead className="w-[100px] text-center">
                          <Badge className="bg-purple-500 hover:bg-purple-500">Owner</Badge>
                        </TableHead>
                        <TableHead className="w-[100px] text-center">
                          <Badge className="bg-blue-500 hover:bg-blue-500">Admin</Badge>
                        </TableHead>
                        <TableHead className="w-[100px] text-center">
                          <Badge variant="secondary">Member</Badge>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Dashboard */}
                      <TableRow>
                        <TableCell rowSpan={1} className="font-medium bg-muted/30 align-top">
                          Dashboard
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>View</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Access the main dashboard</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.dashboard.view</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                      </TableRow>

                      {/* Branches */}
                      <TableRow>
                        <TableCell rowSpan={4} className="font-medium bg-muted/30 align-top">
                          Branches
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>View</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">View branch list and details</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.branches.view</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Create</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Create new branches</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.branches.create</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Update</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Edit branch details</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.branches.update</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Delete</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Delete branches</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.branches.delete</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>

                      {/* Users */}
                      <TableRow>
                        <TableCell rowSpan={6} className="font-medium bg-muted/30 align-top">
                          Users
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>View</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">View user list and details</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.users.view</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Create</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Create new users</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.users.create</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Update</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Edit user details</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.users.update</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Delete</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Delete users</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.users.delete</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Invite</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Invite users via email</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.users.invite</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Change Role</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Change user roles</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.users.change_role</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>

                      {/* Settings */}
                      <TableRow>
                        <TableCell rowSpan={2} className="font-medium bg-muted/30 align-top">
                          Settings
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>View</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">View organization settings</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.settings.view</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Edit</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Edit organization settings</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.settings.edit</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>

                      {/* Billing */}
                      <TableRow>
                        <TableCell rowSpan={2} className="font-medium bg-muted/30 align-top">
                          Billing
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>View</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">View billing and subscription info</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.billing.view</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Manage</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Manage subscriptions and payments</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.billing.manage</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>

                      {/* Usage */}
                      <TableRow>
                        <TableCell rowSpan={1} className="font-medium bg-muted/30 align-top">
                          Usage
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>View</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">View usage metrics and quotas</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.usage.view</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                      </TableRow>

                      {/* Audit */}
                      <TableRow>
                        <TableCell rowSpan={1} className="font-medium bg-muted/30 align-top">
                          Audit Logs
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>View</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">View audit trail and activity logs</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.audit.view</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>

                      {/* Files */}
                      <TableRow>
                        <TableCell rowSpan={3} className="font-medium bg-muted/30 align-top">
                          Files
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>View</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">View and download files</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.files.view</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Upload</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Upload new files</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.files.upload</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Delete</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Delete files</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.files.delete</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>

                      {/* Account */}
                      <TableRow>
                        <TableCell rowSpan={1} className="font-medium bg-muted/30 align-top">
                          Account
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 cursor-help">
                              <span>Delete</span>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Delete the entire organization account</p>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">tenant.account.delete</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-red-400 dark:text-red-600 mx-auto" /></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-muted-foreground">Permission granted</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-400 dark:text-red-600" />
                  <span className="text-muted-foreground">Permission denied</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Hover for details</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
