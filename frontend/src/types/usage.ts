/**
 * Usage Metering Types
 * Types for usage tracking, quotas, and alerts
 */

// ============================================================================
// METRIC TYPES
// ============================================================================

export type MetricType = 'api_calls' | 'storage_bytes' | 'active_users' | 'branches';

export const METRIC_DISPLAY_NAMES: Record<MetricType, string> = {
  api_calls: 'API Calls',
  storage_bytes: 'Storage',
  active_users: 'Active Users',
  branches: 'Branches',
};

export const METRIC_UNITS: Record<MetricType, string> = {
  api_calls: 'calls',
  storage_bytes: 'bytes',
  active_users: 'users',
  branches: 'branches',
};

// ============================================================================
// USAGE QUOTA
// ============================================================================

export interface UsageQuota {
  id: string;
  tenant_id: string;
  metric_type: MetricType;
  limit_value: number;
  current_value: number;
  period_start: string;
  reset_date: string | null;
  alert_threshold: number;
  usage_percentage: number;
  is_unlimited: boolean;
  is_exceeded: boolean;
  is_near_limit: boolean;
  remaining: number;
  created_at: string;
  updated_at: string | null;
}

export interface UsageQuotaUpdate {
  limit_value?: number;
  alert_threshold?: number;
  reset_date?: string;
}

export interface UsageQuotaListResponse {
  items: UsageQuota[];
  total: number;
}

// ============================================================================
// USAGE ALERT
// ============================================================================

export type AlertType = 'threshold_warning' | 'limit_reached' | 'limit_exceeded';

export interface UsageAlert {
  id: string;
  tenant_id: string;
  metric_type: MetricType;
  alert_type: AlertType;
  usage_percentage: number;
  current_value: number;
  limit_value: number;
  message: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface UsageAlertListResponse {
  items: UsageAlert[];
  total: number;
}

// ============================================================================
// USAGE SUMMARY
// ============================================================================

export interface UsageMetricSummary {
  metric_type: MetricType;
  metric_display_name: string;
  current_value: number;
  limit_value: number;
  usage_percentage: number;
  is_unlimited: boolean;
  is_exceeded: boolean;
  is_near_limit: boolean;
  remaining: number;
  unit: string;
}

export interface TenantUsageSummary {
  tenant_id: string;
  tenant_name: string | null;
  period_start: string;
  metrics: UsageMetricSummary[];
  has_alerts: boolean;
  unacknowledged_alerts: number;
}

// ============================================================================
// USAGE TRENDS
// ============================================================================

export interface UsageTrendPoint {
  date: string;
  value: number;
}

export interface UsageTrends {
  metric_type: MetricType;
  start_date: string;
  end_date: string;
  data_points: UsageTrendPoint[];
  total: number;
  average: number;
}

// ============================================================================
// ADMIN OVERVIEW
// ============================================================================

export interface TenantUsageOverview {
  tenant_id: string;
  tenant_name: string;
  tier: string;
  api_calls: number;
  api_calls_limit: number;
  api_calls_percentage: number;
  storage_bytes: number;
  storage_limit_bytes: number;
  storage_percentage: number;
  active_users: number;
  users_limit: number;
  users_percentage: number;
  branches: number;
  branches_limit: number;
  branches_percentage: number;
  has_exceeded: boolean;
  has_warning: boolean;
}

export interface AdminUsageOverviewResponse {
  items: TenantUsageOverview[];
  total: number;
  tenants_with_warnings: number;
  tenants_exceeded: number;
}

// ============================================================================
// USAGE INCREMENT
// ============================================================================

export interface UsageIncrementRequest {
  metric_type: MetricType;
  amount?: number;
}

export interface UsageIncrementResponse {
  metric_type: MetricType;
  previous_value: number;
  new_value: number;
  limit_value: number;
  usage_percentage: number;
  is_exceeded: boolean;
  is_near_limit: boolean;
  remaining: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatMetricValue(metricType: MetricType, value: number): string {
  if (metricType === 'storage_bytes') {
    return formatBytes(value);
  }
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
}

export function formatLimit(metricType: MetricType, value: number): string {
  if (value === -1) return 'Unlimited';
  if (metricType === 'storage_bytes') {
    return formatBytes(value);
  }
  return value.toLocaleString();
}

export function getUsagePercentageColor(percentage: number, threshold: number = 80): string {
  if (percentage >= 100) return 'text-red-600 dark:text-red-400';
  if (percentage >= threshold) return 'text-amber-600 dark:text-amber-400';
  if (percentage >= 50) return 'text-blue-600 dark:text-blue-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

export function getUsageProgressColor(percentage: number, threshold: number = 80): string {
  if (percentage >= 100) return 'bg-red-500';
  if (percentage >= threshold) return 'bg-amber-500';
  if (percentage >= 50) return 'bg-blue-500';
  return 'bg-emerald-500';
}

export function getAlertTypeColor(alertType: AlertType): string {
  switch (alertType) {
    case 'limit_exceeded':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'limit_reached':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'threshold_warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

export function getAlertTypeLabel(alertType: AlertType): string {
  switch (alertType) {
    case 'limit_exceeded':
      return 'Limit Exceeded';
    case 'limit_reached':
      return 'Limit Reached';
    case 'threshold_warning':
      return 'Warning';
    default:
      return alertType;
  }
}
