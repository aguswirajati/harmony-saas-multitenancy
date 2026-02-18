'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, Ticket } from 'lucide-react';

import BillingTransactions from './BillingTransactions';
import AdminCouponsPage from '../coupons/page';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'transactions';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/admin/billing?tab=${value}`, { scroll: false });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-6 h-6" />
          Billing
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage billing transactions and promotional coupons
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="coupons" className="flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Coupons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-0">
          <BillingTransactions />
        </TabsContent>

        <TabsContent value="coupons" className="mt-0">
          <AdminCouponsPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
