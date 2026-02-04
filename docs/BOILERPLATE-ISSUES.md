# Boilerplate Issues & Fix Instructions

This document tracks issues identified in Harmony that belong to the **boilerplate scope** (not business features). Fixes should be made in the boilerplate project first, then pulled into Harmony via git.

## Workflow: Boilerplate vs Business Feature Issues

### How to classify an issue

| Scope | What it covers | Where to fix |
|-------|---------------|--------------|
| **Boilerplate** | Auth, tenants, users, branches, permissions, audit, middleware, admin pages, base models, core infra, testing infra, CI/CD, Docker | Boilerplate project |
| **Business Features** | Master data (items, units, categories, warehouses, suppliers, discounts), ERP endpoints, ERP frontend pages, ERP schemas/services | Harmony project directly |

### Decision checklist

1. Does the issue involve files that exist in the boilerplate repo? → **Boilerplate**
2. Does the issue involve `backend/app/api/v1/endpoints/` files for auth, tenants, users, branches, audit, admin? → **Boilerplate**
3. Does the issue involve `backend/app/core/`, `backend/app/middleware/`, `backend/app/api/deps.py`? → **Boilerplate**
4. Does the issue involve `frontend/src/app/(auth)/admin/`, `frontend/middleware.ts`, `frontend/src/lib/api/client.ts`? → **Boilerplate**
5. Does the issue involve ERP-specific models, schemas, services, or pages under `/master/`? → **Business Features**
6. Does the issue involve `backend/app/core/permissions.py` or `frontend/src/hooks/use-permission.ts`?
   - If it's about boilerplate permissions (users.*, branches.*, settings.*, audit.*) → **Boilerplate**
   - If it's about business permissions (master_data.*, inventory.*) → **Business Features**

### Fix process for boilerplate issues

1. Document the issue in this file (below)
2. Copy the **"Instructions for Boilerplate Claude"** section to the boilerplate project's Claude terminal
3. After fix is committed in boilerplate, pull updates into Harmony: `git pull boilerplate main`
4. Verify the fix in Harmony context
5. Mark the issue as resolved in this file

---

## Open Issues

### ISSUE-002: Audit Log Permission Inconsistency

**Classification:** Boilerplate
**Severity:** Medium
**Status:** OPEN (can be deferred — address when tenant-level audit viewing is needed)
**Date identified:** 2026-01-30

**Problem:**
The permission matrix grants `AUDIT_VIEW` to both `super_admin` and `admin` roles, but the backend endpoint hardcodes `get_super_admin_user` dependency. This means tenant admins cannot view their own tenant's audit logs even though the permission system says they should.

**Affected files (boilerplate scope):**
- `backend/app/api/v1/endpoints/audit.py` — All endpoints use `Depends(get_super_admin_user)`
- `backend/app/core/permissions.py` — Grants `AUDIT_VIEW` to admin role

**Decision needed:** Should tenant admins see their own tenant's audit logs?
- If YES: Change endpoints to use `require_permission(Permission.AUDIT_VIEW)` and scope queries by tenant_id for non-super-admins
- If NO: Remove `AUDIT_VIEW` from admin role permissions to keep the matrix consistent

**Instructions for Boilerplate Claude (when ready to fix):**

```
ISSUE: Audit Log Permission Inconsistency

The Permission enum has AUDIT_VIEW granted to both super_admin and admin roles
in ROLE_PERMISSIONS, but the audit endpoints hardcode `get_super_admin_user`.

TASK: Make audit endpoints permission-based instead of role-hardcoded.

1. In `backend/app/api/v1/endpoints/audit.py`:
   - Replace `Depends(get_super_admin_user)` with `Depends(require_permission(Permission.AUDIT_VIEW))`
   - For non-super-admin users, automatically scope queries by their tenant_id
   - Super admins can still filter by any tenant using query params

2. Optionally add a tenant-scoped audit endpoint under the dashboard router
   (e.g., GET /api/v1/audit/logs) so tenant admins have a natural access point,
   separate from the admin-prefixed routes.

3. Update the frontend to add an audit log viewer in the tenant dashboard
   if tenant admins should see their own audit logs.

4. Keep the admin/audit-logs endpoints working as before for super admins.
```

---

### ~~ISSUE-003: Enhanced Developer Tools~~ → RESOLVED

See Resolved Issues section below.

---

### ~~ISSUE-004: Dark Mode & UI Polish for Admin Pages~~ → RESOLVED

**Classification:** Boilerplate
**Severity:** Medium
**Status:** RESOLVED
**Date identified:** 2026-02-04
**Date resolved:** 2026-02-04

**Problem:**
Multiple UI issues across the super admin pages and dev toolbar:

1. **Sidebar menu**: "Database Tools" should be renamed to "Developer Tools" (aligns with ISSUE-003 scope)
2. **Developer Tools page**: Database tools (seed, reset) should be grouped in a "Database Tools" section box, similar to how Request Logs has its content inside a section card
3. **Dark mode broken on super admin pages**: Page titles are invisible in dark mode because they use hardcoded `text-gray-900` which matches the dark background. All text colors need dark mode variants.
4. **Dashboard welcome section**: Same dark mode issue - "Welcome back" title invisible
5. **Dev toolbar blocking UI**: The fixed bottom toolbar spans full width and blocks the logout button. It should be repositioned and styled to clearly indicate DEV MODE ON/OFF status with a distinctive color (amber/bug color).

**Current state:**
- Page titles use `text-3xl font-bold tracking-tight` without `text-foreground` → invisible in dark mode
- Descriptions use `text-gray-500` without `text-muted-foreground` → poor contrast in dark mode
- Admin layout uses `bg-gray-50` without `dark:bg-gray-950` → wrong background in dark mode
- Dev toolbar is fixed at bottom spanning full width → blocks sidebar logout button
- Dev toolbar shows "DEV" but doesn't clearly indicate ON/OFF state

**Affected files (boilerplate scope):**
- `frontend/src/app/(auth)/admin/layout.tsx` — Sidebar nav item name, dark mode bg
- `frontend/src/app/(auth)/admin/page.tsx` — Title colors, welcome card dark mode
- `frontend/src/app/(auth)/admin/tools/page.tsx` — Title colors, group database tools in section
- `frontend/src/app/(auth)/admin/stats/page.tsx` — Title and text colors
- `frontend/src/app/(auth)/admin/users/page.tsx` — Title and text colors
- `frontend/src/app/(auth)/admin/tenants/page.tsx` — Title and text colors
- `frontend/src/app/(auth)/admin/tenants/new/page.tsx` — Title and text colors
- `frontend/src/app/(auth)/admin/tenants/[id]/page.tsx` — Title and text colors
- `frontend/src/app/(auth)/admin/subscriptions/page.tsx` — Title and text colors
- `frontend/src/app/(auth)/admin/settings/organization/page.tsx` — Title and text colors
- `frontend/src/app/(auth)/admin/settings/subscription/page.tsx` — Title and text colors
- `frontend/src/app/(dashboard)/dashboard/page.tsx` — Welcome section title colors
- `frontend/src/components/dev/dev-toolbar.tsx` — Reposition and restyle

**Instructions for Boilerplate Claude:**

```
ISSUE: Dark Mode & UI Polish for Admin Pages

Multiple UI fixes needed for dark mode support and developer tools page organization.

TASK: Fix dark mode colors, rename sidebar item, group database tools, restyle dev toolbar.

== PART A: Sidebar Menu Rename ==

1. In `frontend/src/app/(auth)/admin/layout.tsx`:
   - Change navigation item from `{ name: 'Database Tools', ...}` to `{ name: 'Developer Tools', ...}`
   - Add `dark:bg-gray-950` to the main container div that has `bg-gray-50`

== PART B: Dark Mode Text Colors ==

2. In ALL these admin page files, make the following replacements:
   - `frontend/src/app/(auth)/admin/page.tsx`
   - `frontend/src/app/(auth)/admin/tools/page.tsx`
   - `frontend/src/app/(auth)/admin/stats/page.tsx`
   - `frontend/src/app/(auth)/admin/users/page.tsx`
   - `frontend/src/app/(auth)/admin/tenants/page.tsx`
   - `frontend/src/app/(auth)/admin/tenants/new/page.tsx`
   - `frontend/src/app/(auth)/admin/tenants/[id]/page.tsx`
   - `frontend/src/app/(auth)/admin/subscriptions/page.tsx`
   - `frontend/src/app/(auth)/admin/settings/organization/page.tsx`
   - `frontend/src/app/(auth)/admin/settings/subscription/page.tsx`

   Replacements (use replace_all=true for each file):
   - `text-3xl font-bold tracking-tight` → `text-3xl font-bold tracking-tight text-foreground`
   - `"text-gray-500"` → `"text-muted-foreground"`
   - `"text-gray-600"` → `"text-muted-foreground"`

3. In `frontend/src/app/(auth)/admin/page.tsx` (welcome card):
   - Change `bg-linear-to-r from-purple-50 to-blue-50 border-purple-200`
     to `bg-linear-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800`
   - Add `text-foreground` to the welcome card title
   - Change `text-gray-600` to `text-muted-foreground` in the welcome card description

== PART C: Dashboard Welcome Section ==

4. In `frontend/src/app/(dashboard)/dashboard/page.tsx`:
   - Replace `text-gray-900` → `text-foreground` (all occurrences)
   - Replace `text-gray-600` → `text-muted-foreground` (all occurrences)
   - Replace `text-gray-500` → `text-muted-foreground` (all occurrences)
   - Replace `hover:bg-gray-50` → `hover:bg-accent` (all occurrences)

== PART D: Developer Tools Page - Group Database Tools ==

5. In `frontend/src/app/(auth)/admin/tools/page.tsx`:
   - Change page title from "Database Tools" to "Developer Tools"
   - Change description to "Development utilities and database management"
   - Wrap the existing content (warning banner, result alerts, and tools grid)
     inside a Card with:
     - CardHeader with title "Database Tools" and Database icon
     - CardDescription: "Manage database seeding and reset operations for development"
     - CardContent containing the warning, results, and tools grid
   - Add dark mode classes to the success alert:
     `border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-800`
     and text colors: `text-green-900 dark:text-green-100`, `text-green-800 dark:text-green-200`
   - Add dark mode classes to the error alert:
     `border-red-500 bg-red-50 dark:bg-red-950 dark:border-red-800`
     and text colors: `text-red-900 dark:text-red-100`, `text-red-800 dark:text-red-200`

== PART E: Dev Toolbar Restyle ==

6. Completely rewrite `frontend/src/components/dev/dev-toolbar.tsx`:
   - Change from fixed bottom full-width bar to fixed bottom-right floating panel
   - Add minimize state - when minimized, show only a small amber badge with bug icon + "DEV MODE"
   - When expanded, show a rounded card with:
     - Amber badge showing "DEV MODE ON" with bug icon (bg-amber-500 text-black)
     - Role indicator (color-coded: red=super_admin, yellow=admin, green=staff)
     - Expandable details section (user email, tenant name, tier)
     - Minimize button (X) to collapse to small badge
     - Expand/collapse button for details
   - Use z-[9999] but position at `bottom-4 right-4` so it doesn't block sidebar

   Here's the new component code:

   ```tsx
   'use client';

   import { useAuthStore } from '@/lib/store/authStore';
   import { useState } from 'react';
   import { Bug, X, ChevronUp, ChevronDown } from 'lucide-react';

   export function DevToolbar() {
     const { user, tenant } = useAuthStore();
     const [expanded, setExpanded] = useState(false);
     const [minimized, setMinimized] = useState(false);

     if (process.env.NODE_ENV !== 'development') {
       return null;
     }

     // Minimized state - just a small indicator in corner
     if (minimized) {
       return (
         <button
           onClick={() => setMinimized(false)}
           className="fixed bottom-4 right-4 z-[9999] bg-amber-500 text-black px-3 py-1.5 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 shadow-lg hover:bg-amber-400 transition-colors"
         >
           <Bug size={14} />
           DEV MODE
         </button>
       );
     }

     return (
       <div className="fixed bottom-4 right-4 z-[9999] bg-zinc-900 text-zinc-100 text-xs font-mono rounded-lg shadow-xl border border-zinc-700 max-w-sm">
         {expanded && (
           <div className="px-4 py-3 border-b border-zinc-700 space-y-2">
             <div>
               <span className="text-zinc-400">User:</span>{' '}
               {user?.email || 'Not logged in'}
             </div>
             <div>
               <span className="text-zinc-400">Role:</span>{' '}
               <span className={
                 user?.role === 'super_admin'
                   ? 'text-red-400'
                   : user?.role === 'admin'
                   ? 'text-yellow-400'
                   : 'text-green-400'
               }>
                 {user?.role || 'N/A'}
               </span>
             </div>
             <div>
               <span className="text-zinc-400">Tenant:</span>{' '}
               {tenant?.name || 'None'}{' '}
               {tenant?.subdomain && (
                 <span className="text-zinc-500">({tenant.subdomain})</span>
               )}
             </div>
             <div>
               <span className="text-zinc-400">Tier:</span>{' '}
               {tenant?.tier || 'N/A'}
             </div>
           </div>
         )}
         <div className="flex items-center justify-between px-3 py-2">
           <div className="flex items-center gap-2">
             <div className="flex items-center gap-1.5 bg-amber-500 text-black px-2 py-0.5 rounded font-bold">
               <Bug size={12} />
               <span>DEV MODE ON</span>
             </div>
             <span className="text-zinc-400">|</span>
             <span className={
               user?.role === 'super_admin'
                 ? 'text-red-400'
                 : user?.role === 'admin'
                 ? 'text-yellow-400'
                 : 'text-green-400'
             }>
               {user?.role || 'guest'}
             </span>
           </div>
           <div className="flex items-center gap-1">
             <button
               onClick={() => setExpanded(!expanded)}
               className="p-1 hover:bg-zinc-700 rounded"
               title={expanded ? 'Collapse' : 'Expand'}
             >
               {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
             </button>
             <button
               onClick={() => setMinimized(true)}
               className="p-1 hover:bg-zinc-700 rounded"
               title="Minimize"
             >
               <X size={14} />
             </button>
           </div>
         </div>
       </div>
     );
   }
   ```

== IMPORTANT NOTES ==
- Use semantic color classes (`text-foreground`, `text-muted-foreground`, `bg-accent`)
  instead of hardcoded gray colors for dark mode support
- The `text-foreground` and `text-muted-foreground` classes are defined in globals.css
  and automatically switch between light/dark mode
- Don't change colors that are intentionally specific (like red for destructive,
  green for success, blue for info badges)
- The dev toolbar should ONLY render in development mode (NODE_ENV !== 'development')
```

---

## Resolved Issues

### ISSUE-001: Super Admin Cannot Access Audit Logs Page ✓
**Resolved:** 2026-02-04

**Problem:**
The admin sidebar linked to `/admin/logs` but the page file was being ignored by `.gitignore` due to a broad `logs/` pattern that matched any directory named "logs".

**Root cause:**
The `.gitignore` had `logs/` on line 30 which matched `frontend/src/app/(auth)/admin/logs/` directory, causing the page to never be committed to git.

**Fix:**
1. Changed `.gitignore` pattern from `logs/` to `/logs/` (root-only)
2. Added negation pattern `!frontend/src/app/**/logs/` to explicitly include admin logs pages
3. Committed the previously-ignored `frontend/src/app/(auth)/admin/logs/page.tsx` file

**Files modified:**
- `.gitignore` — Fixed overly broad logs/ pattern
- `frontend/src/app/(auth)/admin/logs/page.tsx` — Now tracked (was created but ignored)

---

### ISSUE-003: Enhanced Developer Tools ✓
**Resolved:** 2026-02-04

**Summary of implementation:**
- `/admin/tools` page now has 4 sections: System Info, Runtime Settings, Request Logs, Database Tools
- Backend endpoints: GET/POST `/admin/tools/settings`, GET `/admin/tools/system-info`, GET `/admin/tools/logs`
- `/admin/logs` page has Clear (dev mode only) and Archive buttons with confirmation dialogs
- Backend endpoints: DELETE `/admin/audit-logs/`, POST `/admin/audit-logs/archive`
- Runtime settings are in-memory (reset on server restart)
- Dev toolbar restyled as floating bottom-right panel with minimize/expand

**Files modified:**
- `backend/app/api/v1/endpoints/admin_tools.py` — Added settings, system-info, logs endpoints
- `backend/app/api/v1/endpoints/audit.py` — Added clear and archive endpoints
- `frontend/src/app/(auth)/admin/tools/page.tsx` — Full rebuild with 4 sections
- `frontend/src/app/(auth)/admin/logs/page.tsx` — Added clear/archive UI
- `frontend/src/lib/api/admin-tools.ts` — New API client
- `frontend/src/lib/store/devModeStore.ts` — Zustand store for dev mode state
- `frontend/src/components/dev/dev-toolbar.tsx` — Restyled floating panel

---

### ISSUE-005: React Hooks Order Violation in Developer Tools Page ✓
**Resolved:** 2026-02-04

**Problem:**
The `/admin/tools` page crashed with "Rendered fewer hooks than expected" error when toggling dev_mode off in the sidebar. This violated React's rules of hooks - hooks were being called conditionally because an early return (`if (!devMode) return null`) appeared before several `useQuery`, `useMutation`, `useState`, and `useCallback` hooks.

**Root cause:**
```tsx
// WRONG - hooks called after conditional return
useEffect(() => { if (!devMode) router.replace('/admin'); }, [devMode]);
if (!devMode) return null;  // Early return here
const { data } = useQuery({...});  // These hooks never called when devMode=false
const mutation = useMutation({...});
```

**Fix:**
Moved all hooks to the top of the component before any conditional returns:
1. Moved all `useState` and `useRef` hooks to the top
2. Moved all `useQuery`, `useMutation`, and `useCallback` hooks above the conditional return
3. Added `enabled: devMode` to `useQuery` hooks to prevent unnecessary API calls when devMode is off
4. Kept the `useEffect` for redirect right before the conditional return

**Files modified:**
- `frontend/src/app/(auth)/admin/tools/page.tsx`

---

### ISSUE-004: Dark Mode & UI Polish for Admin Pages ✓
**Resolved:** 2026-02-04

**Summary of fixes:**
- Renamed sidebar menu item from "Database Tools" to "Developer Tools"
- Added `dark:bg-gray-950` to admin layout for dark mode background
- Fixed dark mode text colors across 12 admin/dashboard pages using `text-foreground` and `text-muted-foreground`
- Added dark mode support to welcome cards with gradient backgrounds
- Wrapped database tools in a Card section with proper header
- Added dark mode classes to success/error alerts
- Restyled dev toolbar: changed from full-width bottom bar to floating bottom-right panel with minimize/expand states and amber DEV MODE badge

**Files modified:**
- `frontend/src/app/(auth)/admin/layout.tsx`
- `frontend/src/app/(auth)/admin/page.tsx`
- `frontend/src/app/(auth)/admin/tools/page.tsx`
- `frontend/src/app/(auth)/admin/stats/page.tsx`
- `frontend/src/app/(auth)/admin/users/page.tsx`
- `frontend/src/app/(auth)/admin/tenants/page.tsx`
- `frontend/src/app/(auth)/admin/tenants/new/page.tsx`
- `frontend/src/app/(auth)/admin/tenants/[id]/page.tsx`
- `frontend/src/app/(auth)/admin/subscriptions/page.tsx`
- `frontend/src/app/(auth)/admin/settings/organization/page.tsx`
- `frontend/src/app/(auth)/admin/settings/subscription/page.tsx`
- `frontend/src/app/(dashboard)/dashboard/page.tsx`
- `frontend/src/components/dev/dev-toolbar.tsx`

---

## Notes

- When pulling boilerplate updates, check for conflicts in files modified by both projects:
  - `backend/app/core/permissions.py` (business permissions added here)
  - `backend/app/models/__init__.py` (business model imports added)
  - `backend/app/api/v1/__init__.py` (business routers added)
  - `frontend/src/hooks/use-permission.ts` (business permissions added)
  - `frontend/src/app/(dashboard)/layout.tsx` (master data nav added)
  - `backend/alembic/env.py` (business model imports added)
- These are the only files that overlap between boilerplate and business features
