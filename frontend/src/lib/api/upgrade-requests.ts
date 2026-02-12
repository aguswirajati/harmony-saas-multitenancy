/**
 * Upgrade Requests API Client
 * Tenant endpoints for creating/managing upgrade requests
 * Admin endpoints for reviewing requests
 */

import { apiClient } from './client';
import type {
  UpgradeRequest,
  UpgradeRequestCreate,
  UpgradeRequestUpdate,
  UpgradeRequestReview,
  UpgradeRequestListResponse,
  TenantUpgradeRequestListResponse,
  UpgradePreview,
  UpgradeRequestStats,
  InvoiceData,
} from '@/types/payment';

// ============================================================================
// TENANT API (Tenant Admin)
// ============================================================================

export const upgradeRequestsTenantAPI = {
  /**
   * Create a new upgrade request
   */
  async create(data: UpgradeRequestCreate): Promise<UpgradeRequest> {
    return apiClient.post<UpgradeRequest>('/upgrade-requests/', data);
  },

  /**
   * List my upgrade requests
   */
  async list(status?: string): Promise<TenantUpgradeRequestListResponse> {
    return apiClient.get<TenantUpgradeRequestListResponse>('/upgrade-requests/', {
      params: status ? { status } : undefined,
    });
  },

  /**
   * Get upgrade request by ID
   */
  async get(requestId: string): Promise<UpgradeRequest> {
    return apiClient.get<UpgradeRequest>(`/upgrade-requests/${requestId}`);
  },

  /**
   * Preview upgrade details
   */
  async preview(targetTierCode: string, billingPeriod: string): Promise<UpgradePreview> {
    return apiClient.get<UpgradePreview>('/upgrade-requests/preview', {
      params: {
        target_tier_code: targetTierCode,
        billing_period: billingPeriod,
      },
    });
  },

  /**
   * Upload payment proof
   */
  async uploadProof(requestId: string, fileId: string): Promise<UpgradeRequest> {
    return apiClient.post<UpgradeRequest>(
      `/upgrade-requests/${requestId}/proof`,
      null,
      { params: { file_id: fileId } }
    );
  },

  /**
   * Cancel an upgrade request
   */
  async cancel(requestId: string): Promise<UpgradeRequest> {
    return apiClient.post<UpgradeRequest>(`/upgrade-requests/${requestId}/cancel`);
  },

  /**
   * Update a pending upgrade request
   */
  async update(requestId: string, data: UpgradeRequestUpdate): Promise<UpgradeRequest> {
    return apiClient.put<UpgradeRequest>(`/upgrade-requests/${requestId}`, data);
  },

  /**
   * Get invoice data for an upgrade request
   */
  async getInvoice(requestId: string): Promise<InvoiceData> {
    return apiClient.get<InvoiceData>(`/upgrade-requests/${requestId}/invoice`);
  },
};

// ============================================================================
// ADMIN API (Super Admin Only)
// ============================================================================

export const upgradeRequestsAdminAPI = {
  /**
   * List all upgrade requests
   */
  async list(params?: {
    status?: string;
    skip?: number;
    limit?: number;
  }): Promise<UpgradeRequestListResponse> {
    return apiClient.get<UpgradeRequestListResponse>('/admin/upgrade-requests/', {
      params,
    });
  },

  /**
   * Get upgrade request by ID
   */
  async get(requestId: string): Promise<UpgradeRequest> {
    return apiClient.get<UpgradeRequest>(`/admin/upgrade-requests/${requestId}`);
  },

  /**
   * Get upgrade request statistics
   */
  async getStats(): Promise<UpgradeRequestStats> {
    return apiClient.get<UpgradeRequestStats>('/admin/upgrade-requests/stats');
  },

  /**
   * Get count of pending requests
   */
  async getPendingCount(): Promise<{ pending_count: number }> {
    return apiClient.get<{ pending_count: number }>('/admin/upgrade-requests/pending-count');
  },

  /**
   * Review (approve/reject) an upgrade request
   */
  async review(requestId: string, data: UpgradeRequestReview): Promise<UpgradeRequest> {
    return apiClient.post<UpgradeRequest>(`/admin/upgrade-requests/${requestId}/review`, data);
  },
};

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const upgradeRequestsAPI = {
  tenant: upgradeRequestsTenantAPI,
  admin: upgradeRequestsAdminAPI,
};
