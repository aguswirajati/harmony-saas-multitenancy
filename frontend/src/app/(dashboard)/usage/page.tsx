'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usageAPI } from '@/lib/api/usage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  HardDrive,
  Users,
  Building2,
  AlertTriangle,
  Bell,
  CheckCircle,
  RefreshCw,
  Zap,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { MetricType, UsageMetricSummary, UsageAlert } from '@/types/usage';
import {
  formatMetricValue,
  formatLimit,
  getUsageProgressColor,
  getUsagePercentageColor,
  getAlertTypeColor,
  getAlertTypeLabel,
  METRIC_DISPLAY_NAMES,
} from '@/types/usage';

export default function TenantUsagePage() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('api_calls');
  const queryClient = useQueryClient();

  // Fetch usage summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['tenant-usage-summary'],
    queryFn: () => usageAPI.getSummary(),
  });

  // Fetch usage trends for selected metric
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['tenant-usage-trends', selectedMetric],
    queryFn: () => usageAPI.getTrends(selectedMetric),
  });

  // Fetch alerts
  const { data: alertsData } = useQuery({
    queryKey: ['tenant-usage-alerts'],
    queryFn: () => usageAPI.getAlerts({ acknowledged: false, limit: 10 }),
  });

  // Acknowledge alert mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => usageAPI.acknowledgeAlert(alertId),
    onSuccess: () => {
      toast.success('Alert acknowledged');
      queryClient.invalidateQueries({ queryKey: ['tenant-usage-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-usage-summary'] });
    },
    onError: () => {
      toast.error('Failed to acknowledge alert');
    },
  });

  const getMetricIcon = (metricType: string, size: string = 'h-5 w-5') => {
    switch (metricType) {
      case 'api_calls':
        return <Zap className={size} />;
      case 'storage_bytes':
        return <HardDrive className={size} />;
      case 'active_users':
        return <Users className={size} />;
      case 'branches':
        return <Building2 className={size} />;
      default:
        return <Activity className={size} />;
    }
  };

  const getMetricColor = (metricType: string) => {
    switch (metricType) {
      case 'api_calls':
        return 'violet';
      case 'storage_bytes':
        return 'blue';
      case 'active_users':
        return 'emerald';
      case 'branches':
        return 'amber';
      default:
        return 'gray';
    }
  };

  // Transform trend data for chart
  const chartData = trends?.data_points.map((point) => ({
    date: format(new Date(point.date), 'MMM d'),
    value: point.value,
  })) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usage Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your resource usage and quotas
          </p>
        </div>
        {summary && (
          <div className="text-sm text-muted-foreground">
            Current period started: {new Date(summary.period_start).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Alerts Banner */}
      {alertsData && alertsData.items.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Usage Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertsData.items.slice(0, 3).map((alert: UsageAlert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={getAlertTypeColor(alert.alert_type)}>
                      {getAlertTypeLabel(alert.alert_type)}
                    </Badge>
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => acknowledgeMutation.mutate(alert.id)}
                    disabled={acknowledgeMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : summary ? (
          summary.metrics.map((metric: UsageMetricSummary) => (
            <UsageMetricCard
              key={metric.metric_type}
              metric={metric}
              icon={getMetricIcon(metric.metric_type)}
              color={getMetricColor(metric.metric_type)}
              isSelected={selectedMetric === metric.metric_type}
              onClick={() => setSelectedMetric(metric.metric_type as MetricType)}
            />
          ))
        ) : null}
      </div>

      {/* Trends Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage Trends
              </CardTitle>
              <CardDescription>
                Daily {METRIC_DISPLAY_NAMES[selectedMetric]} over the last 30 days
              </CardDescription>
            </div>
            <Select
              value={selectedMetric}
              onValueChange={(v) => setSelectedMetric(v as MetricType)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api_calls">API Calls</SelectItem>
                <SelectItem value="storage_bytes">Storage</SelectItem>
                <SelectItem value="active_users">Active Users</SelectItem>
                <SelectItem value="branches">Branches</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {trendsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(value) =>
                    selectedMetric === 'storage_bytes'
                      ? formatMetricValue('storage_bytes', value)
                      : value.toLocaleString()
                  }
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatMetricValue(selectedMetric, value),
                    METRIC_DISPLAY_NAMES[selectedMetric],
                  ]}
                  labelStyle={{ color: 'var(--foreground)' }}
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No usage data available for this period
            </div>
          )}

          {/* Trend Summary */}
          {trends && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                  {formatMetricValue(selectedMetric, trends.total)}
                </p>
                <p className="text-xs text-muted-foreground">Total this period</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatMetricValue(selectedMetric, Math.round(trends.average))}
                </p>
                <p className="text-xs text-muted-foreground">Daily average</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quota Details */}
      <Card>
        <CardHeader>
          <CardTitle>Quota Details</CardTitle>
          <CardDescription>
            Detailed breakdown of your resource limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : summary ? (
            <div className="space-y-4">
              {summary.metrics.map((metric: UsageMetricSummary) => (
                <div
                  key={metric.metric_type}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${getMetricColor(metric.metric_type)}-100 dark:bg-${getMetricColor(metric.metric_type)}-900/30`}>
                        {getMetricIcon(metric.metric_type)}
                      </div>
                      <div>
                        <p className="font-medium">{metric.metric_display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {metric.is_unlimited
                            ? 'Unlimited'
                            : `${formatMetricValue(metric.metric_type as MetricType, metric.remaining)} remaining`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatMetricValue(metric.metric_type as MetricType, metric.current_value)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        of {formatLimit(metric.metric_type as MetricType, metric.limit_value)}
                      </p>
                    </div>
                  </div>
                  {!metric.is_unlimited && (
                    <div className="space-y-1">
                      <Progress
                        value={Math.min(metric.usage_percentage, 100)}
                        className={`h-2 ${getUsageProgressColor(metric.usage_percentage)}`}
                      />
                      <div className="flex justify-between text-xs">
                        <span className={getUsagePercentageColor(metric.usage_percentage)}>
                          {metric.usage_percentage.toFixed(1)}% used
                        </span>
                        {metric.is_exceeded ? (
                          <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Limit exceeded
                          </span>
                        ) : metric.is_near_limit ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Approaching limit
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// Usage metric card component
function UsageMetricCard({
  metric,
  icon,
  color,
  isSelected,
  onClick,
}: {
  metric: UsageMetricSummary;
  icon: React.ReactNode;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-violet-500' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 bg-${color}-100 dark:bg-${color}-900/30 rounded-lg`}>
            {icon}
          </div>
          {metric.is_exceeded ? (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              Exceeded
            </Badge>
          ) : metric.is_near_limit ? (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              Warning
            </Badge>
          ) : null}
        </div>
        <div className="mb-2">
          <p className="text-sm text-muted-foreground">{metric.metric_display_name}</p>
          <p className="text-2xl font-bold">
            {formatMetricValue(metric.metric_type as MetricType, metric.current_value)}
          </p>
        </div>
        {!metric.is_unlimited ? (
          <>
            <Progress
              value={Math.min(metric.usage_percentage, 100)}
              className={`h-2 ${getUsageProgressColor(metric.usage_percentage)}`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {metric.usage_percentage.toFixed(1)}% of {formatLimit(metric.metric_type as MetricType, metric.limit_value)}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Unlimited</p>
        )}
      </CardContent>
    </Card>
  );
}
