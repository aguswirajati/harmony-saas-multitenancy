/**
 * Permission Hooks
 *
 * Two permission scopes:
 * - System permissions (system.*) - For platform management
 * - Tenant permissions (tenant.*) - For tenant administration
 */
import { useAuthStore } from '@/lib/store/authStore';
import { isSystemUser, isTenantUser, SystemRole, TenantRole } from '@/types/auth';

// System permissions (for system users)
export type SystemPermission =
  | 'system.tenants.view'
  | 'system.tenants.create'
  | 'system.tenants.update'
  | 'system.tenants.delete'
  | 'system.tenants.impersonate'
  | 'system.billing.view'
  | 'system.billing.manage'
  | 'system.tiers.view'
  | 'system.tiers.manage'
  | 'system.coupons.view'
  | 'system.coupons.manage'
  | 'system.payment_methods.view'
  | 'system.payment_methods.manage'
  | 'system.users.view'
  | 'system.users.create'
  | 'system.users.update'
  | 'system.users.delete'
  | 'system.tools.access'
  | 'system.settings.view'
  | 'system.settings.manage'
  | 'system.audit.view'
  | 'system.audit.manage'
  | 'system.revenue.view'
  | 'system.usage.view'
  | 'system.usage.manage';

// Tenant permissions (for tenant users)
export type TenantPermission =
  | 'tenant.settings.view'
  | 'tenant.settings.edit'
  | 'tenant.billing.view'
  | 'tenant.billing.manage'
  | 'tenant.account.delete'
  | 'tenant.users.view'
  | 'tenant.users.create'
  | 'tenant.users.update'
  | 'tenant.users.delete'
  | 'tenant.users.invite'
  | 'tenant.users.change_role'
  | 'tenant.branches.view'
  | 'tenant.branches.create'
  | 'tenant.branches.update'
  | 'tenant.branches.delete'
  | 'tenant.audit.view'
  | 'tenant.files.view'
  | 'tenant.files.upload'
  | 'tenant.files.delete'
  | 'tenant.dashboard.view'
  | 'tenant.stats.view'
  | 'tenant.usage.view';

// Legacy permission type (for backward compatibility)
export type Permission =
  | 'users.view'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'users.invite'
  | 'users.change_role'
  | 'branches.view'
  | 'branches.create'
  | 'branches.update'
  | 'branches.delete'
  | 'settings.view'
  | 'settings.update'
  | 'audit.view'
  | 'dashboard.view'
  | 'stats.view'
  | 'files.view'
  | 'files.upload'
  | 'files.delete';

// System role -> permissions mapping
const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Set<SystemPermission>> = {
  admin: new Set([
    'system.tenants.view', 'system.tenants.create', 'system.tenants.update', 'system.tenants.delete', 'system.tenants.impersonate',
    'system.billing.view', 'system.billing.manage',
    'system.tiers.view', 'system.tiers.manage',
    'system.coupons.view', 'system.coupons.manage',
    'system.payment_methods.view', 'system.payment_methods.manage',
    'system.users.view', 'system.users.create', 'system.users.update', 'system.users.delete',
    'system.tools.access',
    'system.settings.view', 'system.settings.manage',
    'system.audit.view', 'system.audit.manage',
    'system.revenue.view',
    'system.usage.view', 'system.usage.manage',
  ]),
  operator: new Set([
    'system.tenants.view',
    'system.billing.view',
    'system.tiers.view',
    'system.coupons.view',
    'system.payment_methods.view',
    'system.users.view',
    'system.settings.view',
    'system.audit.view',
    'system.revenue.view',
    'system.usage.view',
  ]),
};

// Tenant role -> permissions mapping
const TENANT_ROLE_PERMISSIONS: Record<TenantRole, Set<TenantPermission>> = {
  owner: new Set([
    'tenant.settings.view', 'tenant.settings.edit',
    'tenant.billing.view', 'tenant.billing.manage', 'tenant.account.delete',
    'tenant.users.view', 'tenant.users.create', 'tenant.users.update', 'tenant.users.delete', 'tenant.users.invite', 'tenant.users.change_role',
    'tenant.branches.view', 'tenant.branches.create', 'tenant.branches.update', 'tenant.branches.delete',
    'tenant.audit.view',
    'tenant.files.view', 'tenant.files.upload', 'tenant.files.delete',
    'tenant.dashboard.view', 'tenant.stats.view',
    'tenant.usage.view',
  ]),
  admin: new Set([
    'tenant.settings.view', 'tenant.settings.edit',
    'tenant.billing.view', // Can view but not manage
    'tenant.users.view', 'tenant.users.create', 'tenant.users.update', 'tenant.users.delete', 'tenant.users.invite', 'tenant.users.change_role',
    'tenant.branches.view', 'tenant.branches.create', 'tenant.branches.update', 'tenant.branches.delete',
    'tenant.audit.view',
    'tenant.files.view', 'tenant.files.upload', 'tenant.files.delete',
    'tenant.dashboard.view', 'tenant.stats.view',
    'tenant.usage.view',
  ]),
  member: new Set([
    'tenant.settings.view',
    'tenant.users.view',
    'tenant.branches.view',
    'tenant.files.view', 'tenant.files.upload',
    'tenant.dashboard.view',
    'tenant.usage.view',
  ]),
};

// Legacy role -> permissions mapping (for backward compatibility)
const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  super_admin: new Set([
    'users.view', 'users.create', 'users.update', 'users.delete',
    'users.invite', 'users.change_role',
    'branches.view', 'branches.create', 'branches.update', 'branches.delete',
    'settings.view', 'settings.update',
    'audit.view',
    'dashboard.view', 'stats.view',
    'files.view', 'files.upload', 'files.delete',
  ]),
  owner: new Set([
    'users.view', 'users.create', 'users.update', 'users.delete',
    'users.invite', 'users.change_role',
    'branches.view', 'branches.create', 'branches.update', 'branches.delete',
    'settings.view', 'settings.update',
    'audit.view',
    'dashboard.view', 'stats.view',
    'files.view', 'files.upload', 'files.delete',
  ]),
  admin: new Set([
    'users.view', 'users.create', 'users.update', 'users.delete',
    'users.invite', 'users.change_role',
    'branches.view', 'branches.create', 'branches.update', 'branches.delete',
    'settings.view', 'settings.update',
    'audit.view',
    'dashboard.view', 'stats.view',
    'files.view', 'files.upload', 'files.delete',
  ]),
  member: new Set([
    'users.view',
    'branches.view',
    'dashboard.view',
    'files.view', 'files.upload',
  ]),
  staff: new Set([
    'users.view',
    'branches.view',
    'dashboard.view',
    'files.view', 'files.upload',
  ]),
};

/**
 * Check if user has a system permission
 */
export function useSystemPermission(permission: SystemPermission): boolean {
  const { user } = useAuthStore();
  if (!user || !isSystemUser(user) || !user.system_role) return false;
  const perms = SYSTEM_ROLE_PERMISSIONS[user.system_role];
  return perms ? perms.has(permission) : false;
}

/**
 * Check if user has a tenant permission
 */
export function useTenantPermission(permission: TenantPermission): boolean {
  const { user } = useAuthStore();
  if (!user || !isTenantUser(user) || !user.tenant_role) return false;
  const perms = TENANT_ROLE_PERMISSIONS[user.tenant_role];
  return perms ? perms.has(permission) : false;
}

/**
 * Check multiple tenant permissions at once
 */
export function useTenantPermissions(permissions: TenantPermission[]): boolean[] {
  const { user } = useAuthStore();
  if (!user || !isTenantUser(user) || !user.tenant_role) {
    return permissions.map(() => false);
  }
  const perms = TENANT_ROLE_PERMISSIONS[user.tenant_role];
  if (!perms) return permissions.map(() => false);
  return permissions.map(p => perms.has(p));
}

/**
 * Check if user has ANY of the specified tenant permissions
 */
export function useAnyTenantPermission(permissions: TenantPermission[]): boolean {
  const results = useTenantPermissions(permissions);
  return results.some(Boolean);
}

/**
 * Check if user has ALL of the specified tenant permissions
 */
export function useAllTenantPermissions(permissions: TenantPermission[]): boolean {
  const results = useTenantPermissions(permissions);
  return results.every(Boolean);
}

/**
 * Check if user has a legacy permission (backward compatibility)
 */
export function usePermission(permission: Permission): boolean {
  const { user } = useAuthStore();
  if (!user) return false;

  // Map user to legacy role
  let role: string;
  if (isSystemUser(user)) {
    role = 'super_admin';
  } else if (user.tenant_role) {
    role = user.tenant_role;
  } else {
    role = user.role || 'member';
  }

  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.has(permission) : false;
}

/**
 * Check multiple legacy permissions at once
 */
export function usePermissions(...permissions: Permission[]): boolean[] {
  const { user } = useAuthStore();
  if (!user) return permissions.map(() => false);

  // Map user to legacy role
  let role: string;
  if (isSystemUser(user)) {
    role = 'super_admin';
  } else if (user.tenant_role) {
    role = user.tenant_role;
  } else {
    role = user.role || 'member';
  }

  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return permissions.map(() => false);
  return permissions.map((p) => perms.has(p));
}

/**
 * Static permission check (for server-side or non-hook contexts)
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.has(permission) : false;
}

export function hasSystemPermission(systemRole: SystemRole, permission: SystemPermission): boolean {
  const perms = SYSTEM_ROLE_PERMISSIONS[systemRole];
  return perms ? perms.has(permission) : false;
}

export function hasTenantPermission(tenantRole: TenantRole, permission: TenantPermission): boolean {
  const perms = TENANT_ROLE_PERMISSIONS[tenantRole];
  return perms ? perms.has(permission) : false;
}
