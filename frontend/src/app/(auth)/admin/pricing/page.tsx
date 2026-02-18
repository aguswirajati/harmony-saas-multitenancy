'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, CreditCard } from 'lucide-react';

// Import the content from existing pages
import TiersPage from '../tiers/page';
import PaymentMethodsPage from '../payment-methods/page';

export default function PricingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'tiers';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/admin/pricing?tab=${value}`, { scroll: false });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Pricing Configuration
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage subscription tiers and payment methods
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="tiers" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Tiers
          </TabsTrigger>
          <TabsTrigger value="payment-methods" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Payment Methods
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="mt-0">
          <TiersPage embedded />
        </TabsContent>

        <TabsContent value="payment-methods" className="mt-0">
          <PaymentMethodsPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
