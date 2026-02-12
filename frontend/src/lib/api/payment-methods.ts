/**
 * Payment Methods API Client
 * Admin endpoints for payment method management
 */

import { apiClient } from './client';
import type {
  PaymentMethod,
  PaymentMethodCreate,
  PaymentMethodUpdate,
  PaymentMethodListResponse,
  PublicPaymentMethod,
} from '@/types/payment';

// ============================================================================
// ADMIN API (Super Admin Only)
// ============================================================================

export const paymentMethodsAdminAPI = {
  /**
   * List all payment methods
   */
  async list(includeInactive: boolean = false): Promise<PaymentMethodListResponse> {
    return apiClient.get<PaymentMethodListResponse>('/admin/payment-methods/', {
      params: { include_inactive: includeInactive },
    });
  },

  /**
   * Get payment method by ID
   */
  async get(methodId: string): Promise<PaymentMethod> {
    return apiClient.get<PaymentMethod>(`/admin/payment-methods/${methodId}`);
  },

  /**
   * Create a new payment method
   */
  async create(data: PaymentMethodCreate): Promise<PaymentMethod> {
    return apiClient.post<PaymentMethod>('/admin/payment-methods/', data);
  },

  /**
   * Update a payment method
   */
  async update(methodId: string, data: PaymentMethodUpdate): Promise<PaymentMethod> {
    return apiClient.put<PaymentMethod>(`/admin/payment-methods/${methodId}`, data);
  },

  /**
   * Delete a payment method (soft delete)
   */
  async delete(methodId: string): Promise<void> {
    return apiClient.delete(`/admin/payment-methods/${methodId}`);
  },

  /**
   * Permanently delete a payment method (hard delete, DEV_MODE only)
   */
  async permanentDelete(methodId: string): Promise<void> {
    return apiClient.delete(`/admin/payment-methods/${methodId}/permanent`);
  },

  /**
   * Set QRIS image for a payment method
   */
  async setQrisImage(methodId: string, fileId: string): Promise<PaymentMethod> {
    return apiClient.post<PaymentMethod>(
      `/admin/payment-methods/${methodId}/qris`,
      null,
      { params: { file_id: fileId } }
    );
  },
};

// ============================================================================
// PUBLIC API (Authenticated Users)
// ============================================================================

export const paymentMethodsPublicAPI = {
  /**
   * List available payment methods for upgrade flow
   */
  async list(): Promise<PublicPaymentMethod[]> {
    return apiClient.get<PublicPaymentMethod[]>('/payment-methods/');
  },
};

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const paymentMethodsAPI = {
  admin: paymentMethodsAdminAPI,
  public: paymentMethodsPublicAPI,
};
