/**
 * Feature Hooks
 *
 * React hooks for checking feature availability.
 */
import { useAuthStore } from '@/lib/store/authStore';
import type { FeatureCode } from '@/types/features';

/**
 * Check if a single feature is enabled for the current tenant
 *
 * @example
 * const hasStockAdjustments = useFeature('inventory.adjustments');
 * if (hasStockAdjustments) {
 *   // Show stock adjustment button
 * }
 */
export function useFeature(featureCode: FeatureCode): boolean {
  const { features } = useAuthStore();
  return features.includes(featureCode);
}

/**
 * Check multiple features at once
 *
 * @example
 * const [hasStock, hasAdjustments] = useFeatures(['inventory.stock', 'inventory.adjustments']);
 */
export function useFeatures(featureCodes: FeatureCode[]): boolean[] {
  const { features } = useAuthStore();
  return featureCodes.map((code) => features.includes(code));
}

/**
 * Check if any of the specified features are enabled
 *
 * @example
 * const hasAnyReports = useAnyFeature(['reports.basic', 'reports.advanced']);
 */
export function useAnyFeature(featureCodes: FeatureCode[]): boolean {
  const { features } = useAuthStore();
  return featureCodes.some((code) => features.includes(code));
}

/**
 * Check if all of the specified features are enabled
 *
 * @example
 * const hasFullInventory = useAllFeatures(['inventory.stock', 'inventory.adjustments', 'inventory.transfer']);
 */
export function useAllFeatures(featureCodes: FeatureCode[]): boolean {
  const { features } = useAuthStore();
  return featureCodes.every((code) => features.includes(code));
}

/**
 * Get all enabled features
 *
 * @example
 * const enabledFeatures = useEnabledFeatures();
 * console.log('Enabled:', enabledFeatures);
 */
export function useEnabledFeatures(): string[] {
  const { features } = useAuthStore();
  return features;
}

/**
 * Check if feature module has any enabled features
 *
 * @example
 * const hasPOS = useModuleEnabled('pos');
 * const hasInventory = useModuleEnabled('inventory');
 */
export function useModuleEnabled(module: string): boolean {
  const { features } = useAuthStore();
  return features.some((f) => f.startsWith(`${module}.`));
}
