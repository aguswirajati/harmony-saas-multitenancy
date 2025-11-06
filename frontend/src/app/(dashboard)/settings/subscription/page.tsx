/**
 * Subscription & Usage Settings Page
 * View current subscription, usage, and available tiers
 * 
 * Location: app/(dashboard)/setting/subscription/page.tsx
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { tenantsAPI } from '@/lib/api/tenants';
import { TenantUsageCard } from '@/components/tenant/TenantUsageCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Check,
  Crown,
  Mail,
  ArrowRight,
} from 'lucide-react';

export default function SubscriptionSettingsPage() {
  const { data: tiersData, isLoading: tiersLoading } = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: tenantsAPI.getTiers,
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: tenantsAPI.getMyTenant,
  });

  const isLoading = tiersLoading || tenantLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const currentTier = tiersData?.current_tier || 'free';
  const tiers = tiersData?.tiers || [];

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Subscription & Usage
        </h1>
        <p className="text-gray-500">
          View your current plan, usage, and upgrade options
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Usage Card */}
        <div className="lg:col-span-1">
          <TenantUsageCard />
        </div>

        {/* Right Column: Current Plan & Available Tiers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Your active subscription tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-purple-600" />
                    <h3 className="text-2xl font-bold capitalize">
                      {currentTier}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    {tenant?.subscription_status === 'active'
                      ? 'Active subscription'
                      : tenant?.subscription_status === 'trial'
                      ? 'Trial period'
                      : 'Subscription ' + tenant?.subscription_status}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-purple-100 text-purple-700"
                >
                  {tenant?.subscription_status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Available Plans */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
            <div className="grid gap-4">
              {tiers.map((tier) => {
                const isCurrent = tier.tier === currentTier;
                const isRecommended = tier.is_recommended;

                return (
                  <Card
                    key={tier.tier}
                    className={
                      isCurrent
                        ? 'border-purple-200 bg-purple-50'
                        : isRecommended
                        ? 'border-blue-200'
                        : ''
                    }
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Tier Header */}
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold">
                              {tier.display_name}
                            </h3>
                            {isCurrent && (
                              <Badge className="bg-purple-600">Current</Badge>
                            )}
                            {isRecommended && !isCurrent && (
                              <Badge className="bg-blue-600">Recommended</Badge>
                            )}
                          </div>

                          {/* Pricing */}
                          <div className="mb-4">
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold">
                                ${tier.price_monthly}
                              </span>
                              <span className="text-sm text-gray-500">
                                /month
                              </span>
                              {tier.price_yearly > 0 && (
                                <span className="text-sm text-gray-500">
                                  or ${tier.price_yearly}/year
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Features */}
                          <ul className="space-y-2 mb-4">
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-600" />
                              <span>
                                {tier.max_users === -1
                                  ? 'Unlimited users'
                                  : `Up to ${tier.max_users} users`}
                              </span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-600" />
                              <span>
                                {tier.max_branches === -1
                                  ? 'Unlimited branches'
                                  : `Up to ${tier.max_branches} branches`}
                              </span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-600" />
                              <span>{tier.max_storage_gb} GB storage</span>
                            </li>
                            {tier.features.slice(0, 3).map((feature, idx) => (
                              <li
                                key={idx}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Action */}
                        <div>
                          {isCurrent ? (
                            <Button variant="outline" disabled>
                              Current Plan
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                // Open contact form or upgrade modal
                                alert(
                                  `To upgrade to ${tier.display_name}, please contact your administrator.`
                                );
                              }}
                            >
                              Upgrade
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Contact for Custom Plan */}
          <Card className="bg-linear-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <Mail className="h-8 w-8 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">
                    Need a Custom Plan?
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Contact our sales team for custom enterprise solutions with
                    tailored pricing and features.
                  </p>
                  <Button size="sm" variant="outline">
                    Contact Sales
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
