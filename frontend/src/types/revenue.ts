/**
 * Revenue Analytics Types
 * Types for revenue metrics, trends, and analytics dashboard
 */

// ============================================================================
// CORE METRICS
// ============================================================================

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  mrr_growth: number;
  arr_growth: number;
  currency: string;
}

export interface ChurnMetrics {
  churn_rate: number;
  churned_count: number;
  churned_revenue: number;
  starting_count: number;
  currency: string;
}

export interface ARPUMetrics {
  arpu: number;
  paying_tenants: number;
  arpu_growth: number;
  currency: string;
}

// ============================================================================
// REVENUE BREAKDOWNS
// ============================================================================

export interface TierBreakdown {
  tier_code: string;
  tier_name: string;
  tenant_count: number;
  revenue: number;
  percentage: number;
}

export interface BillingCycleBreakdown {
  monthly_revenue: number;
  monthly_count: number;
  yearly_revenue: number;
  yearly_count: number;
  monthly_percentage: number;
  yearly_percentage: number;
}

export interface RevenueMovement {
  new_revenue: number;
  expansion_revenue: number;
  contraction_revenue: number;
  churned_revenue: number;
  net_revenue: number;
  currency: string;
}

export interface RevenueBreakdown {
  by_tier: TierBreakdown[];
  by_billing_cycle: BillingCycleBreakdown;
  movement: RevenueMovement;
}

// ============================================================================
// TIME-SERIES DATA
// ============================================================================

export interface RevenueTrendPoint {
  date: string;
  mrr: number;
  revenue: number;
  new_revenue: number;
  churned_revenue: number;
  tenant_count: number;
}

export type TrendPeriod = 'daily' | 'weekly' | 'monthly';

export interface RevenueTrends {
  period: TrendPeriod;
  start_date: string;
  end_date: string;
  data_points: RevenueTrendPoint[];
  currency: string;
}

// ============================================================================
// DASHBOARD RESPONSE
// ============================================================================

export interface RevenueStatsResponse {
  metrics: RevenueMetrics;
  churn: ChurnMetrics;
  arpu: ARPUMetrics;
  breakdown: RevenueBreakdown;
  period_start: string;
  period_end: string;
  currency: string;
}

// ============================================================================
// DATE RANGE PRESETS
// ============================================================================

export type DateRangePreset = '7d' | '30d' | '90d' | '12m' | 'custom';

export interface DateRange {
  start_date: string;
  end_date: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatRevenueCurrency(amount: number, currency: string = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number, currency: string = 'IDR'): string {
  if (amount >= 1_000_000_000) {
    return `${currency} ${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${currency} ${(amount / 1_000).toFixed(1)}K`;
  }
  return formatRevenueCurrency(amount, currency);
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function getGrowthColor(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  let startDate: string;

  switch (preset) {
    case '7d':
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '30d':
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '90d':
      startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '12m':
      startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    default:
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  return { start_date: startDate, end_date: endDate };
}

export function getTrendPeriodFromPreset(preset: DateRangePreset): TrendPeriod {
  switch (preset) {
    case '7d':
    case '30d':
      return 'daily';
    case '90d':
      return 'weekly';
    case '12m':
      return 'monthly';
    default:
      return 'daily';
  }
}
