/**
 * Create Tenant Form Component
 * Form for Super Admin to create new tenant with admin user
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { tenantsAPI } from '@/lib/api/tenants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Form validation schema
const createTenantSchema = z.object({
  // Organization Info
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .regex(
      /^[a-z0-9-]+$/,
      'Subdomain can only contain lowercase letters, numbers, and hyphens'
    ),
  domain: z.string().optional(),
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  
  // Subscription
  tier: z.enum(['free', 'basic', 'premium', 'enterprise']),
  max_users: z.number().min(-1).optional(),
  max_branches: z.number().min(-1).optional(),
  max_storage_gb: z.number().min(-1).optional(),
  
  // Admin User
  admin_email: z.string().email('Must be a valid email address'),
  admin_password: z.string().min(8, 'Password must be at least 8 characters'),
  admin_first_name: z.string().min(2, 'First name must be at least 2 characters'),
  admin_last_name: z.string().min(2, 'Last name must be at least 2 characters'),
});

type CreateTenantFormData = z.infer<typeof createTenantSchema>;

// Tier presets
const tierPresets = {
  free: { max_users: 5, max_branches: 1, max_storage_gb: 1 },
  basic: { max_users: 20, max_branches: 5, max_storage_gb: 10 },
  premium: { max_users: 100, max_branches: 20, max_storage_gb: 50 },
  enterprise: { max_users: -1, max_branches: -1, max_storage_gb: 200 },
};

export function CreateTenantForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateTenantFormData>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      tier: 'free',
      max_users: 5,
      max_branches: 1,
      max_storage_gb: 1,
    },
  });

  const selectedTier = watch('tier');

  // Update limits when tier changes
  const handleTierChange = (tier: string) => {
    setValue('tier', tier as 'free' | 'basic' | 'premium' | 'enterprise');
    const preset = tierPresets[tier as keyof typeof tierPresets];
    if (preset) {
      setValue('max_users', preset.max_users);
      setValue('max_branches', preset.max_branches);
      setValue('max_storage_gb', preset.max_storage_gb);
    }
  };

  const mutation = useMutation({
    mutationFn: tenantsAPI.createTenant,
    onSuccess: (data) => {
      // Invalidate tenants and users query cache so lists refresh
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

      setShowSuccess(true);
      toast.success('Tenant created successfully!', {
        description: `${data.name} has been created with subdomain: ${data.subdomain}`,
      });
      setTimeout(() => {
        router.push('/admin/tenants');
      }, 2000);
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error('Failed to create tenant', {
        description: error.response?.data?.detail || error.message,
      });
    },
  });

  const onSubmit = (data: CreateTenantFormData) => {
    mutation.mutate(data);
  };

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Tenant Created!</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Redirecting to tenant list...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Organization Information */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                placeholder="ACME Corporation"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Subdomain */}
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain *</Label>
              <div className="flex gap-2">
                <Input
                  id="subdomain"
                  placeholder="acme"
                  {...register('subdomain')}
                  onChange={(e) => {
                    e.target.value = e.target.value.toLowerCase();
                    register('subdomain').onChange(e);
                  }}
                />
                <span className="flex items-center text-sm text-gray-500">
                  .harmony.com
                </span>
              </div>
              {errors.subdomain && (
                <p className="text-sm text-red-600">
                  {errors.subdomain.message}
                </p>
              )}
            </div>
          </div>

          {/* Custom Domain (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="domain">Custom Domain (Optional)</Label>
            <Input
              id="domain"
              placeholder="acme.com"
              {...register('domain')}
            />
            {errors.domain && (
              <p className="text-sm text-red-600">{errors.domain.message}</p>
            )}
          </div>

          {/* Logo URL (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="logo_url">Logo URL (Optional)</Label>
            <Input
              id="logo_url"
              type="url"
              placeholder="https://example.com/logo.png"
              {...register('logo_url')}
            />
            {errors.logo_url && (
              <p className="text-sm text-red-600">{errors.logo_url.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tier Selection */}
          <div className="space-y-2">
            <Label htmlFor="tier">Subscription Tier *</Label>
            <Select value={selectedTier} onValueChange={handleTierChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Limits */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="max_users">Max Users</Label>
              <Input
                id="max_users"
                type="number"
                {...register('max_users', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_branches">Max Branches</Label>
              <Input
                id="max_branches"
                type="number"
                {...register('max_branches', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_storage_gb">Storage (GB)</Label>
              <Input
                id="max_storage_gb"
                type="number"
                {...register('max_storage_gb', { valueAsNumber: true })}
              />
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Limits are automatically set based on the selected tier. You can
              customize them if needed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Admin User */}
      <Card>
        <CardHeader>
          <CardTitle>Administrator Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="admin_first_name">First Name *</Label>
              <Input
                id="admin_first_name"
                placeholder="John"
                {...register('admin_first_name')}
              />
              {errors.admin_first_name && (
                <p className="text-sm text-red-600">
                  {errors.admin_first_name.message}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="admin_last_name">Last Name *</Label>
              <Input
                id="admin_last_name"
                placeholder="Doe"
                {...register('admin_last_name')}
              />
              {errors.admin_last_name && (
                <p className="text-sm text-red-600">
                  {errors.admin_last_name.message}
                </p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="admin_email">Email Address *</Label>
            <Input
              id="admin_email"
              type="email"
              placeholder="admin@acme.com"
              {...register('admin_email')}
            />
            {errors.admin_email && (
              <p className="text-sm text-red-600">
                {errors.admin_email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="admin_password">Initial Password *</Label>
            <Input
              id="admin_password"
              type="password"
              placeholder="Min 8 chars, uppercase, lowercase, number"
              {...register('admin_password')}
            />
            {errors.admin_password && (
              <p className="text-sm text-red-600">
                {errors.admin_password.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Requires uppercase, lowercase, and number. Admin can change it after first login.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Create Tenant
        </Button>
      </div>
    </form>
  );
}
