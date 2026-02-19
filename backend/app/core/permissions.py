"""
Permission Matrix for Harmony SaaS

Two distinct permission scopes:
1. System Permissions - Platform management (system.*)
2. Tenant Permissions - Tenant administration (tenant.*)

Future: Business Permissions for domain features (business.*)
"""
from enum import Enum


class SystemPermission(str, Enum):
    """Permissions for system users (platform management)"""

    # Tenant management
    TENANTS_VIEW = "system.tenants.view"
    TENANTS_CREATE = "system.tenants.create"
    TENANTS_UPDATE = "system.tenants.update"
    TENANTS_DELETE = "system.tenants.delete"
    TENANTS_IMPERSONATE = "system.tenants.impersonate"

    # Billing oversight
    BILLING_VIEW = "system.billing.view"
    BILLING_MANAGE = "system.billing.manage"

    # Subscription tiers
    TIERS_VIEW = "system.tiers.view"
    TIERS_MANAGE = "system.tiers.manage"

    # Coupons
    COUPONS_VIEW = "system.coupons.view"
    COUPONS_MANAGE = "system.coupons.manage"

    # Payment methods
    PAYMENT_METHODS_VIEW = "system.payment_methods.view"
    PAYMENT_METHODS_MANAGE = "system.payment_methods.manage"

    # System users
    USERS_VIEW = "system.users.view"
    USERS_CREATE = "system.users.create"
    USERS_UPDATE = "system.users.update"
    USERS_DELETE = "system.users.delete"

    # Tools & settings
    TOOLS_ACCESS = "system.tools.access"
    SETTINGS_VIEW = "system.settings.view"
    SETTINGS_MANAGE = "system.settings.manage"

    # Audit logs (system-wide)
    AUDIT_VIEW = "system.audit.view"
    AUDIT_MANAGE = "system.audit.manage"

    # Revenue & usage analytics
    REVENUE_VIEW = "system.revenue.view"
    USAGE_VIEW = "system.usage.view"
    USAGE_MANAGE = "system.usage.manage"


class TenantPermission(str, Enum):
    """Permissions for tenant users (tenant administration)"""

    # Tenant settings
    SETTINGS_VIEW = "tenant.settings.view"
    SETTINGS_EDIT = "tenant.settings.edit"

    # Billing (Owner only)
    BILLING_VIEW = "tenant.billing.view"
    BILLING_MANAGE = "tenant.billing.manage"
    ACCOUNT_DELETE = "tenant.account.delete"

    # User management
    USERS_VIEW = "tenant.users.view"
    USERS_CREATE = "tenant.users.create"
    USERS_UPDATE = "tenant.users.update"
    USERS_DELETE = "tenant.users.delete"
    USERS_INVITE = "tenant.users.invite"
    USERS_CHANGE_ROLE = "tenant.users.change_role"

    # Branch management
    BRANCHES_VIEW = "tenant.branches.view"
    BRANCHES_CREATE = "tenant.branches.create"
    BRANCHES_UPDATE = "tenant.branches.update"
    BRANCHES_DELETE = "tenant.branches.delete"

    # Audit logs (tenant-scoped)
    AUDIT_VIEW = "tenant.audit.view"

    # Files
    FILES_VIEW = "tenant.files.view"
    FILES_UPLOAD = "tenant.files.upload"
    FILES_DELETE = "tenant.files.delete"

    # Dashboard
    DASHBOARD_VIEW = "tenant.dashboard.view"
    STATS_VIEW = "tenant.stats.view"

    # Usage
    USAGE_VIEW = "tenant.usage.view"


# System role -> permissions mapping
SYSTEM_ROLE_PERMISSIONS: dict[str, set[SystemPermission]] = {
    "admin": set(SystemPermission),  # All system permissions

    "operator": {
        # View-only access for support
        SystemPermission.TENANTS_VIEW,
        SystemPermission.BILLING_VIEW,
        SystemPermission.TIERS_VIEW,
        SystemPermission.COUPONS_VIEW,
        SystemPermission.PAYMENT_METHODS_VIEW,
        SystemPermission.USERS_VIEW,
        SystemPermission.SETTINGS_VIEW,
        SystemPermission.AUDIT_VIEW,
        SystemPermission.REVENUE_VIEW,
        SystemPermission.USAGE_VIEW,
    },
}


# Tenant role -> permissions mapping
TENANT_ROLE_PERMISSIONS: dict[str, set[TenantPermission]] = {
    "owner": set(TenantPermission),  # All tenant permissions

    "admin": set(TenantPermission) - {
        # Admin cannot manage billing or delete account
        TenantPermission.BILLING_MANAGE,
        TenantPermission.ACCOUNT_DELETE,
    },

    "member": {
        # Basic read access + file upload
        TenantPermission.SETTINGS_VIEW,
        TenantPermission.USERS_VIEW,
        TenantPermission.BRANCHES_VIEW,
        TenantPermission.FILES_VIEW,
        TenantPermission.FILES_UPLOAD,
        TenantPermission.DASHBOARD_VIEW,
        TenantPermission.USAGE_VIEW,
    },
}


def has_system_permission(system_role: str, permission: SystemPermission) -> bool:
    """Check if a system role has a specific permission."""
    role_perms = SYSTEM_ROLE_PERMISSIONS.get(system_role, set())
    return permission in role_perms


def has_tenant_permission(tenant_role: str, permission: TenantPermission) -> bool:
    """Check if a tenant role has a specific permission."""
    role_perms = TENANT_ROLE_PERMISSIONS.get(tenant_role, set())
    return permission in role_perms


def get_system_permissions(system_role: str) -> set[SystemPermission]:
    """Get all permissions for a system role."""
    return SYSTEM_ROLE_PERMISSIONS.get(system_role, set())


def get_tenant_permissions(tenant_role: str) -> set[TenantPermission]:
    """Get all permissions for a tenant role."""
    return TENANT_ROLE_PERMISSIONS.get(tenant_role, set())


# ========================================
# Backward Compatibility
# Maps old Permission enum to new structure
# TODO: Remove after full migration
# ========================================

class Permission(str, Enum):
    """Legacy permission enum - mapped to new structure"""
    # Users -> tenant.users.*
    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_UPDATE = "users.update"
    USERS_DELETE = "users.delete"
    USERS_INVITE = "users.invite"
    USERS_CHANGE_ROLE = "users.change_role"

    # Branches -> tenant.branches.*
    BRANCHES_VIEW = "branches.view"
    BRANCHES_CREATE = "branches.create"
    BRANCHES_UPDATE = "branches.update"
    BRANCHES_DELETE = "branches.delete"

    # Settings -> tenant.settings.*
    SETTINGS_VIEW = "settings.view"
    SETTINGS_UPDATE = "settings.update"

    # Audit -> tenant.audit.*
    AUDIT_VIEW = "audit.view"

    # Dashboard -> tenant.dashboard.*
    DASHBOARD_VIEW = "dashboard.view"
    STATS_VIEW = "stats.view"

    # Files -> tenant.files.*
    FILES_VIEW = "files.view"
    FILES_UPLOAD = "files.upload"
    FILES_DELETE = "files.delete"


# Legacy role -> permission mapping
ROLE_PERMISSIONS: dict[str, set[Permission]] = {
    "super_admin": set(Permission),  # Maps to system.admin
    "admin": {
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_UPDATE,
        Permission.USERS_DELETE,
        Permission.USERS_INVITE,
        Permission.USERS_CHANGE_ROLE,
        Permission.BRANCHES_VIEW,
        Permission.BRANCHES_CREATE,
        Permission.BRANCHES_UPDATE,
        Permission.BRANCHES_DELETE,
        Permission.SETTINGS_VIEW,
        Permission.SETTINGS_UPDATE,
        Permission.AUDIT_VIEW,
        Permission.DASHBOARD_VIEW,
        Permission.STATS_VIEW,
        Permission.FILES_VIEW,
        Permission.FILES_UPLOAD,
        Permission.FILES_DELETE,
    },
    "staff": {
        Permission.USERS_VIEW,
        Permission.BRANCHES_VIEW,
        Permission.DASHBOARD_VIEW,
        Permission.FILES_VIEW,
        Permission.FILES_UPLOAD,
    },
    # New role mappings (for transition)
    "owner": set(Permission) - {Permission.USERS_CHANGE_ROLE},  # Owner has all
    "member": {
        Permission.USERS_VIEW,
        Permission.BRANCHES_VIEW,
        Permission.DASHBOARD_VIEW,
        Permission.FILES_VIEW,
        Permission.FILES_UPLOAD,
    },
}


def has_permission(role: str, permission: Permission) -> bool:
    """Legacy: Check if a role has a specific permission."""
    role_perms = ROLE_PERMISSIONS.get(role, set())
    return permission in role_perms


def get_permissions(role: str) -> set[Permission]:
    """Legacy: Get all permissions for a role."""
    return ROLE_PERMISSIONS.get(role, set())
