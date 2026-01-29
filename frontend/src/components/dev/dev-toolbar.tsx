'use client';

import { useAuthStore } from '@/lib/store/authStore';
import { useState } from 'react';
import { Bug, X, ChevronUp } from 'lucide-react';

export function DevToolbar() {
  const { user, tenant } = useAuthStore();
  const [expanded, setExpanded] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-zinc-900 text-zinc-100 text-xs font-mono">
      {expanded && (
        <div className="px-4 py-2 border-t border-zinc-700 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-zinc-400">User:</span>{' '}
            {user?.email || 'Not logged in'}
          </div>
          <div>
            <span className="text-zinc-400">Role:</span>{' '}
            <span className={
              user?.role === 'super_admin'
                ? 'text-red-400'
                : user?.role === 'admin'
                ? 'text-yellow-400'
                : 'text-green-400'
            }>
              {user?.role || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">Tenant:</span>{' '}
            {tenant?.name || 'None'}{' '}
            {tenant?.subdomain && (
              <span className="text-zinc-500">({tenant.subdomain})</span>
            )}
          </div>
          <div>
            <span className="text-zinc-400">Tier:</span>{' '}
            {tenant?.tier || 'N/A'}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-zinc-700">
        <div className="flex items-center space-x-2">
          <Bug size={14} className="text-green-400" />
          <span className="text-green-400 font-semibold">DEV</span>
          <span className="text-zinc-500">|</span>
          <span>{user?.role || 'unauthenticated'}</span>
          {tenant && (
            <>
              <span className="text-zinc-500">|</span>
              <span>{tenant.subdomain}</span>
            </>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-zinc-700 rounded"
        >
          {expanded ? <X size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
    </div>
  );
}
