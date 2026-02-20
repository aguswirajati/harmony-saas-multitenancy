/**
 * Feature Flag Types
 *
 * TypeScript definitions for the feature flag system.
 */

/**
 * Feature module categories
 */
export type FeatureModule =
  | 'pos'
  | 'inventory'
  | 'masterdata'
  | 'purchasing'
  | 'reports'
  | 'platform'
  | 'loyalty'
  | 'hr';

/**
 * All available feature codes
 */
export type FeatureCode =
  // POS Module
  | 'pos.terminal'
  | 'pos.transactions'
  | 'pos.shifts'
  // Inventory Module
  | 'inventory.stock'
  | 'inventory.adjustments'
  | 'inventory.transfer'
  // Masterdata Module
  | 'masterdata.items'
  | 'masterdata.categories'
  | 'masterdata.units'
  | 'masterdata.warehouses'
  | 'masterdata.suppliers'
  | 'masterdata.customers'
  | 'masterdata.price_levels'
  | 'masterdata.discounts'
  | 'masterdata.discount_groups'
  | 'masterdata.promotions'
  // Purchasing Module
  | 'purchasing.orders'
  | 'purchasing.receiving'
  // Reports Module
  | 'reports.basic'
  | 'reports.advanced'
  | 'reports.sales'
  | 'reports.export'
  // Platform Module
  | 'platform.api_access'
  | 'platform.integrations'
  | 'platform.audit_advanced'
  | 'platform.multi_currency'
  | 'platform.custom_fields'
  | 'platform.workflow'
  // Loyalty Module
  | 'loyalty.points'
  // HR Module
  | 'hr.employees';

/**
 * Feature metadata
 */
export interface FeatureMetadata {
  code: FeatureCode;
  name: string;
  description: string;
  module: FeatureModule;
}

/**
 * Feature with status for display
 */
export interface FeatureStatus {
  code: string;
  name: string;
  description: string;
  module: string;
  enabled: boolean;
  source: 'tier' | 'enabled_override' | 'disabled_override';
}

/**
 * Tenant features response
 */
export interface TenantFeaturesResponse {
  features: string[];
  tier: string;
  overrides: {
    enabled?: string[];
    disabled?: string[];
  };
}

/**
 * All features grouped by module
 */
export interface AllFeaturesResponse {
  modules: Record<string, FeatureMetadata[]>;
  total_count: number;
}

/**
 * Tier feature matrix
 */
export interface TierFeatureMatrix {
  tiers: string[];
  features: string[];
  matrix: Record<string, Record<string, boolean>>;
}

/**
 * Feature registry with metadata
 */
export const FEATURE_REGISTRY: Record<FeatureCode, FeatureMetadata> = {
  // POS Module
  'pos.terminal': {
    code: 'pos.terminal',
    name: 'POS Terminal',
    description: 'Point of Sale terminal interface for processing sales',
    module: 'pos',
  },
  'pos.transactions': {
    code: 'pos.transactions',
    name: 'Sales Transactions',
    description: 'Create and manage sales transactions',
    module: 'pos',
  },
  'pos.shifts': {
    code: 'pos.shifts',
    name: 'Shift Management',
    description: 'Manage cashier shifts with opening/closing cash counts',
    module: 'pos',
  },
  // Inventory Module
  'inventory.stock': {
    code: 'inventory.stock',
    name: 'Stock Management',
    description: 'View and manage stock levels across warehouses',
    module: 'inventory',
  },
  'inventory.adjustments': {
    code: 'inventory.adjustments',
    name: 'Stock Adjustments',
    description: 'Adjust stock quantities for corrections or write-offs',
    module: 'inventory',
  },
  'inventory.transfer': {
    code: 'inventory.transfer',
    name: 'Stock Transfer',
    description: 'Transfer stock between warehouses or branches',
    module: 'inventory',
  },
  // Masterdata Module
  'masterdata.items': {
    code: 'masterdata.items',
    name: 'Item Management',
    description: 'Create and manage products/items',
    module: 'masterdata',
  },
  'masterdata.categories': {
    code: 'masterdata.categories',
    name: 'Category Management',
    description: 'Organize items into categories',
    module: 'masterdata',
  },
  'masterdata.units': {
    code: 'masterdata.units',
    name: 'Unit of Measure',
    description: 'Define units of measure for items',
    module: 'masterdata',
  },
  'masterdata.warehouses': {
    code: 'masterdata.warehouses',
    name: 'Warehouse Management',
    description: 'Manage multiple warehouse locations',
    module: 'masterdata',
  },
  'masterdata.suppliers': {
    code: 'masterdata.suppliers',
    name: 'Supplier Management',
    description: 'Manage supplier information and contacts',
    module: 'masterdata',
  },
  'masterdata.customers': {
    code: 'masterdata.customers',
    name: 'Customer Management',
    description: 'Manage customer records and information',
    module: 'masterdata',
  },
  'masterdata.price_levels': {
    code: 'masterdata.price_levels',
    name: 'Price Levels',
    description: 'Define multiple price levels for different customer groups',
    module: 'masterdata',
  },
  'masterdata.discounts': {
    code: 'masterdata.discounts',
    name: 'Discount Rules',
    description: 'Create and manage discount rules',
    module: 'masterdata',
  },
  'masterdata.discount_groups': {
    code: 'masterdata.discount_groups',
    name: 'Discount Groups',
    description: 'Group discounts for easier management',
    module: 'masterdata',
  },
  'masterdata.promotions': {
    code: 'masterdata.promotions',
    name: 'Promotions',
    description: 'Create time-limited promotional campaigns',
    module: 'masterdata',
  },
  // Purchasing Module
  'purchasing.orders': {
    code: 'purchasing.orders',
    name: 'Purchase Orders',
    description: 'Create and manage purchase orders to suppliers',
    module: 'purchasing',
  },
  'purchasing.receiving': {
    code: 'purchasing.receiving',
    name: 'Goods Receiving',
    description: 'Receive goods from purchase orders',
    module: 'purchasing',
  },
  // Reports Module
  'reports.basic': {
    code: 'reports.basic',
    name: 'Basic Reports',
    description: 'Access basic sales and inventory reports',
    module: 'reports',
  },
  'reports.advanced': {
    code: 'reports.advanced',
    name: 'Advanced Analytics',
    description: 'Advanced analytics with trends and forecasting',
    module: 'reports',
  },
  'reports.sales': {
    code: 'reports.sales',
    name: 'Sales Reports',
    description: 'Detailed sales reports and analysis',
    module: 'reports',
  },
  'reports.export': {
    code: 'reports.export',
    name: 'Export Reports',
    description: 'Export reports to CSV, PDF, or Excel',
    module: 'reports',
  },
  // Platform Module
  'platform.api_access': {
    code: 'platform.api_access',
    name: 'API Access',
    description: 'Access to external API for integrations',
    module: 'platform',
  },
  'platform.integrations': {
    code: 'platform.integrations',
    name: 'Third-Party Integrations',
    description: 'Connect with third-party services',
    module: 'platform',
  },
  'platform.audit_advanced': {
    code: 'platform.audit_advanced',
    name: 'Advanced Audit',
    description: 'Advanced audit logging and compliance features',
    module: 'platform',
  },
  'platform.multi_currency': {
    code: 'platform.multi_currency',
    name: 'Multi-Currency',
    description: 'Support for multiple currencies',
    module: 'platform',
  },
  'platform.custom_fields': {
    code: 'platform.custom_fields',
    name: 'Custom Fields',
    description: 'Add custom fields to records',
    module: 'platform',
  },
  'platform.workflow': {
    code: 'platform.workflow',
    name: 'Workflow Automation',
    description: 'Automate business processes with workflows',
    module: 'platform',
  },
  // Loyalty Module
  'loyalty.points': {
    code: 'loyalty.points',
    name: 'Loyalty Points',
    description: 'Customer loyalty point system',
    module: 'loyalty',
  },
  // HR Module
  'hr.employees': {
    code: 'hr.employees',
    name: 'Employee Management',
    description: 'Manage employee records and access',
    module: 'hr',
  },
};

/**
 * Module display names
 */
export const MODULE_NAMES: Record<FeatureModule, string> = {
  pos: 'Point of Sale',
  inventory: 'Inventory',
  masterdata: 'Master Data',
  purchasing: 'Purchasing',
  reports: 'Reports',
  platform: 'Platform',
  loyalty: 'Loyalty',
  hr: 'Human Resources',
};

/**
 * Get features grouped by module
 */
export function getFeaturesByModule(): Record<FeatureModule, FeatureMetadata[]> {
  const grouped: Record<string, FeatureMetadata[]> = {};

  for (const feature of Object.values(FEATURE_REGISTRY)) {
    if (!grouped[feature.module]) {
      grouped[feature.module] = [];
    }
    grouped[feature.module].push(feature);
  }

  return grouped as Record<FeatureModule, FeatureMetadata[]>;
}

/**
 * Get all feature codes
 */
export function getAllFeatureCodes(): FeatureCode[] {
  return Object.keys(FEATURE_REGISTRY) as FeatureCode[];
}
