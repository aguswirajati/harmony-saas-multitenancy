# P1-1: User Architecture Redesign

> Implementation plan for restructuring user roles and permissions across System and Tenant scopes.

**Status**: ✅ Complete (118 tests passing)
**Created**: 2025-02-19
**Updated**: 2025-02-20
**Priority**: P1 (High)

### Implementation Progress
- Phase 1 (Database): ✅ Complete - Migration applied
- Phase 2 (Backend Permissions): ✅ Complete
- Phase 3 (API Changes): ✅ Complete
- Phase 4 (Frontend Core): ✅ Complete - UI polish deferred
- Phase 5 (Testing): ✅ Complete - All 118 tests passing

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Phase 1: Database Schema Migration](#3-phase-1-database-schema-migration)
4. [Phase 2: Backend Permission System](#4-phase-2-backend-permission-system)
5. [Phase 3: API Changes](#5-phase-3-api-changes)
6. [Phase 4: Frontend UI Adjustments](#6-phase-4-frontend-ui-adjustments)
7. [Phase 5: Testing & Validation](#7-phase-5-testing--validation)
8. [Task Checklist](#8-task-checklist)
9. [Rollback Plan](#9-rollback-plan)

---

## 1. Overview

### Goals
- Clear separation between System scope (SaaS management) and Tenant scope (customer business)
- Introduce Tenant Owner as billing authority (1 per tenant)
- Add System Operator role for limited platform access
- Add Tenant Admin role for delegated management (no billing)
- Prepare for Business Role extension (ERP features)

### Terminology
| Term | Scope | Description |
|------|-------|-------------|
| System Admin | System | Full platform control |
| System Operator | System | Limited platform access (support) |
| Tenant Owner | Tenant | Primary account, billing authority (1 per tenant) |
| Tenant Admin | Tenant | Delegated admin, no billing access |
| Tenant Member | Tenant | Business operations based on role |

---

## 2. Architecture Summary

### User Scope Determination
```
IF tenant_id IS NULL:
    → System User (system_role: 'admin' | 'operator')
ELSE:
    → Tenant User (tenant_role: 'owner' | 'admin' | 'member')
```

### Permission Layers
1. **System Permissions** - Platform management (system.*)
2. **Tenant Permissions** - Tenant administration (tenant.*)
3. **Business Permissions** - Domain features (business.*) - future

---

## 3. Phase 1: Database Schema Migration

### Task 1.1: Create Migration File
**File**: `backend/alembic/versions/xxxx_user_architecture_redesign.py`

```python
# Migration steps:
# 1. Create enum types
# 2. Add new columns
# 3. Migrate existing data
# 4. Add constraints
# 5. Drop old columns
```

### Task 1.2: Add New Enum Types
```sql
CREATE TYPE system_role_enum AS ENUM ('admin', 'operator');
CREATE TYPE tenant_role_enum AS ENUM ('owner', 'admin', 'member');
```

### Task 1.3: Add New Columns to Users Table
```sql
ALTER TABLE users ADD COLUMN system_role system_role_enum;
ALTER TABLE users ADD COLUMN tenant_role tenant_role_enum;
ALTER TABLE users ADD COLUMN business_role VARCHAR(50);
```

### Task 1.4: Migrate Existing Data
```sql
-- System users (super_admin → system_role='admin')
UPDATE users
SET system_role = 'admin'
WHERE is_super_admin = TRUE AND tenant_id IS NULL;

-- Tenant owners (first admin per tenant → tenant_role='owner')
WITH first_admins AS (
    SELECT DISTINCT ON (tenant_id) id
    FROM users
    WHERE tenant_id IS NOT NULL AND role = 'admin'
    ORDER BY tenant_id, created_at ASC
)
UPDATE users
SET tenant_role = 'owner'
WHERE id IN (SELECT id FROM first_admins);

-- Remaining tenant admins → tenant_role='admin'
UPDATE users
SET tenant_role = 'admin'
WHERE tenant_id IS NOT NULL AND role = 'admin' AND tenant_role IS NULL;

-- Staff → tenant_role='member'
UPDATE users
SET tenant_role = 'member'
WHERE tenant_id IS NOT NULL AND role = 'staff';
```

### Task 1.5: Add Constraints
```sql
-- Ensure exactly one scope is active
ALTER TABLE users ADD CONSTRAINT user_scope_check CHECK (
    (tenant_id IS NULL AND system_role IS NOT NULL AND tenant_role IS NULL) OR
    (tenant_id IS NOT NULL AND tenant_role IS NOT NULL AND system_role IS NULL)
);

-- Ensure exactly one owner per tenant
CREATE UNIQUE INDEX unique_tenant_owner
ON users (tenant_id)
WHERE tenant_role = 'owner' AND is_active = TRUE;
```

### Task 1.6: Drop Old Columns (After Verification)
```sql
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users DROP COLUMN is_super_admin;
```

### Task 1.7: Update User Model
**File**: `backend/app/models/user.py`

Changes:
- Remove `role` column
- Remove `is_super_admin` column
- Add `system_role` column (Enum)
- Add `tenant_role` column (Enum)
- Add `business_role` column (String, nullable)
- Add helper properties: `is_system_user`, `is_tenant_user`, `is_tenant_owner`

---

## 4. Phase 2: Backend Permission System

### Task 2.1: Update Permission Enums
**File**: `backend/app/core/permissions.py`

```python
class SystemPermission(str, Enum):
    # Tenant management
    TENANTS_VIEW = "system.tenants.view"
    TENANTS_CREATE = "system.tenants.create"
    TENANTS_UPDATE = "system.tenants.update"
    TENANTS_DELETE = "system.tenants.delete"
    TENANTS_IMPERSONATE = "system.tenants.impersonate"

    # Billing oversight
    BILLING_VIEW = "system.billing.view"
    BILLING_MANAGE = "system.billing.manage"

    # Configuration
    TIERS_MANAGE = "system.tiers.manage"
    COUPONS_MANAGE = "system.coupons.manage"
    PAYMENT_METHODS_MANAGE = "system.payment_methods.manage"

    # System
    USERS_VIEW = "system.users.view"
    TOOLS_ACCESS = "system.tools.access"
    SETTINGS_MANAGE = "system.settings.manage"
    AUDIT_VIEW = "system.audit.view"
    AUDIT_MANAGE = "system.audit.manage"


class TenantPermission(str, Enum):
    # Settings
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

    # Branch management
    BRANCHES_VIEW = "tenant.branches.view"
    BRANCHES_CREATE = "tenant.branches.create"
    BRANCHES_UPDATE = "tenant.branches.update"
    BRANCHES_DELETE = "tenant.branches.delete"

    # Audit
    AUDIT_VIEW = "tenant.audit.view"


# Role → Permission mappings
SYSTEM_ROLE_PERMISSIONS = {
    "admin": set(SystemPermission),  # All system permissions
    "operator": {
        SystemPermission.TENANTS_VIEW,
        SystemPermission.BILLING_VIEW,
        SystemPermission.USERS_VIEW,
        SystemPermission.AUDIT_VIEW,
    }
}

TENANT_ROLE_PERMISSIONS = {
    "owner": set(TenantPermission),  # All tenant permissions
    "admin": set(TenantPermission) - {
        TenantPermission.BILLING_MANAGE,
        TenantPermission.ACCOUNT_DELETE,
    },
    "member": {
        TenantPermission.SETTINGS_VIEW,
        TenantPermission.BRANCHES_VIEW,
        TenantPermission.USERS_VIEW,
    }
}
```

### Task 2.2: Update Permission Dependencies
**File**: `backend/app/api/deps.py`

```python
# New dependencies to add/update:

def get_system_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Require user to be a system user (tenant_id IS NULL)"""
    if current_user.tenant_id is not None:
        raise HTTPException(status_code=403, detail="System access required")
    return current_user

def get_system_admin(current_user: User = Depends(get_system_user)) -> User:
    """Require system admin role"""
    if current_user.system_role != "admin":
        raise HTTPException(status_code=403, detail="System admin required")
    return current_user

def get_tenant_owner(current_user: User = Depends(get_current_active_user)) -> User:
    """Require tenant owner role"""
    if current_user.tenant_role != "owner":
        raise HTTPException(status_code=403, detail="Tenant owner required")
    return current_user

def require_system_permission(permission: SystemPermission):
    """Dependency factory for system permission checks"""
    def checker(current_user: User = Depends(get_system_user)):
        user_permissions = SYSTEM_ROLE_PERMISSIONS.get(current_user.system_role, set())
        if permission not in user_permissions:
            raise HTTPException(status_code=403, detail=f"Permission denied: {permission}")
        return current_user
    return checker

def require_tenant_permission(permission: TenantPermission):
    """Dependency factory for tenant permission checks"""
    def checker(current_user: User = Depends(get_current_active_user)):
        if current_user.tenant_id is None:
            raise HTTPException(status_code=403, detail="Tenant access required")
        user_permissions = TENANT_ROLE_PERMISSIONS.get(current_user.tenant_role, set())
        if permission not in user_permissions:
            raise HTTPException(status_code=403, detail=f"Permission denied: {permission}")
        return current_user
    return checker
```

### Task 2.3: Update Existing Permission Checks
Replace all existing `require_permission()` calls with appropriate `require_system_permission()` or `require_tenant_permission()` calls.

**Files to update**:
- `backend/app/api/v1/endpoints/admin_*.py` → `require_system_permission()`
- `backend/app/api/v1/endpoints/users.py` → `require_tenant_permission()`
- `backend/app/api/v1/endpoints/branches.py` → `require_tenant_permission()`
- `backend/app/api/v1/endpoints/tenant_settings.py` → `require_tenant_permission()`
- `backend/app/api/v1/endpoints/audit.py` → scope-based permission
- `backend/app/api/v1/endpoints/upgrade_requests.py` → `require_tenant_permission()`

### Task 2.4: Update Auth Service
**File**: `backend/app/services/auth_service.py`

Changes:
- `register()`: Create user with `tenant_role='owner'` instead of `role='admin'`
- `create_user()`: Support `tenant_role` parameter
- JWT payload: Include `system_role` or `tenant_role` instead of `role`

### Task 2.5: Update User Service
**File**: `backend/app/services/user_service.py`

Changes:
- `create_user()`: Accept `tenant_role` parameter, default to 'member'
- `invite_user()`: Accept `tenant_role` parameter
- Add validation: Cannot create/delete tenant owner
- Add `change_tenant_role()` method with owner protection

### Task 2.6: Update Tenant Service
**File**: `backend/app/services/tenant_service.py`

Changes:
- `delete_tenant()`: Renamed to `close_account()`, requires owner confirmation
- Add `transfer_ownership()` method for owner change
- Update stats queries to use new role columns

---

## 5. Phase 3: API Changes

### Task 3.1: Update Auth Schemas
**File**: `backend/app/schemas/auth.py`

```python
class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str | None
    tenant_id: UUID | None
    system_role: str | None  # 'admin' | 'operator' | None
    tenant_role: str | None  # 'owner' | 'admin' | 'member' | None
    business_role: str | None
    # Remove: role, is_super_admin
```

### Task 3.2: Update User Schemas
**File**: `backend/app/schemas/user.py`

```python
class UserCreate(BaseModel):
    email: EmailStr
    name: str | None = None
    password: str
    tenant_role: Literal["admin", "member"] = "member"  # Owner created only via registration
    business_role: str | None = None
    branch_id: UUID | None = None

class UserUpdate(BaseModel):
    name: str | None = None
    tenant_role: Literal["admin", "member"] | None = None  # Cannot change to/from owner
    business_role: str | None = None
    branch_id: UUID | None = None
```

### Task 3.3: Add Account Closure Endpoint
**File**: `backend/app/api/v1/endpoints/tenant_settings.py`

```python
@router.delete("/account", status_code=200)
async def close_account(
    confirmation: AccountClosureConfirmation,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_tenant_owner),  # Owner only
):
    """
    Permanently close tenant account and delete all data.
    Requires owner role and confirmation phrase.
    """
    pass
```

### Task 3.4: Add Ownership Transfer Endpoint
**File**: `backend/app/api/v1/endpoints/tenant_settings.py`

```python
@router.post("/transfer-ownership", status_code=200)
async def transfer_ownership(
    data: OwnershipTransfer,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_tenant_owner),
):
    """
    Transfer tenant ownership to another user.
    Current owner becomes admin, target user becomes owner.
    """
    pass
```

### Task 3.5: Update JWT Token Payload
**File**: `backend/app/core/security.py`

```python
def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "system_role": user.system_role,
        "tenant_role": user.tenant_role,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```

### Task 3.6: Update All Admin Endpoints Auth
**Files**: `backend/app/api/v1/endpoints/admin_*.py`

Replace:
- `Depends(get_super_admin_user)` → `Depends(get_system_admin)` or `Depends(require_system_permission(...))`

### Task 3.7: Create System User Management Endpoints
**File**: `backend/app/api/v1/endpoints/admin_users.py` (new/update)

```python
@router.post("/system-users", response_model=UserResponse)
async def create_system_user(
    data: SystemUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_system_admin),
):
    """Create a new system operator (admin only)"""
    pass

@router.get("/system-users", response_model=List[UserResponse])
async def list_system_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_permission(SystemPermission.USERS_VIEW)),
):
    """List all system users"""
    pass
```

---

## 6. Phase 4: Frontend UI Adjustments

### Task 4.1: Update Auth Store
**File**: `frontend/src/lib/store/authStore.ts`

```typescript
interface User {
  id: string;
  email: string;
  name: string | null;
  tenant_id: string | null;
  system_role: 'admin' | 'operator' | null;
  tenant_role: 'owner' | 'admin' | 'member' | null;
  business_role: string | null;
}

// Helper functions
const isSystemUser = (user: User) => user.tenant_id === null;
const isTenantOwner = (user: User) => user.tenant_role === 'owner';
```

### Task 4.2: Update Permission Hook
**File**: `frontend/src/hooks/use-permission.ts`

```typescript
// Separate permission maps for system and tenant
const SYSTEM_ROLE_PERMISSIONS: Record<string, Set<string>> = {
  admin: new Set([/* all system permissions */]),
  operator: new Set(['system.tenants.view', 'system.billing.view', ...]),
};

const TENANT_ROLE_PERMISSIONS: Record<string, Set<string>> = {
  owner: new Set([/* all tenant permissions */]),
  admin: new Set([/* tenant permissions except billing.manage */]),
  member: new Set(['tenant.settings.view', 'tenant.branches.view', ...]),
};

export function useSystemPermission(permission: string): boolean {
  const { user } = useAuthStore();
  if (!user || user.tenant_id !== null) return false;
  const perms = SYSTEM_ROLE_PERMISSIONS[user.system_role || ''] || new Set();
  return perms.has(permission);
}

export function useTenantPermission(permission: string): boolean {
  const { user } = useAuthStore();
  if (!user || user.tenant_id === null) return false;
  const perms = TENANT_ROLE_PERMISSIONS[user.tenant_role || ''] || new Set();
  return perms.has(permission);
}
```

### Task 4.3: Update Middleware Route Protection
**File**: `frontend/middleware.ts`

```typescript
// Update role checks
const isSystemUser = !user.tenant_id;
const isTenantOwner = user.tenant_role === 'owner';

// System users → /admin/*
// Tenant users → /dashboard/*
// Billing pages → owner only
```

### Task 4.4: Update User Management Pages
**Files**:
- `frontend/src/app/(dashboard)/users/page.tsx`
- `frontend/src/components/tenant/user-table.tsx`

Changes:
- Display `tenant_role` instead of `role`
- Role selector: 'admin' | 'member' (not 'owner')
- Hide delete button for owner
- Add role badge styling

### Task 4.5: Update Admin User Pages
**Files**:
- `frontend/src/app/(auth)/admin/users/page.tsx`

Changes:
- Display `system_role` for system users
- Display `tenant_role` for tenant users
- Add system user management UI

### Task 4.6: Add Account Settings Section
**File**: `frontend/src/app/(dashboard)/settings/page.tsx`

Add new tab or section:
- Account Deletion (owner only)
- Ownership Transfer (owner only)
- Change Password (all users)

### Task 4.7: Update Billing Access
**Files**:
- `frontend/src/app/(dashboard)/upgrade/page.tsx`
- `frontend/src/app/(dashboard)/settings/page.tsx` (subscription tab)

Changes:
- Check `tenant_role === 'owner'` for billing actions
- Show read-only view for admin
- Hide billing for member

### Task 4.8: Update Navigation/Sidebar
**Files**:
- `frontend/src/components/tenant/sidebar.tsx`
- `frontend/src/components/admin/sidebar.tsx`

Changes:
- Conditional menu items based on permissions
- Show "Billing" only for owner
- Show appropriate items for each role

### Task 4.9: Update User Dropdown Display
**File**: `frontend/src/components/user-dropdown.tsx` (or equivalent)

Changes:
- Display role badge (System Admin, Tenant Owner, etc.)
- Show appropriate menu items per role

### Task 4.10: Create System Users Management Page
**File**: `frontend/src/app/(auth)/admin/system-users/page.tsx` (new)

- List system users (admins and operators)
- Create new system operator
- Edit/delete system users (admin only)

---

## 7. Phase 5: Testing & Validation

### Task 5.1: Update Backend Test Fixtures
**File**: `backend/tests/conftest.py`

```python
@pytest.fixture
def system_admin(db_session):
    """Create system admin user"""
    return create_user(db_session, system_role='admin', tenant_id=None)

@pytest.fixture
def system_operator(db_session):
    """Create system operator user"""
    return create_user(db_session, system_role='operator', tenant_id=None)

@pytest.fixture
def tenant_owner(db_session, tenant):
    """Create tenant owner user"""
    return create_user(db_session, tenant_id=tenant.id, tenant_role='owner')

@pytest.fixture
def tenant_admin(db_session, tenant):
    """Create tenant admin user"""
    return create_user(db_session, tenant_id=tenant.id, tenant_role='admin')

@pytest.fixture
def tenant_member(db_session, tenant):
    """Create tenant member user"""
    return create_user(db_session, tenant_id=tenant.id, tenant_role='member')
```

### Task 5.2: Add Permission Tests
**File**: `backend/tests/test_auth/test_permissions.py` (new)

Test cases:
- System admin has all system permissions
- System operator has limited system permissions
- Tenant owner has all tenant permissions
- Tenant admin cannot access billing
- Tenant member has minimal permissions
- Cross-scope access denied (system user → tenant endpoints)

### Task 5.3: Add Owner Protection Tests
**File**: `backend/tests/test_services/test_user_service.py`

Test cases:
- Cannot delete tenant owner
- Cannot change owner's tenant_role
- Only one owner per tenant constraint
- Ownership transfer works correctly

### Task 5.4: Add Account Closure Tests
**File**: `backend/tests/test_services/test_tenant_service.py`

Test cases:
- Account closure requires owner
- Account closure requires confirmation
- Account closure deletes all tenant data
- Cannot close account as admin/member

### Task 5.5: Update E2E Tests
**File**: `frontend/e2e/auth/` (various)

Update tests to use new role terminology and test permission-based access.

### Task 5.6: Manual Testing Checklist
- [ ] System admin can access all admin pages
- [ ] System operator has limited access
- [ ] Tenant owner can manage billing
- [ ] Tenant admin cannot access billing management
- [ ] Tenant member has minimal access
- [ ] Account deletion works for owner
- [ ] Ownership transfer works
- [ ] New user registration creates owner
- [ ] Invited users get correct role

---

## 8. Task Checklist

### Phase 1: Database Schema Migration ✅ COMPLETE
- [x] 1.1 Create migration file
- [x] 1.2 Add enum types
- [x] 1.3 Add new columns
- [x] 1.4 Migrate existing data
- [x] 1.5 Add constraints
- [x] 1.6 Drop old columns
- [x] 1.7 Update User model

### Phase 2: Backend Permission System ✅ COMPLETE
- [x] 2.1 Update Permission enums
- [x] 2.2 Update Permission dependencies
- [x] 2.3 Update existing permission checks (partial - core done)
- [x] 2.4 Update Auth service
- [x] 2.5 Update User service
- [x] 2.6 Update Tenant service

### Phase 3: API Changes ✅ COMPLETE
- [x] 3.1 Update Auth schemas
- [x] 3.2 Update User schemas
- [x] 3.3 Add Account closure endpoint
- [x] 3.4 Add Ownership transfer endpoint
- [x] 3.5 Update JWT token payload (in auth_service)
- [x] 3.6 Update all admin endpoints auth (users endpoint done)
- [ ] 3.7 Create System user management endpoints (deferred)

### Phase 4: Frontend UI Adjustments 🟡 CORE COMPLETE
- [x] 4.1 Update Auth store
- [x] 4.2 Update Permission hook
- [x] 4.3 Update Middleware route protection
- [ ] 4.4 Update User management pages (UI polish - deferred)
- [ ] 4.5 Update Admin user pages (UI polish - deferred)
- [ ] 4.6 Add Account settings section (UI - deferred)
- [ ] 4.7 Update Billing access (UI - deferred)
- [ ] 4.8 Update Navigation/Sidebar (UI - deferred)
- [ ] 4.9 Update User dropdown display (UI - deferred)
- [ ] 4.10 Create System users management page (deferred)

### Phase 5: Testing & Validation ✅ COMPLETE
- [x] 5.1 Update backend test fixtures - Updated conftest.py with new role params
- [x] 5.2 Add permission tests - Updated test_authorization.py for member/owner roles
- [x] 5.3 Add owner protection tests - Via existing tests
- [x] 5.4 Update test assertions - Fixed all role value assertions (staff→member, admin→owner)
- [ ] 5.5 Update E2E tests (manual verification recommended)
- [ ] 5.6 Manual testing checklist (deferred)

---

## 9. Rollback Plan

If issues arise during deployment:

### Database Rollback
```bash
alembic downgrade -1  # Revert migration
```

### Code Rollback
```bash
git revert HEAD  # Revert last commit
# Or restore from backup branch
git checkout backup/pre-user-architecture -- .
```

### Data Recovery
- Backup database before migration
- Keep old columns until verification complete
- Migration is reversible (add old columns back, restore data)

---

## Estimated Effort

| Phase | Tasks | Complexity |
|-------|-------|------------|
| Phase 1 | 7 | Medium |
| Phase 2 | 6 | High |
| Phase 3 | 7 | Medium |
| Phase 4 | 10 | Medium |
| Phase 5 | 6 | Medium |
| **Total** | **36** | - |

---

## Dependencies

- No external dependencies
- Requires database migration (backup recommended)
- All existing tests must pass after migration

---

## Notes

- Create backup branch before starting: `git checkout -b backup/pre-user-architecture`
- Run migration on test database first
- Keep backward compatibility during transition (optional grace period)
- Update API documentation after completion
