export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  is_hq: boolean;

  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country: string;
  phone?: string;
  email?: string;

  latitude?: number;
  longitude?: number;

  timezone: string;
  currency: string;

  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BranchCreate {
  name: string;
  code: string;
  is_hq?: boolean;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  currency?: string;
}

export interface BranchUpdate {
  name?: string;
  code?: string;
  is_hq?: boolean;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  currency?: string;
  is_active?: boolean;
}

export interface BranchListResponse {
  branches: Branch[];
  total: number;
  page: number;
  page_size: number;
}
