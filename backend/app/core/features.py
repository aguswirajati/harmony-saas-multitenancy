"""
Feature Flag System

Defines all business features with metadata and tier-feature mappings.
This is the central registry for feature gating across the application.
"""
from enum import Enum
from typing import Dict, Set, List, Optional
from dataclasses import dataclass


class FeatureModule(str, Enum):
    """Feature module categories"""
    POS = "pos"
    INVENTORY = "inventory"
    MASTERDATA = "masterdata"
    PURCHASING = "purchasing"
    REPORTS = "reports"
    PLATFORM = "platform"
    LOYALTY = "loyalty"
    HR = "hr"


class FeatureCode(str, Enum):
    """
    All available feature codes.

    Naming convention: module.feature_name
    """
    # POS Module
    POS_TERMINAL = "pos.terminal"
    POS_TRANSACTIONS = "pos.transactions"
    POS_SHIFTS = "pos.shifts"

    # Inventory Module
    INVENTORY_STOCK = "inventory.stock"
    INVENTORY_ADJUSTMENTS = "inventory.adjustments"
    INVENTORY_TRANSFER = "inventory.transfer"

    # Masterdata Module
    MASTERDATA_ITEMS = "masterdata.items"
    MASTERDATA_CATEGORIES = "masterdata.categories"
    MASTERDATA_UNITS = "masterdata.units"
    MASTERDATA_WAREHOUSES = "masterdata.warehouses"
    MASTERDATA_SUPPLIERS = "masterdata.suppliers"
    MASTERDATA_CUSTOMERS = "masterdata.customers"
    MASTERDATA_PRICE_LEVELS = "masterdata.price_levels"
    MASTERDATA_DISCOUNTS = "masterdata.discounts"
    MASTERDATA_DISCOUNT_GROUPS = "masterdata.discount_groups"
    MASTERDATA_PROMOTIONS = "masterdata.promotions"

    # Purchasing Module
    PURCHASING_ORDERS = "purchasing.orders"
    PURCHASING_RECEIVING = "purchasing.receiving"

    # Reports Module
    REPORTS_BASIC = "reports.basic"
    REPORTS_ADVANCED = "reports.advanced"
    REPORTS_SALES = "reports.sales"
    REPORTS_EXPORT = "reports.export"

    # Platform Module
    PLATFORM_API_ACCESS = "platform.api_access"
    PLATFORM_INTEGRATIONS = "platform.integrations"
    PLATFORM_AUDIT_ADVANCED = "platform.audit_advanced"
    PLATFORM_MULTI_CURRENCY = "platform.multi_currency"
    PLATFORM_CUSTOM_FIELDS = "platform.custom_fields"
    PLATFORM_WORKFLOW = "platform.workflow"

    # Loyalty Module
    LOYALTY_POINTS = "loyalty.points"

    # HR Module
    HR_EMPLOYEES = "hr.employees"


@dataclass
class FeatureMetadata:
    """Metadata for a feature"""
    code: str
    name: str
    description: str
    module: FeatureModule


# Feature metadata registry
FEATURE_REGISTRY: Dict[str, FeatureMetadata] = {
    # POS Module
    FeatureCode.POS_TERMINAL.value: FeatureMetadata(
        code=FeatureCode.POS_TERMINAL.value,
        name="POS Terminal",
        description="Point of Sale terminal interface for processing sales",
        module=FeatureModule.POS,
    ),
    FeatureCode.POS_TRANSACTIONS.value: FeatureMetadata(
        code=FeatureCode.POS_TRANSACTIONS.value,
        name="Sales Transactions",
        description="Create and manage sales transactions",
        module=FeatureModule.POS,
    ),
    FeatureCode.POS_SHIFTS.value: FeatureMetadata(
        code=FeatureCode.POS_SHIFTS.value,
        name="Shift Management",
        description="Manage cashier shifts with opening/closing cash counts",
        module=FeatureModule.POS,
    ),

    # Inventory Module
    FeatureCode.INVENTORY_STOCK.value: FeatureMetadata(
        code=FeatureCode.INVENTORY_STOCK.value,
        name="Stock Management",
        description="View and manage stock levels across warehouses",
        module=FeatureModule.INVENTORY,
    ),
    FeatureCode.INVENTORY_ADJUSTMENTS.value: FeatureMetadata(
        code=FeatureCode.INVENTORY_ADJUSTMENTS.value,
        name="Stock Adjustments",
        description="Adjust stock quantities for corrections or write-offs",
        module=FeatureModule.INVENTORY,
    ),
    FeatureCode.INVENTORY_TRANSFER.value: FeatureMetadata(
        code=FeatureCode.INVENTORY_TRANSFER.value,
        name="Stock Transfer",
        description="Transfer stock between warehouses or branches",
        module=FeatureModule.INVENTORY,
    ),

    # Masterdata Module
    FeatureCode.MASTERDATA_ITEMS.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_ITEMS.value,
        name="Item Management",
        description="Create and manage products/items",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_CATEGORIES.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_CATEGORIES.value,
        name="Category Management",
        description="Organize items into categories",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_UNITS.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_UNITS.value,
        name="Unit of Measure",
        description="Define units of measure for items",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_WAREHOUSES.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_WAREHOUSES.value,
        name="Warehouse Management",
        description="Manage multiple warehouse locations",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_SUPPLIERS.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_SUPPLIERS.value,
        name="Supplier Management",
        description="Manage supplier information and contacts",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_CUSTOMERS.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_CUSTOMERS.value,
        name="Customer Management",
        description="Manage customer records and information",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_PRICE_LEVELS.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_PRICE_LEVELS.value,
        name="Price Levels",
        description="Define multiple price levels for different customer groups",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_DISCOUNTS.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_DISCOUNTS.value,
        name="Discount Rules",
        description="Create and manage discount rules",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_DISCOUNT_GROUPS.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_DISCOUNT_GROUPS.value,
        name="Discount Groups",
        description="Group discounts for easier management",
        module=FeatureModule.MASTERDATA,
    ),
    FeatureCode.MASTERDATA_PROMOTIONS.value: FeatureMetadata(
        code=FeatureCode.MASTERDATA_PROMOTIONS.value,
        name="Promotions",
        description="Create time-limited promotional campaigns",
        module=FeatureModule.MASTERDATA,
    ),

    # Purchasing Module
    FeatureCode.PURCHASING_ORDERS.value: FeatureMetadata(
        code=FeatureCode.PURCHASING_ORDERS.value,
        name="Purchase Orders",
        description="Create and manage purchase orders to suppliers",
        module=FeatureModule.PURCHASING,
    ),
    FeatureCode.PURCHASING_RECEIVING.value: FeatureMetadata(
        code=FeatureCode.PURCHASING_RECEIVING.value,
        name="Goods Receiving",
        description="Receive goods from purchase orders",
        module=FeatureModule.PURCHASING,
    ),

    # Reports Module
    FeatureCode.REPORTS_BASIC.value: FeatureMetadata(
        code=FeatureCode.REPORTS_BASIC.value,
        name="Basic Reports",
        description="Access basic sales and inventory reports",
        module=FeatureModule.REPORTS,
    ),
    FeatureCode.REPORTS_ADVANCED.value: FeatureMetadata(
        code=FeatureCode.REPORTS_ADVANCED.value,
        name="Advanced Analytics",
        description="Advanced analytics with trends and forecasting",
        module=FeatureModule.REPORTS,
    ),
    FeatureCode.REPORTS_SALES.value: FeatureMetadata(
        code=FeatureCode.REPORTS_SALES.value,
        name="Sales Reports",
        description="Detailed sales reports and analysis",
        module=FeatureModule.REPORTS,
    ),
    FeatureCode.REPORTS_EXPORT.value: FeatureMetadata(
        code=FeatureCode.REPORTS_EXPORT.value,
        name="Export Reports",
        description="Export reports to CSV, PDF, or Excel",
        module=FeatureModule.REPORTS,
    ),

    # Platform Module
    FeatureCode.PLATFORM_API_ACCESS.value: FeatureMetadata(
        code=FeatureCode.PLATFORM_API_ACCESS.value,
        name="API Access",
        description="Access to external API for integrations",
        module=FeatureModule.PLATFORM,
    ),
    FeatureCode.PLATFORM_INTEGRATIONS.value: FeatureMetadata(
        code=FeatureCode.PLATFORM_INTEGRATIONS.value,
        name="Third-Party Integrations",
        description="Connect with third-party services",
        module=FeatureModule.PLATFORM,
    ),
    FeatureCode.PLATFORM_AUDIT_ADVANCED.value: FeatureMetadata(
        code=FeatureCode.PLATFORM_AUDIT_ADVANCED.value,
        name="Advanced Audit",
        description="Advanced audit logging and compliance features",
        module=FeatureModule.PLATFORM,
    ),
    FeatureCode.PLATFORM_MULTI_CURRENCY.value: FeatureMetadata(
        code=FeatureCode.PLATFORM_MULTI_CURRENCY.value,
        name="Multi-Currency",
        description="Support for multiple currencies",
        module=FeatureModule.PLATFORM,
    ),
    FeatureCode.PLATFORM_CUSTOM_FIELDS.value: FeatureMetadata(
        code=FeatureCode.PLATFORM_CUSTOM_FIELDS.value,
        name="Custom Fields",
        description="Add custom fields to records",
        module=FeatureModule.PLATFORM,
    ),
    FeatureCode.PLATFORM_WORKFLOW.value: FeatureMetadata(
        code=FeatureCode.PLATFORM_WORKFLOW.value,
        name="Workflow Automation",
        description="Automate business processes with workflows",
        module=FeatureModule.PLATFORM,
    ),

    # Loyalty Module
    FeatureCode.LOYALTY_POINTS.value: FeatureMetadata(
        code=FeatureCode.LOYALTY_POINTS.value,
        name="Loyalty Points",
        description="Customer loyalty point system",
        module=FeatureModule.LOYALTY,
    ),

    # HR Module
    FeatureCode.HR_EMPLOYEES.value: FeatureMetadata(
        code=FeatureCode.HR_EMPLOYEES.value,
        name="Employee Management",
        description="Manage employee records and access",
        module=FeatureModule.HR,
    ),
}


# Default tier-feature mapping
# These are the features included in each tier by default
TIER_DEFAULT_FEATURES: Dict[str, Set[str]] = {
    "free": {
        # POS - basic
        FeatureCode.POS_TERMINAL.value,
        FeatureCode.POS_TRANSACTIONS.value,
        # Inventory - basic
        FeatureCode.INVENTORY_STOCK.value,
        # Masterdata - basic
        FeatureCode.MASTERDATA_ITEMS.value,
        FeatureCode.MASTERDATA_CATEGORIES.value,
        FeatureCode.MASTERDATA_UNITS.value,
        FeatureCode.MASTERDATA_CUSTOMERS.value,
        # Reports - basic only
        FeatureCode.REPORTS_BASIC.value,
    },
    "basic": {
        # POS - full
        FeatureCode.POS_TERMINAL.value,
        FeatureCode.POS_TRANSACTIONS.value,
        FeatureCode.POS_SHIFTS.value,
        # Inventory - with adjustments
        FeatureCode.INVENTORY_STOCK.value,
        FeatureCode.INVENTORY_ADJUSTMENTS.value,
        # Masterdata - more features
        FeatureCode.MASTERDATA_ITEMS.value,
        FeatureCode.MASTERDATA_CATEGORIES.value,
        FeatureCode.MASTERDATA_UNITS.value,
        FeatureCode.MASTERDATA_WAREHOUSES.value,
        FeatureCode.MASTERDATA_SUPPLIERS.value,
        FeatureCode.MASTERDATA_CUSTOMERS.value,
        FeatureCode.MASTERDATA_DISCOUNTS.value,
        # Reports - with export
        FeatureCode.REPORTS_BASIC.value,
        FeatureCode.REPORTS_SALES.value,
        FeatureCode.REPORTS_EXPORT.value,
    },
    "premium": {
        # POS - full
        FeatureCode.POS_TERMINAL.value,
        FeatureCode.POS_TRANSACTIONS.value,
        FeatureCode.POS_SHIFTS.value,
        # Inventory - full
        FeatureCode.INVENTORY_STOCK.value,
        FeatureCode.INVENTORY_ADJUSTMENTS.value,
        FeatureCode.INVENTORY_TRANSFER.value,
        # Masterdata - full
        FeatureCode.MASTERDATA_ITEMS.value,
        FeatureCode.MASTERDATA_CATEGORIES.value,
        FeatureCode.MASTERDATA_UNITS.value,
        FeatureCode.MASTERDATA_WAREHOUSES.value,
        FeatureCode.MASTERDATA_SUPPLIERS.value,
        FeatureCode.MASTERDATA_CUSTOMERS.value,
        FeatureCode.MASTERDATA_PRICE_LEVELS.value,
        FeatureCode.MASTERDATA_DISCOUNTS.value,
        FeatureCode.MASTERDATA_DISCOUNT_GROUPS.value,
        FeatureCode.MASTERDATA_PROMOTIONS.value,
        # Purchasing
        FeatureCode.PURCHASING_ORDERS.value,
        FeatureCode.PURCHASING_RECEIVING.value,
        # Reports - full
        FeatureCode.REPORTS_BASIC.value,
        FeatureCode.REPORTS_ADVANCED.value,
        FeatureCode.REPORTS_SALES.value,
        FeatureCode.REPORTS_EXPORT.value,
        # Platform
        FeatureCode.PLATFORM_API_ACCESS.value,
        FeatureCode.PLATFORM_AUDIT_ADVANCED.value,
        FeatureCode.PLATFORM_CUSTOM_FIELDS.value,
        # Loyalty
        FeatureCode.LOYALTY_POINTS.value,
        # HR
        FeatureCode.HR_EMPLOYEES.value,
    },
    "enterprise": {
        # Everything
        code.value for code in FeatureCode
    },
}


def get_feature_metadata(feature_code: str) -> Optional[FeatureMetadata]:
    """Get metadata for a feature code"""
    return FEATURE_REGISTRY.get(feature_code)


def get_features_by_module(module: FeatureModule) -> List[FeatureMetadata]:
    """Get all features for a module"""
    return [
        meta for meta in FEATURE_REGISTRY.values()
        if meta.module == module
    ]


def get_all_feature_codes() -> List[str]:
    """Get list of all feature codes"""
    return [code.value for code in FeatureCode]


def get_all_modules() -> List[FeatureModule]:
    """Get list of all modules"""
    return list(FeatureModule)


def get_tier_features(tier_code: str) -> Set[str]:
    """Get default features for a tier"""
    return TIER_DEFAULT_FEATURES.get(tier_code, set())


def get_features_grouped_by_module() -> Dict[str, List[FeatureMetadata]]:
    """Get all features grouped by module"""
    grouped: Dict[str, List[FeatureMetadata]] = {}
    for module in FeatureModule:
        grouped[module.value] = get_features_by_module(module)
    return grouped
