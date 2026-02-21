# Migration Guide: Boilerplate to Business Project

> Instructions for Claude CLI when pulling updates from the Harmony SaaS boilerplate into a business project.

---

## Critical Architectural Changes

When merging updates from this boilerplate, be aware of these breaking changes:

### 1. User Architecture Redesign (Migration `l7m9n0o1p2q3`)

**OLD (Removed):**
```python
# User model had:
role = Column(String)  # "admin", "staff", "super_admin"
is_super_admin = Column(Boolean)
```

**NEW (Current):**
```python
# User model now has:
system_role = Column(Enum)  # For platform users: "admin", "operator"
tenant_role = Column(Enum)  # For tenant users: "owner", "admin", "member"
business_role = Column(String)  # For future ERP roles
```

**Key Rules:**
- `tenant_id IS NULL` → System user (uses `system_role`)
- `tenant_id IS NOT NULL` → Tenant user (uses `tenant_role`)
- One `owner` per tenant (enforced by unique constraint)
- `User.role` property exists for backward compatibility but maps to new columns

**Migration Required:**
- Run `alembic upgrade head` to apply migration
- Update any code querying `User.role` directly
- Update any code checking `is_super_admin` (use `user.is_system_admin` property)

---

### 2. Permission System Split

**OLD:**
```python
from app.core.permissions import Permission, require_permission
```

**NEW:**
```python
from app.core.permissions import (
    SystemPermission,      # 37 permissions for platform management
    TenantPermission,      # 22 permissions for tenant operations
    require_system_permission,
    require_tenant_permission,
)
```

**Backend Usage:**
```python
# For system admin endpoints:
@router.get("/", dependencies=[Depends(require_system_permission(SystemPermission.TENANTS_VIEW))])

# For tenant endpoints:
@router.get("/", dependencies=[Depends(require_tenant_permission(TenantPermission.USERS_CREATE))])
```

**Frontend Usage:**
```typescript
import { useSystemPermission, useTenantPermission } from '@/hooks/use-permission';

// Check permissions
const canViewTenants = useSystemPermission(SystemPermission.TENANTS_VIEW);
const canCreateUsers = useTenantPermission(TenantPermission.USERS_CREATE);
```

---

### 3. Feature Flag System

**New Files:**
- `backend/app/core/features.py` - Feature registry with 38+ feature codes
- `backend/app/services/feature_service.py` - Feature checking logic
- `frontend/src/types/features.ts` - Frontend feature types
- `frontend/src/hooks/use-feature.ts` - Feature hooks

**Backend Usage:**
```python
from app.api.deps import require_feature

@router.get("/", dependencies=[Depends(require_feature("inventory.adjustments"))])
async def list_adjustments(...):
    pass
```

**Frontend Usage:**
```typescript
import { useFeature, FeatureGate } from '@/hooks/use-feature';

// Hook
const hasFeature = useFeature(FeatureCode.INVENTORY_ADJUSTMENTS);

// Component
<FeatureGate feature={FeatureCode.INVENTORY_ADJUSTMENTS} fallback={<UpgradePrompt />}>
  <InventoryAdjustments />
</FeatureGate>
```

**Tier-Feature Mapping:**
- Features are stored in `subscription_tiers.features` (JSON array)
- Tenant overrides in `tenant.features` (JSON: `{enabled: [], disabled: []}`)
- Features loaded into auth store on login

---

### 4. Notification System (Migration `m8n0o1p2q3r4`)

**New Tables:**
- `notifications` - User notifications
- `notification_preferences` - Per-user notification settings

**New Files:**
- `backend/app/models/notification.py`
- `backend/app/services/notification_service.py`
- `backend/app/api/v1/endpoints/notifications.py`
- `frontend/src/lib/api/notifications.ts`
- `frontend/src/hooks/use-notifications.ts`
- `frontend/src/components/layout/NotificationDropdown.tsx`

**Sending Notifications (Backend):**
```python
from app.services.notification_service import NotificationService

service = NotificationService(db)
service.notify_upgrade_approved(user_id, tenant_id, tier_name, transaction_id)
service.notify_user_joined(admin_user_ids, tenant_id, user_name, user_email)
```

---

### 5. Database Dependencies

**Dependencies between models:**
```
Tenant
  ├── User (tenant_id FK, CASCADE)
  ├── Branch (tenant_id FK, CASCADE)
  ├── Notification (tenant_id FK, CASCADE)
  └── ... other tenant-scoped models

User
  ├── Notification (user_id FK, CASCADE)
  └── NotificationPreference (user_id FK, CASCADE)
```

---

## Migration Checklist

When pulling updates:

1. **Database Migrations**
   ```bash
   cd backend
   alembic upgrade head
   ```

2. **Check for Breaking Changes**
   - Search for `User.role` usage → Update to `system_role`/`tenant_role`
   - Search for `is_super_admin` → Use `user.is_system_admin` property
   - Search for `Permission.` → Update to `SystemPermission`/`TenantPermission`

3. **Update Environment Variables**
   - Check `.env.example` for new variables

4. **Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

5. **Test Critical Paths**
   - Login as system admin
   - Login as tenant owner
   - Login as tenant member
   - Check notification dropdown
   - Check feature-gated pages

---

## File Locations Quick Reference

| Component | Backend | Frontend |
|-----------|---------|----------|
| User Model | `app/models/user.py` | `types/auth.ts` |
| Permissions | `app/core/permissions.py` | `hooks/use-permission.ts` |
| Features | `app/core/features.py`, `app/services/feature_service.py` | `types/features.ts`, `hooks/use-feature.ts` |
| Notifications | `app/models/notification.py`, `app/services/notification_service.py` | `lib/api/notifications.ts`, `hooks/use-notifications.ts` |
| Auth Store | - | `lib/store/authStore.ts` |
| API Dependencies | `app/api/deps.py` | - |

---

## Questions to Ask Before Merging

1. Does the business project have custom user roles? If yes, map them to `business_role`.
2. Does the business project have custom features? If yes, add them to `FeatureCode` enum.
3. Does the business project send notifications? If yes, integrate with `NotificationService`.
4. Are there any direct database queries on `users.role`? These will break.

---

*Last updated: 2026-02-21*
