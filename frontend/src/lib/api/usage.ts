import { apiClient } from './client';
import type {
  MetricType,
  TenantUsageSummary,
  UsageQuotaListResponse,
  UsageTrends,
  UsageAlertListResponse,
  UsageAlert,
  AdminUsageOverviewResponse,
  UsageQuota,
  UsageQuotaUpdate,
} from '@/types/usage';

// ============================================================================
// TENANT API (for logged-in users)
// ============================================================================

export const usageAPI = {
  /**
   * Get usage summary for current tenant
   */
  getSummary: async (): Promise<TenantUsageSummary> => {
    return apiClient.get<TenantUsageSummary>('/usage/summary');
  },

  /**
   * Get all quotas for current tenant
   */
  getQuotas: async (): Promise<UsageQuotaListResponse> => {
    return apiClient.get<UsageQuotaListResponse>('/usage/quotas');
  },

  /**
   * Get usage trends for a specific metric
   */
  getTrends: async (
    metricType: MetricType,
    params?: { start_date?: string; end_date?: string }
  ): Promise<UsageTrends> => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const qs = queryParams.toString();
    return apiClient.get<UsageTrends>(`/usage/trends/${metricType}${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get alerts for current tenant
   */
  getAlerts: async (params?: {
    acknowledged?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<UsageAlertListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.acknowledged !== undefined) queryParams.append('acknowledged', params.acknowledged.toString());
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    const qs = queryParams.toString();
    return apiClient.get<UsageAlertListResponse>(`/usage/alerts${qs ? `?${qs}` : ''}`);
  },

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert: async (alertId: string): Promise<UsageAlert> => {
    return apiClient.post<UsageAlert>(`/usage/alerts/${alertId}/acknowledge`);
  },
};

// ============================================================================
// ADMIN API (for super admins)
// ============================================================================

export const adminUsageAPI = {
  /**
   * Get usage overview for all tenants
   */
  getOverview: async (params?: {
    skip?: number;
    limit?: number;
    has_warning?: boolean;
    has_exceeded?: boolean;
  }): Promise<AdminUsageOverviewResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.has_warning !== undefined) queryParams.append('has_warning', params.has_warning.toString());
    if (params?.has_exceeded !== undefined) queryParams.append('has_exceeded', params.has_exceeded.toString());
    const qs = queryParams.toString();
    return apiClient.get<AdminUsageOverviewResponse>(`/admin/usage/overview${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get usage summary for a specific tenant
   */
  getTenantSummary: async (tenantId: string): Promise<TenantUsageSummary> => {
    return apiClient.get<TenantUsageSummary>(`/admin/usage/tenant/${tenantId}/summary`);
  },

  /**
   * Get usage trends for a specific tenant and metric
   */
  getTenantTrends: async (
    tenantId: string,
    metricType: MetricType,
    params?: { start_date?: string; end_date?: string }
  ): Promise<UsageTrends> => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const qs = queryParams.toString();
    return apiClient.get<UsageTrends>(
      `/admin/usage/tenant/${tenantId}/trends/${metricType}${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Update quota limit for a tenant
   */
  updateQuota: async (
    tenantId: string,
    metricType: MetricType,
    data: UsageQuotaUpdate
  ): Promise<UsageQuota> => {
    return apiClient.put<UsageQuota>(`/admin/usage/tenant/${tenantId}/quota/${metricType}`, data);
  },

  /**
   * Reset usage counter for a specific metric
   */
  resetUsage: async (tenantId: string, metricType: MetricType): Promise<UsageQuota> => {
    return apiClient.post<UsageQuota>(`/admin/usage/tenant/${tenantId}/reset/${metricType}`);
  },

  /**
   * Reset all usage counters for a tenant
   */
  resetAllUsage: async (tenantId: string): Promise<{ message: string; count: number }> => {
    return apiClient.post<{ message: string; count: number }>(
      `/admin/usage/tenant/${tenantId}/reset-all`
    );
  },

  /**
   * Sync quotas with tenant's tier
   */
  syncWithTier: async (tenantId: string): Promise<{ message: string; tier: string }> => {
    return apiClient.post<{ message: string; tier: string }>(
      `/admin/usage/tenant/${tenantId}/sync-tier`
    );
  },

  /**
   * Get all usage alerts
   */
  getAlerts: async (params?: {
    tenant_id?: string;
    acknowledged?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<UsageAlertListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.tenant_id) queryParams.append('tenant_id', params.tenant_id);
    if (params?.acknowledged !== undefined) queryParams.append('acknowledged', params.acknowledged.toString());
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    const qs = queryParams.toString();
    return apiClient.get<UsageAlertListResponse>(`/admin/usage/alerts${qs ? `?${qs}` : ''}`);
  },

  /**
   * Process monthly quota resets (normally called by cron)
   */
  processResets: async (): Promise<{ message: string; count: number }> => {
    return apiClient.post<{ message: string; count: number }>('/admin/usage/process-resets');
  },
};
