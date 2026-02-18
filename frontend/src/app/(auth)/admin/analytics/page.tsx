'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, DollarSign, Activity, TrendingUp } from 'lucide-react';

import AdminRevenuePage from '../revenue/page';
import AdminUsagePage from '../usage/page';
import AdminStatsPage from '../stats/page';

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'revenue';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/admin/analytics?tab=${value}`, { scroll: false });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Analytics
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Revenue metrics, usage tracking, and system statistics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-0">
          <AdminRevenuePage embedded />
        </TabsContent>

        <TabsContent value="usage" className="mt-0">
          <AdminUsagePage embedded />
        </TabsContent>

        <TabsContent value="statistics" className="mt-0">
          <AdminStatsPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
