/**
 * Tenant Management API Client
 * Phase 6B - Frontend Implementation
 * 
 * This module provides type-safe API methods for:
 * - Super Admin operations (tenant management)
 * - Tenant self-service operations
 */

import { apiClient } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  domain: string | null;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  subscription_status: 'active' | 'trial' | 'expired' | 'cancelled' | 'suspended';
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  features: Record<string, boolean>;
  settings: Record<string, unknown>;
  meta_data: Record<string, unknown>;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  logo_url: string | null;
}

export interface TenantSummary {
  id: string;
  name: string;
  subdomain: string;
  tier: string;
  subscription_status: string;
  is_active: boolean;
  created_at: string;
  user_count: number;
  branch_count: number;
}

export interface TenantStats {
  id: string;
  name: string;
  subdomain: string;
  tier: string;
  subscription_status: string;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  user_count: number;
  branch_count: number;
  storage_used_gb: number;
  users_usage_percent: number;
  branches_usage_percent: number;
  storage_usage_percent: number;
  is_active: boolean;
  is_trial: boolean;
  is_expired: boolean;
  days_until_expiry: number | null;
  created_at: string;
  last_activity_at: string | null;
}

export interface SystemStats {
  total_tenants: number;
  active_tenants: number;
  inactive_tenants: number;
  trial_tenants: number;
  free_tier_count: number;
  basic_tier_count: number;
  premium_tier_count: number;
  enterprise_tier_count: number;
  total_users: number;
  total_branches: number;
  tenants_created_today: number;
  tenants_created_this_week: number;
  tenants_created_this_month: number;
  trials_expiring_soon: number;
  subscriptions_expiring_soon: number;
}

export interface TenantUsage {
  tenant_id: string;
  tenant_name: string;
  tier: string;
  users_current: number;
  users_limit: number;
  users_available: number;
  users_percent: number;
  branches_current: number;
  branches_limit: number;
  branches_available: number;
  branches_percent: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  storage_available_gb: number;
  storage_percent: number;
  is_user_limit_reached: boolean;
  is_branch_limit_reached: boolean;
  is_storage_limit_reached: boolean;
  can_upgrade: boolean;
  next_tier: string | null;
}

export interface TierInfo {
  tier: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  features: string[];
  is_recommended: boolean;
}

export interface CreateTenantData {
  name: string;
  subdomain: string;
  domain?: string;
  tier: string;
  admin_email: string;
  admin_password: string;
  admin_first_name: string;
  admin_last_name: string;
  max_users?: number;
  max_branches?: number;
  max_storage_gb?: number;
  logo_url?: string;
}

export interface UpdateTenantData {
  name?: string;
  domain?: string;
  logo_url?: string;
  settings?: Record<string, unknown>;
  meta_data?: Record<string, unknown>;
}

export interface UpdateSubscriptionData {
  tier: string;
  subscription_status: string;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  trial_ends_at?: string;
  subscription_ends_at?: string;
}

export interface UpdateFeaturesData {
  features: Record<string, boolean>;
}

export interface UpdateStatusData {
  is_active: boolean;
  reason?: string;
}

export interface TenantListParams {
  skip?: number;
  limit?: number;
  tier?: string;
  status?: string;
  is_active?: boolean;
  search?: string;
}

export interface TenantListResponse {
  items: TenantSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================================
// API CLIENT
// ============================================================================

export const tenantsAPI = {
  // ========================================================================
  // SUPER ADMIN OPERATIONS
  // ========================================================================

  /**
   * Get system-wide statistics (Super Admin only)
   */
  async getSystemStats(): Promise<SystemStats> {
    const response = await apiClient.get<SystemStats>('/admin/tenants/stats');
    return response;
  },

  /**
   * List all tenants with filters and pagination (Super Admin only)
   */
  async listTenants(params?: TenantListParams): Promise<TenantListResponse> {
    const response = await apiClient.get<TenantListResponse>('/admin/tenants/', {
      params,
    });
    return response;
  },

  /**
   * Get tenant details by ID (Super Admin only)
   */
  async getTenant(tenantId: string): Promise<Tenant> {
    const response = await apiClient.get<Tenant>(`/admin/tenants/${tenantId}`);
    return response;
  },

  /**
   * Get tenant statistics by ID (Super Admin only)
   */
  async getTenantStats(tenantId: string): Promise<TenantStats> {
    const response = await apiClient.get<TenantStats>(
      `/admin/tenants/${tenantId}/stats`
    );
    return response;
  },

  /**
   * Get tenant by subdomain (Super Admin only)
   */
  async getTenantBySubdomain(subdomain: string): Promise<Tenant> {
    const response = await apiClient.get<Tenant>(
      `/admin/tenants/subdomain/${subdomain}`
    );
    return response;
  },

  /**
   * Create new tenant (Super Admin only)
   */
  async createTenant(data: CreateTenantData): Promise<Tenant> {
    const response = await apiClient.post<Tenant>('/admin/tenants/', data);
    return response;
  },

  /**
   * Update tenant basic information (Super Admin only)
   */
  async updateTenant(
    tenantId: string,
    data: UpdateTenantData
  ): Promise<Tenant> {
    const response = await apiClient.put<Tenant>(
      `/admin/tenants/${tenantId}`,
      data
    );
    return response;
  },

  /**
   * Update tenant subscription (Super Admin only)
   */
  async updateSubscription(
    tenantId: string,
    data: UpdateSubscriptionData
  ): Promise<Tenant> {
    const response = await apiClient.put<Tenant>(
      `/admin/tenants/${tenantId}/subscription`,
      data
    );
    return response;
  },

  /**
   * Update tenant features (Super Admin only)
   */
  async updateFeatures(
    tenantId: string,
    data: UpdateFeaturesData
  ): Promise<Tenant> {
    const response = await apiClient.put<Tenant>(
      `/admin/tenants/${tenantId}/features`,
      data
    );
    return response;
  },

  /**
   * Update tenant status (activate/deactivate) (Super Admin only)
   */
  async updateStatus(
    tenantId: string,
    data: UpdateStatusData
  ): Promise<Tenant> {
    const response = await apiClient.patch<Tenant>(
      `/admin/tenants/${tenantId}/status`,
      data
    );
    return response;
  },

  /**
   * Delete tenant (Super Admin only)
   */
  async deleteTenant(tenantId: string): Promise<void> {
    await apiClient.delete(`/admin/tenants/${tenantId}`);
  },

  // ========================================================================
  // TENANT SELF-SERVICE OPERATIONS
  // ========================================================================

  /**
   * Get current tenant information
   */
  async getMyTenant(): Promise<Tenant> {
    const response = await apiClient.get<Tenant>('/tenant/');
    return response;
  },

  /**
   * Get current tenant usage statistics
   */
  async getUsage(): Promise<TenantUsage> {
    const response = await apiClient.get<TenantUsage>('/tenant/usage');
    return response;
  },

  /**
   * Get available subscription tiers
   */
  async getTiers(): Promise<{ tiers: TierInfo[]; current_tier: string }> {
    const response = await apiClient.get<{
      tiers: TierInfo[];
      current_tier: string;
    }>('/tenant/tiers');
    return response;
  },

  /**
   * Check user limit
   */
  async checkUserLimit(): Promise<{
    can_add: boolean;
    current_count: number;
    limit: number;
    available: number;
    percentage: number;
  }> {
    const response = await apiClient.get<{
        can_add: boolean;
        current_count: number;
        limit: number;
        available: number;
        percentage: number;
    }>('/tenant/limits/users');
    return response;
  },

  /**
   * Check branch limit
   */
  async checkBranchLimit(): Promise<{
    can_add: boolean;
    current_count: number;
    limit: number;
    available: number;
    percentage: number;
  }> {
    const response = await apiClient.get<{
        can_add: boolean;
        current_count: number;
        limit: number;
        available: number;
        percentage: number;
    }>('/tenant/limits/branches');
    return response;
  },

  /**
   * Check feature access
   */
  async checkFeature(featureName: string): Promise<{
    feature_name: string;
    enabled: boolean;
  }> {
    const response = await apiClient.get<{
        feature_name: string;
        enabled: boolean;
    }>(`/tenant/features/${featureName}`);
    return response;
  },

  /**
   * Update tenant settings (self-service)
   */
  async updateSettings(data: {
    name?: string;
    logo_url?: string;
    settings?: Record<string, unknown>;
  }): Promise<Tenant> {
    const response = await apiClient.put<Tenant>('/tenant/settings', data);
    return response;
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get tier color class for badges
 */
export function getTierColor(tier: string): string {
  switch (tier) {
    case 'free':
      return 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800';
    case 'basic':
      return 'text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50';
    case 'premium':
      return 'text-purple-700 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/50';
    case 'enterprise':
      return 'text-amber-700 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50';
    default:
      return 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800';
  }
}

/**
 * Get status color class for badges
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-green-700 dark:text-green-200 bg-green-100 dark:bg-green-900/50';
    case 'trial':
      return 'text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50';
    case 'expired':
      return 'text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50';
    case 'cancelled':
      return 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800';
    case 'suspended':
      return 'text-orange-700 dark:text-orange-200 bg-orange-100 dark:bg-orange-900/50';
    default:
      return 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800';
  }
}

/**
 * Get usage color based on percentage
 */
export function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-600';
  if (percentage >= 70) return 'text-yellow-600';
  return 'text-green-600';
}

/**
 * Format tier display name
 */
export function formatTierName(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Check if limit is reached
 */
export function isLimitReached(current: number, limit: number): boolean {
  return current >= limit;
}

/**
 * Calculate usage percentage
 */
export function calculateUsagePercent(current: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min((current / limit) * 100, 100);
}