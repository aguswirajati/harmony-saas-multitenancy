'use client';

import { Crown } from 'lucide-react';
import SubscriptionsOverview from './SubscriptionsOverview';

export default function SubscriptionsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Crown className="w-6 h-6" />
          Subscriptions
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Overview of tenant subscriptions and distribution
        </p>
      </div>

      <SubscriptionsOverview embedded />
    </div>
  );
}
