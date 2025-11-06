export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
  tenant_id: string;
  default_branch_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}

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
  tenant: Tenant;
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
  };
}

export interface RegisterRequest {
  company_name: string;
  subdomain: string;
  admin_email: string;
  admin_password: string;
  admin_name: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
  tenant: Tenant;
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
  };
}
