'use client';

import { useAuthStore } from '@/lib/store/authStore';
import { useDevModeStore } from '@/lib/store/devModeStore';
import { useState } from 'react';
import { Bug, X, ChevronUp, ChevronDown } from 'lucide-react';

export function DevToolbar() {
  const { user, tenant } = useAuthStore();
  const { devMode } = useDevModeStore();
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Only show when dev mode is enabled and user is super_admin
  if (!devMode || !user || user.role !== 'super_admin') {
    return null;
  }

  // Minimized state - just a small indicator in corner
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-[9999] bg-amber-500 text-black px-3 py-1.5 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 shadow-lg hover:bg-amber-400 transition-colors"
      >
        <Bug size={14} />
        DEV MODE
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-zinc-900 text-zinc-100 text-xs font-mono rounded-lg shadow-xl border border-zinc-700 max-w-sm">
      {expanded && (
        <div className="px-4 py-3 border-b border-zinc-700 space-y-2">
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
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-amber-500 text-black px-2 py-0.5 rounded font-bold">
            <Bug size={12} />
            <span>DEV MODE ON</span>
          </div>
          <span className="text-zinc-400">|</span>
          <span className={
            user?.role === 'super_admin'
              ? 'text-red-400'
              : user?.role === 'admin'
              ? 'text-yellow-400'
              : 'text-green-400'
          }>
            {user?.role || 'guest'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-zinc-700 rounded"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            onClick={() => setMinimized(true)}
            className="p-1 hover:bg-zinc-700 rounded"
            title="Minimize"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
