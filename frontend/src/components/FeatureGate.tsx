'use client';

import { ReactNode } from 'react';
import {
  useFeature,
  useAnyFeature,
  useAllFeatures,
} from '@/hooks/use-feature';
import type { FeatureCode } from '@/types/features';

interface FeatureGateProps {
  children: ReactNode;
  /** Fallback content when feature is not available */
  fallback?: ReactNode;
}

interface SingleFeatureGateProps extends FeatureGateProps {
  /** Feature code to check */
  feature: FeatureCode;
}

interface MultiFeatureGateProps extends FeatureGateProps {
  /** Feature codes to check */
  features: FeatureCode[];
}

/**
 * Conditionally render children based on a single feature
 *
 * @example
 * <FeatureGate feature="inventory.adjustments">
 *   <StockAdjustmentButton />
 * </FeatureGate>
 *
 * @example
 * <FeatureGate
 *   feature="reports.export"
 *   fallback={<UpgradePrompt feature="Export Reports" />}
 * >
 *   <ExportButton />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
}: SingleFeatureGateProps) {
  const hasFeature = useFeature(feature);
  return hasFeature ? <>{children}</> : <>{fallback}</>;
}

/**
 * Conditionally render children if ANY of the features are enabled
 *
 * @example
 * <AnyFeatureGate features={['reports.basic', 'reports.advanced']}>
 *   <ReportsLink />
 * </AnyFeatureGate>
 */
export function AnyFeatureGate({
  features,
  children,
  fallback = null,
}: MultiFeatureGateProps) {
  const hasAny = useAnyFeature(features);
  return hasAny ? <>{children}</> : <>{fallback}</>;
}

/**
 * Conditionally render children if ALL of the features are enabled
 *
 * @example
 * <AllFeaturesGate features={['inventory.stock', 'inventory.transfer']}>
 *   <StockTransferButton />
 * </AllFeaturesGate>
 */
export function AllFeaturesGate({
  features,
  children,
  fallback = null,
}: MultiFeatureGateProps) {
  const hasAll = useAllFeatures(features);
  return hasAll ? <>{children}</> : <>{fallback}</>;
}

/**
 * Show upgrade prompt when feature is not available
 *
 * @example
 * <FeatureGate
 *   feature="platform.api_access"
 *   fallback={<FeatureUpgradePrompt feature="platform.api_access" />}
 * >
 *   <APIKeySection />
 * </FeatureGate>
 */
interface FeatureUpgradePromptProps {
  /** Feature code that's not available */
  feature: FeatureCode;
  /** Custom message (optional) */
  message?: string;
}

export function FeatureUpgradePrompt({
  feature,
  message,
}: FeatureUpgradePromptProps) {
  // This is a simple placeholder - can be customized with actual upgrade UI
  return (
    <div className="p-4 border border-dashed border-muted-foreground/30 rounded-lg bg-muted/50 text-center">
      <p className="text-sm text-muted-foreground">
        {message || `Upgrade your plan to access this feature`}
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Feature: {feature}
      </p>
    </div>
  );
}
