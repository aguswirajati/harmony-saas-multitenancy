/**
 * Authentication Types
 *
 * User Architecture:
 * - System Users (tenant_id=null): system_role = 'admin' | 'operator'
 * - Tenant Users (tenant_id=UUID): tenant_role = 'owner' | 'admin' | 'member'
 */

export type SystemRole = 'admin' | 'operator';
export type TenantRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  tenant_id: string | null;

  // New role fields
  system_role: SystemRole | null;
  tenant_role: TenantRole | null;
  business_role: string | null;

  // Legacy field for backward compatibility
  role: string;
  is_super_admin: boolean;

  default_branch_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}

// Helper functions
export const isSystemUser = (user: User | null): boolean => {
  return user !== null && user.tenant_id === null;
};

export const isTenantUser = (user: User | null): boolean => {
  return user !== null && user.tenant_id !== null;
};

export const isSystemAdmin = (user: User | null): boolean => {
  return isSystemUser(user) && user?.system_role === 'admin';
};

export const isSystemOperator = (user: User | null): boolean => {
  return isSystemUser(user) && user?.system_role === 'operator';
};

export const isTenantOwner = (user: User | null): boolean => {
  return isTenantUser(user) && user?.tenant_role === 'owner';
};

export const isTenantAdmin = (user: User | null): boolean => {
  return isTenantUser(user) && user?.tenant_role === 'admin';
};

export const isTenantMember = (user: User | null): boolean => {
  return isTenantUser(user) && user?.tenant_role === 'member';
};

export const canManageBilling = (user: User | null): boolean => {
  return isTenantOwner(user);
};

export const canDeleteAccount = (user: User | null): boolean => {
  return isTenantOwner(user);
};

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  tier: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenant_subdomain?: string;
}

export interface LoginResponse {
  user: User;
  tenant: Tenant | null; // System users don't have a tenant
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
  };
}

export interface RegisterRequest {
  admin_email: string;
  admin_password: string;
  admin_name: string;
  // Optional - auto-generated if not provided
  company_name?: string;
  subdomain?: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
  tenant: Tenant | null;
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
  };
}
