// Route metadata configuration for page titles and descriptions

export interface RouteMeta {
  title: string;
  description?: string;
}

// Admin routes
export const adminRouteMeta: Record<string, RouteMeta> = {
  '/admin': {
    title: 'Dashboard',
    description: 'System overview and statistics',
  },
  '/admin/tenants': {
    title: 'Tenants',
    description: 'Manage tenant organizations',
  },
  '/admin/users': {
    title: 'All Users',
    description: 'Manage system users',
  },
  '/admin/subscriptions': {
    title: 'Subscriptions',
    description: 'Manage subscription requests',
  },
  '/admin/pricing': {
    title: 'Pricing',
    description: 'Configure subscription tiers',
  },
  '/admin/billing': {
    title: 'Billing',
    description: 'Transaction command center',
  },
  '/admin/analytics': {
    title: 'Analytics',
    description: 'Revenue and usage analytics',
  },
  '/admin/logs': {
    title: 'Audit Logs',
    description: 'System activity logs',
  },
  '/admin/tools': {
    title: 'Developer Tools',
    description: 'Development utilities',
  },
  '/admin/coupons': {
    title: 'Coupons',
    description: 'Manage discount codes',
  },
};

// Dashboard routes
export const dashboardRouteMeta: Record<string, RouteMeta> = {
  '/dashboard': {
    title: 'Dashboard',
    description: 'Overview and quick actions',
  },
  '/branches': {
    title: 'Branches',
    description: 'Manage branch locations',
  },
  '/users': {
    title: 'Users',
    description: 'Manage team members',
  },
  '/usage': {
    title: 'Usage',
    description: 'API usage and quotas',
  },
  '/settings': {
    title: 'Settings',
    description: 'Organization settings',
  },
  '/upgrade': {
    title: 'Upgrade',
    description: 'Subscription plans',
  },
  '/audit-logs': {
    title: 'Audit Logs',
    description: 'Activity history',
  },
  '/profile': {
    title: 'Profile',
    description: 'Your account settings',
  },
};

/**
 * Get route metadata based on pathname.
 * Matches exact paths first, then falls back to prefix matching for dynamic routes.
 */
export function getRouteMeta(
  pathname: string,
  routeMap: Record<string, RouteMeta>
): RouteMeta | null {
  // Try exact match first
  if (routeMap[pathname]) {
    return routeMap[pathname];
  }

  // Try prefix matching for dynamic routes (e.g., /admin/tenants/123)
  const segments = pathname.split('/').filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const prefix = '/' + segments.slice(0, i).join('/');
    if (routeMap[prefix]) {
      return routeMap[prefix];
    }
  }

  return null;
}
