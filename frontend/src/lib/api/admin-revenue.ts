import { apiClient } from './client';
import type {
  RevenueStatsResponse,
  RevenueTrends,
  TrendPeriod,
} from '@/types/revenue';

export interface RevenueStatsParams {
  start_date?: string;
  end_date?: string;
}

export interface RevenueTrendsParams {
  start_date?: string;
  end_date?: string;
  period?: TrendPeriod;
}

export const adminRevenueAPI = {
  /**
   * Get revenue analytics dashboard metrics
   */
  getStats: async (params?: RevenueStatsParams): Promise<RevenueStatsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const qs = queryParams.toString();
    return apiClient.get<RevenueStatsResponse>(`/admin/revenue/stats${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get time-series revenue trends for charts
   */
  getTrends: async (params?: RevenueTrendsParams): Promise<RevenueTrends> => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.period) queryParams.append('period', params.period);
    const qs = queryParams.toString();
    return apiClient.get<RevenueTrends>(`/admin/revenue/trends${qs ? `?${qs}` : ''}`);
  },

  /**
   * Export revenue data as CSV
   */
  exportCSV: async (params?: RevenueStatsParams): Promise<void> => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const qs = queryParams.toString();

    // Generate filename with date range
    const startDate = params?.start_date || 'start';
    const endDate = params?.end_date || 'end';
    const filename = `revenue-export-${startDate}-to-${endDate}.csv`;

    await apiClient.downloadFile(`/admin/revenue/export${qs ? `?${qs}` : ''}`, filename);
  },
};
