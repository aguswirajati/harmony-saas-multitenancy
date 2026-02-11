'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
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
import { Building2, Users, HardDrive, Check, Loader2, Save, Globe, DollarSign, Calendar, Hash } from 'lucide-react';
import {
  FormatSettings,
  DEFAULT_FORMAT_SETTINGS,
  getFormatPreview,
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/utils/format';
import { TenantLogoUpload } from '@/components/features/tenant/TenantLogoUpload';

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
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tenantData, usageData, tiersData, formatData] = await Promise.all([
        apiClient.get<TenantInfo>('/tenant-settings/'),
        apiClient.get<UsageData>('/tenant-settings/usage'),
        apiClient.get<AvailableTiers>('/tenant-settings/tiers'),
        apiClient.get<FormatSettings>('/tenant-settings/format'),
      ]);

      setTenantInfo(tenantData);
      setUsage(usageData);
      setTiers(tiersData);
      setFormatSettings(formatData);

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
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Organization Information</CardTitle>
                <CardDescription>
                  {isAdmin
                    ? 'Update your organization details'
                    : 'View your organization details'}
                </CardDescription>
              </div>
              {isAdmin && (
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
                    disabled={!isAdmin}
                    placeholder="Your company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organization Logo</Label>
                  {isAdmin ? (
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
          {isAdmin && (
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
              <CardHeader>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>
                  Current plan: <Badge variant="outline" className="ml-1">{tiers.current_tier.charAt(0).toUpperCase() + tiers.current_tier.slice(1)}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tiers.tiers.map((tier) => {
                    const isCurrent = tier.tier === tiers.current_tier;
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
                          ) : (
                            <Button variant="outline" className="w-full" disabled>
                              Contact Admin
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  To upgrade your plan, please contact your system administrator.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
