'use client';

import { usePathname } from 'next/navigation';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo } from './Logo';
import { DevModeButton } from './DevModeButton';
import { NotificationDropdown } from './NotificationDropdown';
import { UserDropdown } from './UserDropdown';
import {
  adminRouteMeta,
  dashboardRouteMeta,
  getRouteMeta,
} from './route-meta';

interface TopNavBarProps {
  variant: 'admin' | 'dashboard';
  tenantName?: string;
}

export function TopNavBar({ variant, tenantName }: TopNavBarProps) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();

  const routeMap = variant === 'admin' ? adminRouteMeta : dashboardRouteMeta;
  const meta = getRouteMeta(pathname, routeMap);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* Left section: Sidebar trigger and logo */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {isMobile && (
          <Logo
            variant={variant}
            tenantName={tenantName}
            collapsed={false}
          />
        )}
      </div>

      {/* Center section: Page title and description */}
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        {!isMobile && meta && (
          <div className="flex items-baseline gap-2 overflow-hidden">
            <h1 className="text-lg font-semibold truncate">{meta.title}</h1>
            {meta.description && (
              <span className="text-sm text-muted-foreground truncate hidden md:inline">
                {meta.description}
              </span>
            )}
          </div>
        )}
        {isMobile && meta && (
          <h1 className="text-lg font-semibold truncate">{meta.title}</h1>
        )}
      </div>

      {/* Right section: Actions */}
      <div className="flex items-center gap-1">
        {variant === 'admin' && <DevModeButton />}
        <ThemeToggle />
        <NotificationDropdown />
        <UserDropdown
          variant={variant}
          showName={!isMobile}
        />
      </div>
    </header>
  );
}
