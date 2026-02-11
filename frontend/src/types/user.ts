export interface User {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  default_branch_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface UserWithBranch extends User {
  branch_name?: string;
  branch_code?: string;
  tenant_name?: string;
  tenant_subdomain?: string;
}

export interface UserCreate {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: string;
  default_branch_id?: string;
}

export interface UserUpdate {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  default_branch_id?: string | null;
  role?: string;
  is_active?: boolean;
}

export interface UserListResponse {
  users: UserWithBranch[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserChangePassword {
  current_password: string;
  new_password: string;
}
