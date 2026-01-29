# Permission Matrix

Harmony uses a role-based access control (RBAC) system with three roles and granular permissions.

## Roles

| Role | Scope | Description |
|------|-------|-------------|
| `super_admin` | System-wide | Full platform access, manages all tenants |
| `admin` | Tenant | Manages their tenant's users, branches, and settings |
| `staff` | Tenant | Read-only access within their tenant |

## Permission Matrix

| Permission | super_admin | admin | staff |
|------------|:-----------:|:-----:|:-----:|
| `users.view` | Y | Y | Y |
| `users.create` | Y | Y | - |
| `users.update` | Y | Y | - |
| `users.delete` | Y | Y | - |
| `users.invite` | Y | Y | - |
| `users.change_role` | Y | Y | - |
| `branches.view` | Y | Y | Y |
| `branches.create` | Y | Y | - |
| `branches.update` | Y | Y | - |
| `branches.delete` | Y | Y | - |
| `settings.view` | Y | Y | - |
| `settings.update` | Y | Y | - |
| `audit.view` | Y | Y | - |
| `dashboard.view` | Y | Y | Y |
| `stats.view` | Y | Y | - |

## Backend Usage

### Dependency injection

```python
from app.api.deps import require_permission
from app.core.permissions import Permission

@router.post("/", dependencies=[Depends(require_permission(Permission.USERS_CREATE))])
async def create_user(...):
    ...
```

### Direct check

```python
from app.core.permissions import has_permission, Permission

if has_permission(user.role, Permission.BRANCHES_DELETE):
    # allow delete
```

## Frontend Usage

### usePermission hook

```tsx
import { usePermission } from '@/hooks/use-permission';

function UserActions() {
  const canCreate = usePermission('users.create');
  const canDelete = usePermission('users.delete');

  return (
    <div>
      {canCreate && <Button>Add User</Button>}
      {canDelete && <Button variant="destructive">Delete</Button>}
    </div>
  );
}
```

### usePermissions (multiple)

```tsx
import { usePermissions } from '@/hooks/use-permission';

const [canCreate, canDelete] = usePermissions('users.create', 'users.delete');
```

## Extending Permissions

To add a new permission:

1. Add to `Permission` enum in `backend/app/core/permissions.py`
2. Add to `ROLE_PERMISSIONS` dict for each role that should have it
3. Add to `ROLE_PERMISSIONS` in `frontend/src/hooks/use-permission.ts`
4. Update this document
