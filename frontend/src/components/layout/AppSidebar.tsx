'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  ScrollText,
  Activity,
  Shield,
  Crown,
  Layers,
  Receipt,
  BarChart3,
  Wrench,
  Database,
  Bug,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Logo } from './Logo';
import { useDevModeStore } from '@/lib/store/devModeStore';
import { useTenantPermission, TenantPermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  permission?: TenantPermission;
}

interface AppSidebarProps {
  variant: 'admin' | 'dashboard';
  tenantName?: string;
}

// Admin navigation items
const adminBaseNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Tenants', href: '/admin/tenants', icon: Building2 },
  { name: 'All Users', href: '/admin/users', icon: Users },
  { name: 'Subscriptions', href: '/admin/subscriptions', icon: Crown },
  { name: 'Pricing', href: '/admin/pricing', icon: Layers },
  { name: 'Billing', href: '/admin/billing', icon: Receipt },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Permissions', href: '/admin/permissions', icon: KeyRound },
  { name: 'Audit Logs', href: '/admin/logs', icon: Shield },
];

const adminDevNavigation: NavItem[] = [
  { name: 'Developer Tools', href: '/admin/tools', icon: Wrench },
];

// Dashboard navigation items with permission requirements
const dashboardNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'tenant.dashboard.view' },
  { name: 'Branches', href: '/branches', icon: Building2, permission: 'tenant.branches.view' },
  { name: 'Users', href: '/users', icon: Users, permission: 'tenant.users.view' },
  { name: 'Usage', href: '/usage', icon: Activity, permission: 'tenant.usage.view' },
  { name: 'Settings', href: '/settings', icon: Settings, permission: 'tenant.settings.view' },
  { name: 'Audit Logs', href: '/audit-logs', icon: ScrollText, permission: 'tenant.audit.view' },
];

function isActiveLink(pathname: string, href: string) {
  if (href === '/admin' || href === '/dashboard') {
    return pathname === href;
  }
  if (pathname === href) {
    return true;
  }
  return pathname.startsWith(href + '/');
}

export function AppSidebar({ variant, tenantName }: AppSidebarProps) {
  const pathname = usePathname();
  const { state, setOpenMobile } = useSidebar();
  const { devMode } = useDevModeStore();
  const collapsed = state === 'collapsed';

  // Check all dashboard permissions
  const canViewDashboard = useTenantPermission('tenant.dashboard.view');
  const canViewBranches = useTenantPermission('tenant.branches.view');
  const canViewUsers = useTenantPermission('tenant.users.view');
  const canViewUsage = useTenantPermission('tenant.usage.view');
  const canViewSettings = useTenantPermission('tenant.settings.view');
  const canViewAudit = useTenantPermission('tenant.audit.view');

  // Permission lookup for filtering
  const permissionMap: Record<TenantPermission, boolean> = {
    'tenant.dashboard.view': canViewDashboard,
    'tenant.branches.view': canViewBranches,
    'tenant.users.view': canViewUsers,
    'tenant.usage.view': canViewUsage,
    'tenant.settings.view': canViewSettings,
    'tenant.audit.view': canViewAudit,
    // Other permissions not used in sidebar
    'tenant.settings.edit': false,
    'tenant.billing.view': false,
    'tenant.billing.manage': false,
    'tenant.account.delete': false,
    'tenant.users.create': false,
    'tenant.users.update': false,
    'tenant.users.delete': false,
    'tenant.users.invite': false,
    'tenant.users.change_role': false,
    'tenant.branches.create': false,
    'tenant.branches.update': false,
    'tenant.branches.delete': false,
    'tenant.files.view': false,
    'tenant.files.upload': false,
    'tenant.files.delete': false,
    'tenant.stats.view': false,
  };

  // Get navigation items based on variant
  let navigation: NavItem[];
  if (variant === 'admin') {
    navigation = devMode
      ? [...adminBaseNavigation, ...adminDevNavigation]
      : adminBaseNavigation;
  } else {
    // Filter dashboard navigation based on permissions
    navigation = dashboardNavigation.filter(item => {
      if (!item.permission) return true;
      return permissionMap[item.permission];
    });
  }

  const handleNavClick = () => {
    // Close mobile sidebar on navigation
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header with logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={variant === 'admin' ? '/admin' : '/dashboard'}>
                <Logo
                  variant={variant}
                  tenantName={tenantName}
                  collapsed={collapsed}
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {variant === 'admin' ? 'System' : 'Navigation'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const active = isActiveLink(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.name}
                    >
                      <Link href={item.href} onClick={handleNavClick}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with system status (admin only) */}
      {variant === 'admin' && !collapsed && (
        <SidebarFooter>
          <div className="space-y-3 p-2 rounded-lg bg-sidebar-accent/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              <span>System: Online</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bug className="h-3.5 w-3.5" />
                <span>Dev Mode</span>
              </div>
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  devMode ? 'bg-amber-500' : 'bg-muted-foreground/30'
                )}
              />
            </div>
          </div>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
}
