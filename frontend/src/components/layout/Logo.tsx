'use client';

import { Shield, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant: 'admin' | 'dashboard';
  tenantName?: string;
  collapsed?: boolean;
  className?: string;
}

export function Logo({ variant, tenantName, collapsed, className }: LogoProps) {
  if (variant === 'admin') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-md">
          <Shield className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">
              Harmony
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              Admin
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
        <Building2 className="h-4 w-4" />
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight truncate max-w-[140px]">
            {tenantName || 'Harmony'}
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            Dashboard
          </span>
        </div>
      )}
    </div>
  );
}
