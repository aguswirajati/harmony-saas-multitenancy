/**
 * Payment and Subscription Types
 * Types for subscription tiers, payment methods, and upgrade requests
 */

// ============================================================================
// SUBSCRIPTION TIERS
// ============================================================================

export interface SubscriptionTier {
  id: string;
  code: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  features: string[];
  sort_order: number;
  is_public: boolean;
  is_recommended: boolean;
  trial_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface SubscriptionTierCreate {
  code: string;
  display_name: string;
  description?: string;
  price_monthly?: number;
  price_yearly?: number;
  currency?: string;
  max_users?: number;
  max_branches?: number;
  max_storage_gb?: number;
  features?: string[];
  sort_order?: number;
  is_public?: boolean;
  is_recommended?: boolean;
  trial_days?: number;
}

export interface SubscriptionTierUpdate {
  display_name?: string;
  description?: string;
  price_monthly?: number;
  price_yearly?: number;
  currency?: string;
  max_users?: number;
  max_branches?: number;
  max_storage_gb?: number;
  features?: string[];
  sort_order?: number;
  is_public?: boolean;
  is_recommended?: boolean;
  trial_days?: number;
  is_active?: boolean;
}

export interface PublicTier {
  code: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_users: number;
  max_branches: number;
  max_storage_gb: number;
  max_users_display: string;
  max_branches_display: string;
  max_storage_display: string;
  features: string[];
  sort_order: number;
  is_recommended: boolean;
  trial_days: number;
}

// ============================================================================
// PAYMENT METHODS
// ============================================================================

export type PaymentMethodType = 'bank_transfer' | 'qris' | 'wallet';

export type WalletProvider = 'shopeepay' | 'gopay' | 'dana' | 'ovo' | 'linkaja' | 'other';

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  type: PaymentMethodType;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  wallet_type: WalletProvider | null;
  qris_image_file_id: string | null;
  qris_image_url: string | null;
  instructions: string | null;
  sort_order: number;
  is_public: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface PaymentMethodCreate {
  code: string;
  name: string;
  type: PaymentMethodType;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  wallet_type?: WalletProvider;
  instructions?: string;
  sort_order?: number;
  is_public?: boolean;
}

export interface PaymentMethodUpdate {
  name?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  wallet_type?: WalletProvider;
  instructions?: string;
  sort_order?: number;
  is_public?: boolean;
  is_active?: boolean;
}

export interface PublicPaymentMethod {
  id: string;
  code: string;
  name: string;
  type: PaymentMethodType;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  wallet_type: WalletProvider | null;
  qris_image_url: string | null;
  instructions: string | null;
}

// ============================================================================
// PRORATION TYPES
// ============================================================================

export interface ProrationBreakdown {
  days_remaining: number;
  current_daily_rate: number;
  new_daily_rate: number;
  proration_credit: number;
  proration_charge: number;
  net_amount: number;
  credit_balance_available: number;
  credit_to_apply: number;
  amount_due: number;
  original_amount: number;
}

export interface ScheduledChange {
  tier_code: string;
  tier_name: string | null;
  effective_at: string;
  days_until: number;
}

export interface SubscriptionInfo {
  tier_code: string;
  tier_name: string;
  billing_period: BillingPeriod;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  days_remaining: number;
  credit_balance: number;
  scheduled_change: ScheduledChange | null;
}

// ============================================================================
// UPGRADE REQUESTS
// ============================================================================

export type UpgradeRequestStatus =
  | 'pending'
  | 'payment_uploaded'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type BillingPeriod = 'monthly' | 'yearly';

export type RequestType = 'upgrade' | 'downgrade';

export interface UpgradeRequest {
  id: string;
  request_number: string;
  tenant_id: string;
  request_type: RequestType;
  current_tier_code: string;
  target_tier_code: string;
  current_tier_name: string | null;
  target_tier_name: string | null;
  billing_period: BillingPeriod;
  amount: number;
  currency: string;
  // Proration fields
  original_amount: number;
  proration_credit: number;
  proration_charge: number;
  days_remaining: number;
  effective_date: string | null;
  // Payment fields
  payment_method_id: string | null;
  payment_method_name: string | null;
  payment_proof_file_id: string | null;
  payment_proof_url: string | null;
  payment_proof_uploaded_at: string | null;
  status: UpgradeRequestStatus;
  reviewed_by_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  applied_at: string | null;
  requested_by_id: string | null;
  requested_by_name: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UpgradeRequestCreate {
  target_tier_code: string;
  billing_period: BillingPeriod;
  payment_method_id?: string;
}

export interface UpgradeRequestUpdate {
  target_tier_code: string;
  billing_period: BillingPeriod;
  payment_method_id: string;
}

export interface UpgradeRequestReview {
  action: 'approve' | 'reject';
  notes?: string;
  rejection_reason?: string;
}

export interface UpgradeRequestSummary {
  id: string;
  request_number: string;
  tenant_id: string;
  tenant_name: string | null;
  request_type: RequestType;
  current_tier_code: string;
  target_tier_code: string;
  billing_period: BillingPeriod;
  amount: number;
  currency: string;
  status: UpgradeRequestStatus;
  has_payment_proof: boolean;
  expires_at: string | null;
  effective_date: string | null;
  created_at: string;
}

export interface UpgradePreview {
  current_tier_code: string;
  current_tier_name: string;
  target_tier_code: string;
  target_tier_name: string;
  billing_period: BillingPeriod;
  amount: number;
  currency: string;
  savings_from_yearly: number | null;
  new_limits: {
    max_users: number;
    max_branches: number;
    max_storage_gb: number;
  };
  // Proration fields
  request_type: RequestType;
  days_remaining: number;
  proration_credit: number;
  proration_charge: number;
  credit_balance_available: number;
  credit_to_apply: number;
  amount_due: number;
  original_amount: number;
  effective_date: string | null;
  requires_payment: boolean;
}

export interface UpgradeRequestStats {
  pending_count: number;
  payment_uploaded_count: number;
  under_review_count: number;
  approved_this_month: number;
  rejected_this_month: number;
  total_revenue_this_month: number;
  currency: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface SubscriptionTierListResponse {
  items: SubscriptionTier[];
  total: number;
}

export interface PaymentMethodListResponse {
  items: PaymentMethod[];
  total: number;
}

export interface UpgradeRequestListResponse {
  items: UpgradeRequestSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface TenantUpgradeRequestListResponse {
  items: UpgradeRequest[];
  total: number;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  is_credit: boolean;
}

export interface InvoiceData {
  transaction_number: string;
  invoice_date: string;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at: string | null;
  seller_name: string;
  seller_address: string | null;
  seller_email: string | null;
  buyer_name: string;
  buyer_email: string | null;
  // Line items for proration breakdown
  line_items: InvoiceLineItem[];
  subtotal: number;
  credit_applied: number;
  total: number;
  // Legacy fields
  description: string;
  billing_period: BillingPeriod;
  amount: number;
  currency: string;
  // Period dates
  period_start: string | null;
  period_end: string | null;
  payment_method_name: string | null;
}

export interface BillingTransaction {
  id: string;
  transaction_number: string;
  tenant_id: string;
  tenant_name: string | null;
  upgrade_request_id: string | null;
  transaction_type: 'subscription' | 'upgrade' | 'downgrade' | 'renewal' | 'credit';
  amount: number;
  original_amount: number;
  credit_applied: number;
  credit_generated: number;
  currency: string;
  billing_period: BillingPeriod;
  period_start: string | null;
  period_end: string | null;
  proration_details: ProrationBreakdown | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  invoice_date: string;
  paid_at: string | null;
  cancelled_at: string | null;
  description: string | null;
  created_at: string;
}

export interface BillingTransactionListResponse {
  items: BillingTransaction[];
  total: number;
}

export interface BillingStats {
  total_revenue: number;
  total_revenue_this_month: number;
  pending_amount: number;
  credits_issued: number;
  transaction_count: number;
  paid_count: number;
  pending_count: number;
  requires_review_count: number;
  currency: string;
}

// ============================================================================
// TRANSACTION MANAGEMENT TYPES (Command Center)
// ============================================================================

export type TransactionType =
  | 'subscription'
  | 'upgrade'
  | 'downgrade'
  | 'renewal'
  | 'credit'
  | 'credit_adjustment'
  | 'extension'
  | 'promo'
  | 'refund'
  | 'manual';

export type TransactionStatus = 'pending' | 'paid' | 'cancelled' | 'rejected' | 'refunded';

export interface BillingTransactionDetail {
  id: string;
  transaction_number: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_subdomain: string | null;

  // Request link
  upgrade_request_id: string | null;
  request_number: string | null;
  request_status: UpgradeRequestStatus | null;
  has_payment_proof: boolean;
  payment_proof_file_id: string | null;

  // Transaction type and status
  transaction_type: TransactionType;
  status: TransactionStatus;
  requires_review: boolean;
  can_approve: boolean;
  can_reject: boolean;

  // Amounts
  amount: number;
  original_amount: number;
  credit_applied: number;
  credit_generated: number;
  discount_amount: number;
  net_amount: number;
  currency: string;

  // Coupon/discount info
  coupon_id: string | null;
  coupon_code: string | null;
  discount_description: string | null;

  // Bonus
  bonus_days: number;

  // Billing period
  billing_period: BillingPeriod;
  period_start: string | null;
  period_end: string | null;
  proration_details: ProrationBreakdown | null;

  // Payment method
  payment_method_id: string | null;
  payment_method_name: string | null;

  // Dates
  invoice_date: string;
  paid_at: string | null;
  cancelled_at: string | null;
  rejected_at: string | null;
  adjusted_at: string | null;

  // Admin fields
  admin_notes: string | null;
  rejection_reason: string | null;
  adjusted_by_id: string | null;
  adjusted_by_name: string | null;
  rejected_by_id: string | null;
  rejected_by_name: string | null;

  // Description
  description: string | null;

  // Timestamps
  created_at: string;
  updated_at: string | null;
}

export interface BillingTransactionDetailListResponse {
  items: BillingTransactionDetail[];
  total: number;
  page: number;
  page_size: number;
  requires_review_count: number;
}

// Transaction Management Request Types

export interface TransactionApproveRequest {
  notes?: string;
}

export interface TransactionRejectRequest {
  rejection_reason: string;
  notes?: string;
}

export interface TransactionApplyCouponRequest {
  coupon_code: string;
  notes?: string;
}

export interface TransactionApplyDiscountRequest {
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  description?: string;
  notes?: string;
}

export interface TransactionAddBonusRequest {
  bonus_days: number;
  reason?: string;
  notes?: string;
}

export interface TransactionAddNoteRequest {
  notes: string;
}

export interface ManualTransactionCreateRequest {
  tenant_id: string;
  transaction_type: 'credit_adjustment' | 'extension' | 'promo' | 'refund' | 'manual';
  amount?: number;
  currency?: string;
  description: string;
  credit_adjustment?: number;
  bonus_days?: number;
  discount_amount?: number;
  notes?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatCurrency(amount: number, currency: string = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatLimit(value: number, unit: string): string {
  if (value === -1) return 'Unlimited';
  return `${value} ${unit}${value !== 1 ? 's' : ''}`;
}

export function getStatusColor(status: UpgradeRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30';
    case 'payment_uploaded':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30';
    case 'under_review':
      return 'bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/30';
    case 'approved':
      return 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30';
    case 'rejected':
      return 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-700';
    case 'expired':
      return 'bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/30';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-700';
  }
}

export function getStatusLabel(status: UpgradeRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'Awaiting Payment';
    case 'payment_uploaded':
      return 'Payment Uploaded';
    case 'under_review':
      return 'Under Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
}

export function getPaymentTypeLabel(type: PaymentMethodType): string {
  switch (type) {
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'qris':
      return 'QRIS';
    case 'wallet':
      return 'E-Wallet';
    default:
      return type;
  }
}

export function getWalletTypeLabel(walletType: WalletProvider | null): string {
  if (!walletType) return '';
  switch (walletType) {
    case 'shopeepay':
      return 'ShopeePay';
    case 'gopay':
      return 'GoPay';
    case 'dana':
      return 'DANA';
    case 'ovo':
      return 'OVO';
    case 'linkaja':
      return 'LinkAja';
    case 'other':
      return 'Other';
    default:
      return walletType;
  }
}
