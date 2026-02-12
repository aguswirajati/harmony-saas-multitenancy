/**
 * Organization Settings Page
 * Tenant admin can update organization information
 * 
 * Location: app/(dashboard)/setting/organization/page.tsx
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { tenantsAPI } from '@/lib/api/tenants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Building2, X, ImagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { toast } from 'sonner';

// Form validation schema
const settingsSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  settings: z.object({
    timezone: z.string().optional(),
    language: z.string().optional(),
    date_format: z.string().optional(),
    currency: z.string().optional(),
  }).optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState('');

  // Fetch current tenant
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: tenantsAPI.getMyTenant,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    values: tenant ? {
      name: tenant.name,
      logo_url: tenant.logo_url || '',
      settings: tenant.settings || {},
    } : undefined,
  });

  const mutation = useMutation({
    mutationFn: tenantsAPI.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tenant'] });
      toast.success('Settings updated successfully');
      reset({}, { keepValues: true });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error('Failed to update settings', {
        description: error.response?.data?.detail || error.message,
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    mutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Organization Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your organization&apos;s information and preferences
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Update your organization&apos;s name and branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="ACME Corporation"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Subdomain (Read-only) */}
            <div className="space-y-2">
              <Label>Subdomain</Label>
              <div className="flex gap-2">
                <Input
                  value={tenant?.subdomain || ''}
                  disabled
                  className="bg-gray-50"
                />
                <span className="flex items-center text-sm text-gray-500">
                  .harmony.com
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Subdomain cannot be changed
              </p>
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label>Organization Logo (Optional)</Label>
              <input type="hidden" {...register('logo_url')} />
              <div className="flex items-center gap-4">
                <div className="relative group">
                  {/* Clickable logo area */}
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrlInput(tenant?.logo_url || '');
                      setShowLogoDialog(true);
                    }}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    {tenant?.logo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={tenant.logo_url}
                        alt="Organization logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="w-8 h-8 text-gray-400" />
                    )}
                  </button>
                  {/* X button to remove */}
                  {tenant?.logo_url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Clear the logo URL by submitting the form with empty value
                        mutation.mutate({ ...tenant, logo_url: '' });
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Click to {tenant?.logo_url ? 'change' : 'add'} logo
                </p>
              </div>
              {errors.logo_url && (
                <p className="text-sm text-red-600">{errors.logo_url.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Customize your organization&apos;s regional and display settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  {...register('settings.timezone')}
                  placeholder="Asia/Jakarta"
                />
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  {...register('settings.language')}
                  placeholder="en"
                />
              </div>

              {/* Date Format */}
              <div className="space-y-2">
                <Label htmlFor="date_format">Date Format</Label>
                <Input
                  id="date_format"
                  {...register('settings.date_format')}
                  placeholder="DD/MM/YYYY"
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  {...register('settings.currency')}
                  placeholder="IDR"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Info (Read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Information</CardTitle>
            <CardDescription>
              Current plan and status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Current Plan</Label>
                <p className="text-lg font-semibold capitalize mt-1">
                  {tenant?.tier}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p className="text-lg font-semibold capitalize mt-1">
                  {tenant?.subscription_status}
                </p>
              </div>
            </div>
            <Alert>
              <Building2 className="h-4 w-4" />
              <AlertDescription>
                To upgrade your plan or modify limits, please contact your
                system administrator or super admin.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || mutation.isPending}
          >
            Reset
          </Button>
          <Button type="submit" disabled={!isDirty || mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Logo URL Dialog */}
      <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Organization Logo</DialogTitle>
            <DialogDescription>
              Enter the URL of your organization&apos;s logo image.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="logo-url-input">Logo URL</Label>
              <Input
                id="logo-url-input"
                type="url"
                value={logoUrlInput}
                onChange={(e) => setLogoUrlInput(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            {logoUrlInput && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="w-20 h-20 rounded-lg border flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrlInput}
                    alt="Logo preview"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLogoDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                mutation.mutate({ ...tenant, logo_url: logoUrlInput || '' });
                setShowLogoDialog(false);
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Logo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
