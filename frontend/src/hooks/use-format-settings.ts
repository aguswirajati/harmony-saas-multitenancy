import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  FormatSettings,
  DEFAULT_FORMAT_SETTINGS,
  formatCurrency as formatCurrencyUtil,
  formatNumber as formatNumberUtil,
  formatQuantity as formatQuantityUtil,
  formatDate as formatDateUtil,
  formatDateTime as formatDateTimeUtil,
} from '@/lib/utils/format';

/**
 * Fetch format settings from the API
 */
async function fetchFormatSettings(): Promise<FormatSettings> {
  return apiClient.get<FormatSettings>('/tenant-settings/format');
}

/**
 * Update format settings via the API
 */
async function updateFormatSettings(settings: FormatSettings): Promise<FormatSettings> {
  return apiClient.put<FormatSettings>('/tenant-settings/format', settings);
}

/**
 * Hook for accessing and managing tenant format settings
 *
 * Returns:
 * - settings: Current format settings (or defaults while loading)
 * - isLoading: Whether settings are being fetched
 * - error: Any error that occurred
 * - updateSettings: Mutation function to update settings
 * - formatCurrency: Pre-bound currency formatter
 * - formatNumber: Pre-bound number formatter
 * - formatQuantity: Pre-bound quantity formatter
 * - formatDate: Pre-bound date formatter
 * - formatDateTime: Pre-bound datetime formatter
 */
export function useFormatSettings() {
  const queryClient = useQueryClient();

  const {
    data: settings = DEFAULT_FORMAT_SETTINGS,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['format-settings'],
    queryFn: fetchFormatSettings,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: updateFormatSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['format-settings'], data);
    },
  });

  // Pre-bound formatting functions that use current settings
  const formatCurrency = (amount: number) => formatCurrencyUtil(amount, settings);
  const formatNumber = (value: number, decimals: number) =>
    formatNumberUtil(value, decimals, settings);
  const formatQuantity = (value: number) => formatQuantityUtil(value, settings);
  const formatDate = (date: Date | string | null | undefined) =>
    formatDateUtil(date, settings);
  const formatDateTime = (date: Date | string | null | undefined, includeSeconds?: boolean) =>
    formatDateTimeUtil(date, settings, includeSeconds);

  return {
    settings,
    isLoading,
    error,
    refetch,
    updateSettings: updateMutation.mutate,
    updateSettingsAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    formatCurrency,
    formatNumber,
    formatQuantity,
    formatDate,
    formatDateTime,
  };
}

/**
 * Hook for just reading format settings (no mutation)
 * Lighter weight for components that only need to format values
 */
export function useFormatters() {
  const { data: settings = DEFAULT_FORMAT_SETTINGS } = useQuery({
    queryKey: ['format-settings'],
    queryFn: fetchFormatSettings,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    settings,
    formatCurrency: (amount: number) => formatCurrencyUtil(amount, settings),
    formatNumber: (value: number, decimals: number) =>
      formatNumberUtil(value, decimals, settings),
    formatQuantity: (value: number) => formatQuantityUtil(value, settings),
    formatDate: (date: Date | string | null | undefined) =>
      formatDateUtil(date, settings),
    formatDateTime: (date: Date | string | null | undefined, includeSeconds?: boolean) =>
      formatDateTimeUtil(date, settings, includeSeconds),
  };
}
