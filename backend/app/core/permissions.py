"""
Permission Matrix for Harmony SaaS

Defines granular permissions and maps them to roles.
Uses a simple dict-based approach (no DB table) for boilerplate simplicity.
"""
from enum import Enum


class Permission(str, Enum):
    # Users
    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_UPDATE = "users.update"
    USERS_DELETE = "users.delete"
    USERS_INVITE = "users.invite"
    USERS_CHANGE_ROLE = "users.change_role"

    # Branches
    BRANCHES_VIEW = "branches.view"
    BRANCHES_CREATE = "branches.create"
    BRANCHES_UPDATE = "branches.update"
    BRANCHES_DELETE = "branches.delete"

    # Tenant Settings
    SETTINGS_VIEW = "settings.view"
    SETTINGS_UPDATE = "settings.update"

    # Audit Logs
    AUDIT_VIEW = "audit.view"

    # Dashboard / Stats
    DASHBOARD_VIEW = "dashboard.view"
    STATS_VIEW = "stats.view"

    # Files
    FILES_VIEW = "files.view"
    FILES_UPLOAD = "files.upload"
    FILES_DELETE = "files.delete"


# Role -> set of permissions mapping
ROLE_PERMISSIONS: dict[str, set[Permission]] = {
    "super_admin": set(Permission),  # all permissions

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
}


def has_permission(role: str, permission: Permission) -> bool:
    """Check if a role has a specific permission."""
    role_perms = ROLE_PERMISSIONS.get(role, set())
    return permission in role_perms


def get_permissions(role: str) -> set[Permission]:
    """Get all permissions for a role."""
    return ROLE_PERMISSIONS.get(role, set())
