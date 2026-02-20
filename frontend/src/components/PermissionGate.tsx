'use client';

import { ReactNode } from 'react';
import {
  useTenantPermission,
  useSystemPermission,
  useAnyTenantPermission,
  useAllTenantPermissions,
  TenantPermission,
  SystemPermission,
} from '@/hooks/use-permission';

interface PermissionGateProps {
  children: ReactNode;
  /** Fallback content when permission is denied */
  fallback?: ReactNode;
}

interface TenantPermissionGateProps extends PermissionGateProps {
  permission: TenantPermission;
}

interface SystemPermissionGateProps extends PermissionGateProps {
  permission: SystemPermission;
}

/**
 * Conditionally render children based on tenant permission
 *
 * Usage:
 * <TenantPermissionGate permission="tenant.users.create">
 *   <Button>Create User</Button>
 * </TenantPermissionGate>
 */
export function TenantPermissionGate({
  permission,
  children,
  fallback = null
}: TenantPermissionGateProps) {
  const hasPermission = useTenantPermission(permission);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

/**
 * Conditionally render children based on system permission
 *
 * Usage:
 * <SystemPermissionGate permission="system.tenants.create">
 *   <Button>Create Tenant</Button>
 * </SystemPermissionGate>
 */
export function SystemPermissionGate({
  permission,
  children,
  fallback = null
}: SystemPermissionGateProps) {
  const hasPermission = useSystemPermission(permission);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

/**
 * Require any of the specified tenant permissions
 */
interface AnyTenantPermissionGateProps extends PermissionGateProps {
  permissions: TenantPermission[];
}

export function AnyTenantPermissionGate({
  permissions,
  children,
  fallback = null
}: AnyTenantPermissionGateProps) {
  const hasAny = useAnyTenantPermission(permissions);
  return hasAny ? <>{children}</> : <>{fallback}</>;
}

/**
 * Require all of the specified tenant permissions
 */
interface AllTenantPermissionsGateProps extends PermissionGateProps {
  permissions: TenantPermission[];
}

export function AllTenantPermissionsGate({
  permissions,
  children,
  fallback = null
}: AllTenantPermissionsGateProps) {
  const hasAll = useAllTenantPermissions(permissions);
  return hasAll ? <>{children}</> : <>{fallback}</>;
}
