/**
 * Admin Billing API
 * API client for billing transaction management (Command Center)
 */

import { apiClient } from './client';
import type {
  BillingStats,
  BillingTransactionDetail,
  BillingTransactionDetailListResponse,
  TransactionApproveRequest,
  TransactionRejectRequest,
  TransactionApplyCouponRequest,
  TransactionApplyDiscountRequest,
  TransactionAddBonusRequest,
  TransactionAddNoteRequest,
  ManualTransactionCreateRequest,
} from '@/types/payment';

export interface ListTransactionsParams {
  status?: string;
  transaction_type?: string;
  tenant_id?: string;
  requires_review?: boolean;
  page?: number;
  page_size?: number;
}

export const adminBillingAPI = {
  /**
   * Get billing statistics
   */
  getStats: () => apiClient.get<BillingStats>('/admin/billing/stats'),

  /**
   * List transactions with full details for management
   */
  listTransactions: (params: ListTransactionsParams = {}) =>
    apiClient.get<BillingTransactionDetailListResponse>(
      '/admin/billing/transactions-detailed',
      { params }
    ),

  /**
   * Get detailed transaction information
   */
  getTransaction: (transactionId: string) =>
    apiClient.get<BillingTransactionDetail>(
      `/admin/billing/transactions/${transactionId}/detail`
    ),

  /**
   * Approve a pending transaction
   */
  approveTransaction: (transactionId: string, data?: TransactionApproveRequest) =>
    apiClient.post<BillingTransactionDetail>(
      `/admin/billing/transactions/${transactionId}/approve`,
      data || {}
    ),

  /**
   * Reject a pending transaction
   */
  rejectTransaction: (transactionId: string, data: TransactionRejectRequest) =>
    apiClient.post<BillingTransactionDetail>(
      `/admin/billing/transactions/${transactionId}/reject`,
      data
    ),

  /**
   * Apply a coupon to a pending transaction
   */
  applyCoupon: (transactionId: string, data: TransactionApplyCouponRequest) =>
    apiClient.post<BillingTransactionDetail>(
      `/admin/billing/transactions/${transactionId}/apply-coupon`,
      data
    ),

  /**
   * Apply a manual discount to a pending transaction
   */
  applyDiscount: (transactionId: string, data: TransactionApplyDiscountRequest) =>
    apiClient.post<BillingTransactionDetail>(
      `/admin/billing/transactions/${transactionId}/apply-discount`,
      data
    ),

  /**
   * Add bonus days to a transaction
   */
  addBonus: (transactionId: string, data: TransactionAddBonusRequest) =>
    apiClient.post<BillingTransactionDetail>(
      `/admin/billing/transactions/${transactionId}/add-bonus`,
      data
    ),

  /**
   * Add admin notes to a transaction
   */
  addNote: (transactionId: string, data: TransactionAddNoteRequest) =>
    apiClient.post<BillingTransactionDetail>(
      `/admin/billing/transactions/${transactionId}/add-note`,
      data
    ),

  /**
   * Create a manual transaction
   */
  createManualTransaction: (data: ManualTransactionCreateRequest) =>
    apiClient.post<BillingTransactionDetail>(
      '/admin/billing/transactions',
      data
    ),
};
