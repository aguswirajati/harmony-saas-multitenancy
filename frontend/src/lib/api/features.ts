/**
 * Features API
 *
 * API client for feature flag endpoints.
 */
import { apiClient } from './client';
import type {
  TenantFeaturesResponse,
  FeatureStatus,
  AllFeaturesResponse,
  TierFeatureMatrix,
} from '@/types/features';

/**
 * Features API for tenant users
 */
export const featuresAPI = {
  /**
   * Get all enabled features for the current tenant
   */
  list: async (): Promise<TenantFeaturesResponse> => {
    return apiClient.get<TenantFeaturesResponse>('/features');
  },

  /**
   * Check if a specific feature is enabled
   */
  check: async (featureCode: string): Promise<boolean> => {
    const response = await apiClient.get<{ code: string; enabled: boolean }>(
      `/features/check/${featureCode}`
    );
    return response.enabled;
  },

  /**
   * Get all features with their status for the current tenant
   */
  detailed: async (): Promise<FeatureStatus[]> => {
    return apiClient.get<FeatureStatus[]>('/features/detailed');
  },
};

/**
 * Admin Features API
 */
export const featuresAdminAPI = {
  /**
   * Get all available features grouped by module
   */
  listAll: async (): Promise<AllFeaturesResponse> => {
    return apiClient.get<AllFeaturesResponse>('/admin/features');
  },

  /**
   * Get tier-feature matrix
   */
  getMatrix: async (): Promise<TierFeatureMatrix> => {
    return apiClient.get<TierFeatureMatrix>('/admin/features/matrix');
  },

  /**
   * Update features for a tier
   */
  updateTierFeatures: async (
    tierCode: string,
    features: string[]
  ): Promise<{ message: string; features_count: number }> => {
    return apiClient.put(`/admin/features/tiers/${tierCode}`, { features });
  },

  /**
   * Get features for a specific tenant
   */
  getTenantFeatures: async (tenantId: string): Promise<FeatureStatus[]> => {
    return apiClient.get<FeatureStatus[]>(`/admin/features/tenants/${tenantId}`);
  },

  /**
   * Override a feature for a tenant
   */
  overrideTenantFeature: async (
    tenantId: string,
    featureCode: string,
    action: 'enable' | 'disable'
  ): Promise<{ message: string }> => {
    return apiClient.post(`/admin/features/tenants/${tenantId}/override`, {
      feature_code: featureCode,
      action,
    });
  },

  /**
   * Reset tenant feature overrides
   */
  resetTenantOverrides: async (tenantId: string): Promise<{ message: string }> => {
    return apiClient.delete(`/admin/features/tenants/${tenantId}/overrides`);
  },
};
