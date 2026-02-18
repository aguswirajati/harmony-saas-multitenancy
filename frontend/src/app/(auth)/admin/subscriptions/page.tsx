'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, ArrowUpCircle } from 'lucide-react';

// Import the content from existing pages
import SubscriptionsOverview from './SubscriptionsOverview';
import UpgradeRequestsPage from '../upgrade-requests/page';

export default function SubscriptionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/admin/subscriptions?tab=${value}`, { scroll: false });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Crown className="w-6 h-6" />
          Subscriptions
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage subscription tiers and upgrade requests
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Crown className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="upgrade-requests" className="flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4" />
            Upgrade Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <SubscriptionsOverview embedded />
        </TabsContent>

        <TabsContent value="upgrade-requests" className="mt-0">
          <UpgradeRequestsPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
