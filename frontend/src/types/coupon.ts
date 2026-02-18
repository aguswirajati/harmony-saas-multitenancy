/**
 * Coupon and Discount TypeScript interfaces
 */

export type DiscountType = 'percentage' | 'fixed_amount' | 'trial_extension';

// ============== Coupon Types ==============

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  currency: string;
  max_redemptions: number | null;
  current_redemptions: number;
  max_redemptions_per_tenant: number;
  valid_for_tiers: string[] | null;
  valid_for_billing_periods: string[] | null;
  valid_from: string | null;
  valid_until: string | null;
  first_time_only: boolean;
  new_customers_only: boolean;
  duration_months: number | null;
  minimum_amount: number | null;
  is_active: boolean;
  is_valid: boolean;
  is_expired: boolean;
  is_maxed_out: boolean;
  remaining_redemptions: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface CouponCreate {
  code: string;
  name: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  currency?: string;
  max_redemptions?: number;
  max_redemptions_per_tenant?: number;
  valid_for_tiers?: string[];
  valid_for_billing_periods?: string[];
  valid_from?: string;
  valid_until?: string;
  first_time_only?: boolean;
  new_customers_only?: boolean;
  duration_months?: number;
  minimum_amount?: number;
}

export interface CouponUpdate {
  name?: string;
  description?: string;
  max_redemptions?: number;
  max_redemptions_per_tenant?: number;
  valid_for_tiers?: string[];
  valid_for_billing_periods?: string[];
  valid_from?: string;
  valid_until?: string;
  first_time_only?: boolean;
  new_customers_only?: boolean;
  duration_months?: number;
  minimum_amount?: number;
  is_active?: boolean;
}

export interface CouponListResponse {
  items: Coupon[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ============== Coupon Validation Types ==============

export interface CouponValidateRequest {
  code: string;
  tier_code?: string;
  billing_period?: string;
  amount?: number;
}

export interface CouponValidateResponse {
  valid: boolean;
  coupon: Coupon | null;
  discount_amount: number | null;
  discount_description: string | null;
  error_message: string | null;
}

// ============== Coupon Redemption Types ==============

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  tenant_id: string;
  upgrade_request_id: string | null;
  discount_type: DiscountType;
  discount_value: number;
  discount_applied: number;
  applied_at: string;
  expires_at: string | null;
  is_expired: boolean;
  coupon_code: string | null;
  coupon_name: string | null;
  created_at: string;
}

export interface CouponRedemptionListResponse {
  items: CouponRedemption[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ============== Apply Coupon Types ==============

export interface ApplyCouponRequest {
  code: string;
  upgrade_request_id: string;
}

export interface ApplyCouponResponse {
  success: boolean;
  redemption: CouponRedemption | null;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  discount_description: string;
  error_message: string | null;
}

// ============== Coupon Statistics Types ==============

export interface CouponStatistics {
  coupon_id: string;
  code: string;
  name: string;
  total_redemptions: number;
  total_discount_given: number;
  unique_tenants: number;
  active_redemptions: number;
  expired_redemptions: number;
}

export interface CouponOverviewStats {
  total_coupons: number;
  active_coupons: number;
  expired_coupons: number;
  total_redemptions: number;
  total_discount_given: number;
  top_coupons: CouponStatistics[];
}

// ============== Active Discount Types ==============

export interface ActiveDiscount {
  has_active_discount: boolean;
  discount_type?: DiscountType;
  discount_value?: number;
  discount_applied?: number;
  coupon_code?: string;
  coupon_name?: string;
  expires_at?: string;
}
