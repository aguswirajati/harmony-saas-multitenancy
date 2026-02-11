/**
 * Subscription Tiers API Client
 * Admin endpoints for tier management and public endpoints for pricing
 */

import { apiClient } from './client';
import type {
  SubscriptionTier,
  SubscriptionTierCreate,
  SubscriptionTierUpdate,
  SubscriptionTierListResponse,
  PublicTier,
} from '@/types/payment';

// ============================================================================
// ADMIN API (Super Admin Only)
// ============================================================================

export const subscriptionTiersAdminAPI = {
  /**
   * List all subscription tiers
   */
  async list(includeInactive: boolean = false): Promise<SubscriptionTierListResponse> {
    return apiClient.get<SubscriptionTierListResponse>('/admin/tiers/', {
      params: { include_inactive: includeInactive },
    });
  },

  /**
   * Get tier by ID
   */
  async get(tierId: string): Promise<SubscriptionTier> {
    return apiClient.get<SubscriptionTier>(`/admin/tiers/${tierId}`);
  },

  /**
   * Create a new tier
   */
  async create(data: SubscriptionTierCreate): Promise<SubscriptionTier> {
    return apiClient.post<SubscriptionTier>('/admin/tiers/', data);
  },

  /**
   * Update a tier
   */
  async update(tierId: string, data: SubscriptionTierUpdate): Promise<SubscriptionTier> {
    return apiClient.put<SubscriptionTier>(`/admin/tiers/${tierId}`, data);
  },

  /**
   * Delete a tier (soft delete)
   */
  async delete(tierId: string): Promise<void> {
    return apiClient.delete(`/admin/tiers/${tierId}`);
  },

  /**
   * Reorder tiers
   */
  async reorder(tierOrder: string[]): Promise<SubscriptionTierListResponse> {
    return apiClient.post<SubscriptionTierListResponse>('/admin/tiers/reorder', tierOrder);
  },
};

// ============================================================================
// PUBLIC API
// ============================================================================

export const subscriptionTiersPublicAPI = {
  /**
   * List public tiers for pricing page
   */
  async list(): Promise<{ tiers: PublicTier[] }> {
    return apiClient.get<{ tiers: PublicTier[] }>('/tiers/');
  },

  /**
   * Get public tier by code
   */
  async get(code: string): Promise<PublicTier> {
    return apiClient.get<PublicTier>(`/tiers/${code}`);
  },
};

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const subscriptionTiersAPI = {
  admin: subscriptionTiersAdminAPI,
  public: subscriptionTiersPublicAPI,
};
