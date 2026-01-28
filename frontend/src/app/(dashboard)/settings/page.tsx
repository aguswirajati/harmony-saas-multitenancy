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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Users, HardDrive, Check, Loader2, Save } from 'lucide-react';

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
  settings: Record<string, string>;
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
  const [formTimezone, setFormTimezone] = useState('Asia/Jakarta');
  const [formLanguage, setFormLanguage] = useState('id');
  const [formCurrency, setFormCurrency] = useState('IDR');
  const [formDateFormat, setFormDateFormat] = useState('DD/MM/YYYY');

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
      const [tenantData, usageData, tiersData] = await Promise.all([
        apiClient.get<TenantInfo>('/tenant-settings/'),
        apiClient.get<UsageData>('/tenant-settings/usage'),
        apiClient.get<AvailableTiers>('/tenant-settings/tiers'),
      ]);

      setTenantInfo(tenantData);
      setUsage(usageData);
      setTiers(tiersData);

      // Populate form
      setFormName(tenantData.name);
      setFormLogoUrl(tenantData.logo_url || '');
      setFormTimezone(tenantData.settings?.timezone || 'Asia/Jakarta');
      setFormLanguage(tenantData.settings?.language || 'id');
      setFormCurrency(tenantData.settings?.currency || 'IDR');
      setFormDateFormat(tenantData.settings?.date_format || 'DD/MM/YYYY');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load settings');
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
          timezone: formTimezone,
          language: formLanguage,
          currency: formCurrency,
          date_format: formDateFormat,
        },
      });
      setTenantInfo(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your organization</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
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
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    value={formLogoUrl}
                    onChange={(e) => setFormLogoUrl(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={formTimezone}
                    onValueChange={setFormTimezone}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem>
                      <SelectItem value="Asia/Makassar">Asia/Makassar (WITA)</SelectItem>
                      <SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT)</SelectItem>
                      <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                      <SelectItem value="America/New_York">America/New York</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los Angeles</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formCurrency}
                    onValueChange={setFormCurrency}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDR">IDR - Indonesian Rupiah</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_format">Date Format</Label>
                  <Select
                    value={formDateFormat}
                    onValueChange={setFormDateFormat}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger id="date_format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="mt-6 space-y-6">
          {/* Usage Cards */}
          {usage && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Users</p>
                      <p className="text-xl font-bold">
                        {usage.users_current} / {formatLimit(usage.users_limit)}
                      </p>
                    </div>
                  </div>
                  {usage.users_limit !== -1 && (
                    <div className="space-y-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(usage.users_percent)}`}
                          style={{ width: `${Math.min(usage.users_percent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-right">
                        {usage.users_available === -1 ? 'Unlimited' : `${usage.users_available} available`}
                      </p>
                    </div>
                  )}
                  {usage.users_limit === -1 && (
                    <p className="text-xs text-gray-500">Unlimited</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Branches</p>
                      <p className="text-xl font-bold">
                        {usage.branches_current} / {formatLimit(usage.branches_limit)}
                      </p>
                    </div>
                  </div>
                  {usage.branches_limit !== -1 && (
                    <div className="space-y-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(usage.branches_percent)}`}
                          style={{ width: `${Math.min(usage.branches_percent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-right">
                        {usage.branches_available === -1 ? 'Unlimited' : `${usage.branches_available} available`}
                      </p>
                    </div>
                  )}
                  {usage.branches_limit === -1 && (
                    <p className="text-xs text-gray-500">Unlimited</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <HardDrive className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Storage</p>
                      <p className="text-xl font-bold">
                        {usage.storage_used_gb.toFixed(1)} / {formatLimit(usage.storage_limit_gb)}
                        {usage.storage_limit_gb !== -1 && ' GB'}
                      </p>
                    </div>
                  </div>
                  {usage.storage_limit_gb !== -1 && (
                    <div className="space-y-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(usage.storage_percent)}`}
                          style={{ width: `${Math.min(usage.storage_percent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-right">
                        {usage.storage_available_gb.toFixed(1)} GB available
                      </p>
                    </div>
                  )}
                  {usage.storage_limit_gb === -1 && (
                    <p className="text-xs text-gray-500">Unlimited</p>
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
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-gray-200'
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
                            <span className="text-sm font-normal text-gray-500">/mo</span>
                          </p>
                        </div>
                        <ul className="mt-4 space-y-2 text-sm text-gray-600">
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
                <p className="text-sm text-gray-500 mt-4 text-center">
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
