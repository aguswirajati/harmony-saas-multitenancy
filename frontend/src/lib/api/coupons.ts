/**
 * Coupon API client for admin and tenant operations
 */
import { apiClient } from './client';
import type {
  Coupon,
  CouponCreate,
  CouponUpdate,
  CouponListResponse,
  CouponValidateRequest,
  CouponValidateResponse,
  ApplyCouponRequest,
  ApplyCouponResponse,
  CouponRedemptionListResponse,
  CouponStatistics,
  CouponOverviewStats,
  ActiveDiscount,
} from '@/types/coupon';

// ============== Admin Coupon API ==============

export const adminCouponsAPI = {
  /**
   * Create a new coupon
   */
  create: async (data: CouponCreate): Promise<Coupon> => {
    return apiClient.post<Coupon>('/admin/coupons/', data);
  },

  /**
   * Get paginated list of coupons
   */
  list: async (params?: {
    page?: number;
    page_size?: number;
    is_active?: boolean;
    discount_type?: string;
    include_expired?: boolean;
  }): Promise<CouponListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
    if (params?.discount_type) queryParams.append('discount_type', params.discount_type);
    if (params?.include_expired !== undefined) queryParams.append('include_expired', params.include_expired.toString());
    const qs = queryParams.toString();
    return apiClient.get<CouponListResponse>(`/admin/coupons/${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get coupon by ID
   */
  get: async (couponId: string): Promise<Coupon> => {
    return apiClient.get<Coupon>(`/admin/coupons/${couponId}`);
  },

  /**
   * Update a coupon
   */
  update: async (couponId: string, data: CouponUpdate): Promise<Coupon> => {
    return apiClient.put<Coupon>(`/admin/coupons/${couponId}`, data);
  },

  /**
   * Delete a coupon
   */
  delete: async (couponId: string): Promise<void> => {
    await apiClient.delete(`/admin/coupons/${couponId}`);
  },

  /**
   * Get overall coupon statistics
   */
  getOverviewStats: async (): Promise<CouponOverviewStats> => {
    return apiClient.get<CouponOverviewStats>('/admin/coupons/stats');
  },

  /**
   * Get statistics for a specific coupon
   */
  getCouponStats: async (couponId: string): Promise<CouponStatistics> => {
    return apiClient.get<CouponStatistics>(`/admin/coupons/${couponId}/stats`);
  },

  /**
   * Get redemptions for a specific coupon
   */
  getRedemptions: async (
    couponId: string,
    params?: { page?: number; page_size?: number }
  ): Promise<CouponRedemptionListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    const qs = queryParams.toString();
    return apiClient.get<CouponRedemptionListResponse>(`/admin/coupons/${couponId}/redemptions${qs ? `?${qs}` : ''}`);
  },
};

// ============== Tenant Coupon API ==============

export const couponsAPI = {
  /**
   * Validate a coupon code
   */
  validate: async (data: CouponValidateRequest): Promise<CouponValidateResponse> => {
    return apiClient.post<CouponValidateResponse>('/coupons/validate', data);
  },

  /**
   * Apply a coupon to an upgrade request
   */
  apply: async (data: ApplyCouponRequest): Promise<ApplyCouponResponse> => {
    return apiClient.post<ApplyCouponResponse>('/coupons/apply', data);
  },

  /**
   * Get my coupon redemptions
   */
  getMyRedemptions: async (params?: {
    page?: number;
    page_size?: number;
    include_expired?: boolean;
  }): Promise<CouponRedemptionListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.include_expired !== undefined) queryParams.append('include_expired', params.include_expired.toString());
    const qs = queryParams.toString();
    return apiClient.get<CouponRedemptionListResponse>(`/coupons/my-redemptions${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get currently active discount for the tenant
   */
  getActiveDiscount: async (): Promise<ActiveDiscount> => {
    return apiClient.get<ActiveDiscount>('/coupons/active-discount');
  },
};
