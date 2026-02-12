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

export interface UpgradeRequest {
  id: string;
  request_number: string;
  tenant_id: string;
  current_tier_code: string;
  target_tier_code: string;
  current_tier_name: string | null;
  target_tier_name: string | null;
  billing_period: BillingPeriod;
  amount: number;
  currency: string;
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
  payment_method_id: string;
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
  current_tier_code: string;
  target_tier_code: string;
  billing_period: BillingPeriod;
  amount: number;
  currency: string;
  status: UpgradeRequestStatus;
  has_payment_proof: boolean;
  expires_at: string | null;
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
  description: string;
  billing_period: BillingPeriod;
  amount: number;
  currency: string;
  payment_method_name: string | null;
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
