import { useAuthStore } from '@/lib/store/authStore';

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
  | 'stats.view';

const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  super_admin: new Set([
    'users.view', 'users.create', 'users.update', 'users.delete',
    'users.invite', 'users.change_role',
    'branches.view', 'branches.create', 'branches.update', 'branches.delete',
    'settings.view', 'settings.update',
    'audit.view',
    'dashboard.view', 'stats.view',
  ]),
  admin: new Set([
    'users.view', 'users.create', 'users.update', 'users.delete',
    'users.invite', 'users.change_role',
    'branches.view', 'branches.create', 'branches.update', 'branches.delete',
    'settings.view', 'settings.update',
    'audit.view',
    'dashboard.view', 'stats.view',
  ]),
  staff: new Set([
    'users.view',
    'branches.view',
    'dashboard.view',
  ]),
};

export function usePermission(permission: Permission): boolean {
  const { user } = useAuthStore();
  if (!user) return false;
  const perms = ROLE_PERMISSIONS[user.role];
  return perms ? perms.has(permission) : false;
}

export function usePermissions(...permissions: Permission[]): boolean[] {
  const { user } = useAuthStore();
  if (!user) return permissions.map(() => false);
  const perms = ROLE_PERMISSIONS[user.role];
  if (!perms) return permissions.map(() => false);
  return permissions.map((p) => perms.has(p));
}

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.has(permission) : false;
}
