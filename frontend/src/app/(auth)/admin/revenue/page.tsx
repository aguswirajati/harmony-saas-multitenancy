'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminRevenueAPI } from '@/lib/api/admin-revenue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  UserMinus,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';
import type { DateRangePreset } from '@/types/revenue';
import {
  formatRevenueCurrency,
  formatCompactCurrency,
  formatPercentage,
  getDateRangeFromPreset,
  getTrendPeriodFromPreset,
} from '@/types/revenue';
import { toast } from 'sonner';

// Chart colors
const CHART_COLORS = [
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
];

interface AdminRevenuePageProps {
  embedded?: boolean;
}

export default function AdminRevenuePage({ embedded = false }: AdminRevenuePageProps) {
  const [dateRange, setDateRange] = useState<DateRangePreset>('30d');
  const [isExporting, setIsExporting] = useState(false);

  const { start_date, end_date } = getDateRangeFromPreset(dateRange);
  const trendPeriod = getTrendPeriodFromPreset(dateRange);

  // Fetch revenue stats
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['admin-revenue-stats', start_date, end_date],
    queryFn: () => adminRevenueAPI.getStats({ start_date, end_date }),
  });

  // Fetch revenue trends
  const {
    data: trends,
    isLoading: trendsLoading,
    refetch: refetchTrends,
  } = useQuery({
    queryKey: ['admin-revenue-trends', start_date, end_date, trendPeriod],
    queryFn: () => adminRevenueAPI.getTrends({ start_date, end_date, period: trendPeriod }),
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await adminRevenueAPI.exportCSV({ start_date, end_date });
      toast.success('Revenue data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export revenue data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    refetchStats();
    refetchTrends();
    toast.success('Data refreshed');
  };

  // Transform trend data for charts
  const trendChartData = trends?.data_points.map((point) => ({
    date: format(new Date(point.date), dateRange === '12m' ? 'MMM yyyy' : 'MMM d'),
    revenue: point.revenue,
    mrr: point.mrr,
  })) || [];

  // Transform tier breakdown for pie chart
  const tierChartData = stats?.breakdown.by_tier.map((tier) => ({
    name: tier.tier_name,
    value: tier.revenue,
    count: tier.tenant_count,
  })) || [];

  // Billing cycle data for bar chart
  const billingCycleData = stats ? [
    {
      name: 'Monthly',
      revenue: stats.breakdown.by_billing_cycle.monthly_revenue,
      count: stats.breakdown.by_billing_cycle.monthly_count,
    },
    {
      name: 'Yearly',
      revenue: stats.breakdown.by_billing_cycle.yearly_revenue,
      count: stats.breakdown.by_billing_cycle.yearly_count,
    },
  ] : [];

  return (
    <div className={embedded ? "space-y-4" : "space-y-6 p-6"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold">Revenue Analytics</h1>
            <p className="text-muted-foreground">Track MRR, ARR, churn, and revenue trends</p>
          </div>
        )}
        <div className={`flex items-center gap-2 ${embedded ? 'ml-auto' : ''}`}>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangePreset)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-4 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : stats ? (
          <>
            {/* MRR Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                      <DollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">MRR</p>
                      <p className="text-2xl font-bold">{formatCompactCurrency(stats.metrics.mrr)}</p>
                    </div>
                  </div>
                  <GrowthBadge value={stats.metrics.mrr_growth} />
                </div>
              </CardContent>
            </Card>

            {/* ARR Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ARR</p>
                      <p className="text-2xl font-bold">{formatCompactCurrency(stats.metrics.arr)}</p>
                    </div>
                  </div>
                  <GrowthBadge value={stats.metrics.arr_growth} />
                </div>
              </CardContent>
            </Card>

            {/* Churn Rate Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <UserMinus className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Churn Rate</p>
                      <p className="text-2xl font-bold">{stats.churn.churn_rate.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.churn.churned_count} churned
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ARPU Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ARPU</p>
                      <p className="text-2xl font-bold">{formatCompactCurrency(stats.arpu.arpu)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.arpu.paying_tenants} paying
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Charts Row 1: Revenue Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
          <CardDescription>
            Revenue collected over time ({trendPeriod} aggregation)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trendsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(value) => formatCompactCurrency(value, 'IDR')}
                />
                <Tooltip
                  formatter={(value: number) => [formatRevenueCurrency(value), 'Revenue']}
                  labelStyle={{ color: 'var(--foreground)' }}
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No revenue data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row 2: Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Tier */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Tier</CardTitle>
            <CardDescription>Distribution across subscription plans</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : tierChartData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={250}>
                  <PieChart>
                    <Pie
                      data={tierChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {tierChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatRevenueCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {tierChartData.map((tier, index) => (
                    <div key={tier.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-sm font-medium">{tier.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCompactCurrency(tier.value)}</p>
                        <p className="text-xs text-muted-foreground">{tier.count} tenants</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No tier data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly vs Yearly */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Cycles</CardTitle>
            <CardDescription>Monthly vs Yearly subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : billingCycleData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={billingCycleData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    tickFormatter={(value) => formatCompactCurrency(value, 'IDR')}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatRevenueCurrency(value),
                      name === 'revenue' ? 'Revenue' : name,
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No billing cycle data available
              </div>
            )}
            {stats && (
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.breakdown.by_billing_cycle.monthly_percentage.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Monthly</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {stats.breakdown.by_billing_cycle.yearly_percentage.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Yearly</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Movement */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Movement</CardTitle>
          <CardDescription>
            New, expansion, contraction, and churned revenue for the period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-[100px] w-full" />
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* New Revenue */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">New</span>
                </div>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  +{formatCompactCurrency(stats.breakdown.movement.new_revenue)}
                </p>
              </div>

              {/* Expansion Revenue */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Expansion</span>
                </div>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  +{formatCompactCurrency(stats.breakdown.movement.expansion_revenue)}
                </p>
              </div>

              {/* Contraction Revenue */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Contraction</span>
                </div>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  -{formatCompactCurrency(stats.breakdown.movement.contraction_revenue)}
                </p>
              </div>

              {/* Churned Revenue */}
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">Churned</span>
                </div>
                <p className="text-lg font-bold text-red-700 dark:text-red-300">
                  -{formatCompactCurrency(stats.breakdown.movement.churned_revenue)}
                </p>
              </div>

              {/* Net Revenue */}
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {stats.breakdown.movement.net_revenue >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Net</span>
                </div>
                <p className={`text-lg font-bold ${
                  stats.breakdown.movement.net_revenue >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {stats.breakdown.movement.net_revenue >= 0 ? '+' : ''}
                  {formatCompactCurrency(stats.breakdown.movement.net_revenue)}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// Growth badge component
function GrowthBadge({ value }: { value: number }) {
  if (value === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Minus className="h-3 w-3" />
        <span>0%</span>
      </div>
    );
  }

  const isPositive = value > 0;
  const colorClass = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      <span>{formatPercentage(value)}</span>
    </div>
  );
}
