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

### ~~ISSUE-007: Format Settings / Regional Preferences~~ → RESOLVED

**Classification:** Boilerplate (with extension points for business features)
**Severity:** Low (enhancement)
**Status:** RESOLVED
**Type:** New Feature
**Date identified:** 2026-02-06
**Date resolved:** 2026-02-07

**Problem:**
The application lacks tenant-level format settings for currency, number formatting, and date display. Currently, any formatting is hardcoded, making it difficult for tenants in different regions to customize their display preferences.

**Proposed Settings:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `currency_code` | string | "IDR" | ISO currency code for display |
| `currency_symbol_position` | "before" \| "after" | "before" | Rp 1.000 vs 1.000 Rp |
| `decimal_separator` | string | "," | Decimal separator (e.g., "," or ".") |
| `thousands_separator` | string | "." | Thousands separator (e.g., "." or ",") |
| `price_decimal_places` | 0-4 | 0 | Decimal places for prices |
| `quantity_decimal_places` | 0-4 | 0 | Decimal places for stock/qty |
| `date_format` | string | "DD/MM/YYYY" | Date display format |
| `timezone` | string | "Asia/Jakarta" | Tenant timezone |

**Storage:**
Use existing `tenant.settings` JSON field — no schema change needed.

**Affected files (boilerplate scope):**
- `backend/app/schemas/tenant.py` — Add FormatSettings schema with validation
- `backend/app/services/tenant_service.py` — Add get/update format settings methods
- `backend/app/api/v1/endpoints/tenant_settings.py` — Add format settings endpoints (or extend existing)
- `frontend/src/app/(dashboard)/settings/page.tsx` — Add Format Settings card
- `frontend/src/hooks/use-format-settings.ts` — New hook for accessing settings
- `frontend/src/lib/utils/format.ts` — New file with formatCurrency, formatNumber, formatDate helpers

**Instructions for Boilerplate Claude:**

```
ISSUE: Format Settings / Regional Preferences

The application needs tenant-level format settings for currency, numbers, and dates.
These settings should be stored in the existing tenant.settings JSON field.

TASK: Implement format settings feature.

== PART A: Backend ==

1. In `backend/app/schemas/tenant.py`, add a FormatSettings schema:
   ```python
   class FormatSettings(BaseModel):
       currency_code: str = "IDR"
       currency_symbol_position: Literal["before", "after"] = "before"
       decimal_separator: str = ","
       thousands_separator: str = "."
       price_decimal_places: int = Field(default=0, ge=0, le=4)
       quantity_decimal_places: int = Field(default=0, ge=0, le=4)
       date_format: str = "DD/MM/YYYY"
       timezone: str = "Asia/Jakarta"
   ```

2. In `backend/app/services/tenant_service.py`, add methods:
   - `get_format_settings(db, tenant_id) -> FormatSettings` — Returns settings from tenant.settings["format"] or defaults
   - `update_format_settings(db, tenant_id, settings: FormatSettings)` — Merges into tenant.settings["format"]

3. In `backend/app/api/v1/endpoints/tenant_settings.py` (or create if not exists):
   - `GET /api/v1/tenant/settings/format` — Returns current format settings
   - `PUT /api/v1/tenant/settings/format` — Updates format settings
   - Both require `settings.update` permission

== PART B: Frontend ==

4. Create `frontend/src/lib/utils/format.ts`:
   ```typescript
   export interface FormatSettings {
     currency_code: string;
     currency_symbol_position: 'before' | 'after';
     decimal_separator: string;
     thousands_separator: string;
     price_decimal_places: number;
     quantity_decimal_places: number;
     date_format: string;
     timezone: string;
   }

   export const DEFAULT_FORMAT_SETTINGS: FormatSettings = {
     currency_code: 'IDR',
     currency_symbol_position: 'before',
     decimal_separator: ',',
     thousands_separator: '.',
     price_decimal_places: 0,
     quantity_decimal_places: 0,
     date_format: 'DD/MM/YYYY',
     timezone: 'Asia/Jakarta',
   };

   export function formatCurrency(amount: number, settings: FormatSettings): string {
     // Format with thousands separator and decimal places
     // Add currency symbol in correct position
   }

   export function formatNumber(value: number, decimals: number, settings: FormatSettings): string {
     // Format with separators
   }

   export function formatDate(date: Date | string, settings: FormatSettings): string {
     // Format according to date_format setting
   }
   ```

5. Create `frontend/src/hooks/use-format-settings.ts`:
   - React Query hook to fetch and cache format settings
   - Returns { settings, formatCurrency, formatNumber, formatDate } functions pre-bound to settings
   - Falls back to DEFAULT_FORMAT_SETTINGS while loading

6. In `frontend/src/app/(dashboard)/settings/page.tsx`:
   - Add a "Format Settings" Card section
   - Fields for each setting with appropriate inputs:
     - Currency code: text input or select with common currencies
     - Symbol position: radio buttons (before/after)
     - Separators: text inputs with validation
     - Decimal places: number inputs (0-4)
     - Date format: select with common formats
     - Timezone: searchable select with timezone list
   - Save button to update settings

== NOTES ==

- Timezone list can use Intl.supportedValuesOf('timeZone') in modern browsers
- Date format should support common patterns: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.
- Currency symbol lookup can use a simple map or Intl.NumberFormat
- The settings UI should show a preview of how amounts/dates will appear
- Consider using react-hook-form for the settings form
```

**Resolution:**
- Added `FormatSettings` schema to `backend/app/schemas/tenant.py`
- Added `get_format_settings()` and `update_format_settings()` to `backend/app/services/tenant_service.py`
- Added `GET/PUT /tenant-settings/format` endpoints to `backend/app/api/v1/endpoints/tenant_settings.py`
- Created `frontend/src/lib/utils/format.ts` with formatting utilities and currency/timezone options
- Created `frontend/src/hooks/use-format-settings.ts` React Query hook
- Updated `frontend/src/app/(dashboard)/settings/page.tsx` with new Format Settings tab containing:
  - Live preview card showing how values will appear
  - Currency settings (code, symbol position, decimal places)
  - Number format (decimal/thousands separators, quantity decimals)
  - Date & time (format, timezone)

---

### ISSUE-009: Data Masking Utility for Sensitive PII

**Classification:** Boilerplate (utility + permission)
**Severity:** Low (security enhancement)
**Status:** OPEN
**Type:** New Feature
**Date identified:** 2026-02-06

**Problem:**
The application does not mask sensitive PII (phone numbers, emails) in list views. All users with access to a page can see full unmasked data. For compliance and privacy, sensitive fields should be masked by default and only shown unmasked to users with specific permissions.

**What's needed:**

1. **Frontend masking utility** (`frontend/src/lib/utils/mask.ts`):
   - `maskPhone(phone, hasPermission)` → `****1234`
   - `maskEmail(email, hasPermission)` → `j***@example.com`
   - `maskNIK(nik, hasPermission)` → `********1234` (for Indonesian ID numbers)

2. **New permission** in `backend/app/core/permissions.py`:
   - `SENSITIVE_DATA_VIEW = "sensitive_data.view"`
   - Granted to: `super_admin`, `admin` (not `staff` by default)

3. **Frontend permission hook update** in `frontend/src/hooks/use-permission.ts`:
   - Add `SENSITIVE_DATA_VIEW` to permission types
   - Mirror the backend ROLE_PERMISSIONS mapping

**NOT in boilerplate scope:** Applying the masking to specific views (customer list, supplier contacts) is business feature scope—handled in Harmony directly.

**Instructions for Boilerplate Claude:**

```
ISSUE: Data Masking Utility for Sensitive PII

The application needs utilities to mask sensitive data (phone, email) with permission-based reveal.

TASK: Implement masking utility and permission.

== PART A: Backend Permission ==

1. In `backend/app/core/permissions.py`:
   - Add to Permission enum: `SENSITIVE_DATA_VIEW = "sensitive_data.view"`
   - Add to ROLE_PERMISSIONS:
     - super_admin: include SENSITIVE_DATA_VIEW
     - admin: include SENSITIVE_DATA_VIEW
     - staff: do NOT include (they see masked data)

== PART B: Frontend Utility ==

2. Create `frontend/src/lib/utils/mask.ts`:

   ```typescript
   /**
    * Masks a phone number, showing only last 4 digits
    * @example maskPhone('081234567890', false) → '********7890'
    */
   export function maskPhone(phone: string | null | undefined, canViewSensitive: boolean): string {
     if (!phone) return '-';
     if (canViewSensitive) return phone;
     if (phone.length <= 4) return '****';
     return '*'.repeat(phone.length - 4) + phone.slice(-4);
   }

   /**
    * Masks an email address, showing first char and domain
    * @example maskEmail('john@example.com', false) → 'j***@example.com'
    */
   export function maskEmail(email: string | null | undefined, canViewSensitive: boolean): string {
     if (!email) return '-';
     if (canViewSensitive) return email;
     const [local, domain] = email.split('@');
     if (!domain) return '***';
     return `${local[0] || '*'}***@${domain}`;
   }

   /**
    * Masks an ID number (NIK, SSN, etc.), showing only last 4 digits
    * @example maskIdNumber('1234567890123456', false) → '************3456'
    */
   export function maskIdNumber(id: string | null | undefined, canViewSensitive: boolean): string {
     if (!id) return '-';
     if (canViewSensitive) return id;
     if (id.length <= 4) return '****';
     return '*'.repeat(id.length - 4) + id.slice(-4);
   }
   ```

3. In `frontend/src/hooks/use-permission.ts`:
   - Add 'sensitive_data.view' to the Permission type
   - Add it to ROLE_PERMISSIONS for super_admin and admin

== USAGE EXAMPLE (for reference, not part of this task) ==

In a customer list component:
```tsx
const canViewSensitive = usePermission('sensitive_data.view');

<TableCell>{maskPhone(customer.phone, canViewSensitive)}</TableCell>
<TableCell>{maskEmail(customer.email, canViewSensitive)}</TableCell>
```
```

---

### ISSUE-008: HttpOnly Cookies for JWT Tokens

**Classification:** Boilerplate
**Severity:** Low (security enhancement)
**Status:** OPEN
**Type:** Security Improvement
**Date identified:** 2026-02-06

**Problem:**
JWT tokens are currently stored in localStorage, which is vulnerable to XSS attacks. A more secure approach is to store tokens in HttpOnly cookies, which JavaScript cannot access.

**Current implementation:**
- Frontend stores `access_token` and `refresh_token` in localStorage
- Frontend sends `Authorization: Bearer <token>` header on each request
- Works, but if XSS occurs, attacker can steal tokens

**Proposed implementation:**
- Backend sets HttpOnly, Secure, SameSite cookies on login/refresh
- Frontend no longer stores tokens in localStorage (cookies sent automatically)
- Backend reads token from cookie instead of Authorization header
- Requires CSRF protection since cookies are sent automatically

**Trade-offs:**
| Aspect | localStorage (current) | HttpOnly cookies |
|--------|----------------------|------------------|
| XSS vulnerability | Tokens can be stolen | Tokens protected |
| CSRF vulnerability | Not applicable | Needs CSRF token |
| Implementation | Simple | More complex |
| Cross-domain | Works with CORS | Needs same-site or complex setup |
| Mobile apps | Works | Requires hybrid approach |

**Decision:** This is a significant architectural change. Recommended to defer until:
1. The application is preparing for production with real user data
2. There's a clear requirement for enhanced security (compliance, enterprise customers)
3. The team can invest time in implementing CSRF protection properly

**Affected files (boilerplate scope):**
- `backend/app/api/v1/endpoints/auth.py` — Set cookies on login/refresh
- `backend/app/api/deps.py` — Read token from cookie or header
- `backend/app/core/security.py` — Cookie configuration
- `frontend/src/lib/api/client.ts` — Remove localStorage token handling
- `frontend/src/lib/store/authStore.ts` — Remove token storage
- `frontend/middleware.ts` — May need to read auth state differently

**Instructions for Boilerplate Claude:**

```
ISSUE: HttpOnly Cookies for JWT Tokens

This is a DEFERRED issue. Do not implement unless explicitly requested.

The implementation requires:
1. Backend cookie-setting on login/refresh responses
2. CSRF protection (double-submit cookie or synchronizer token pattern)
3. Frontend refactoring to remove localStorage token handling
4. Careful testing of cross-origin scenarios

When implementing, reference:
- FastAPI cookie setting: response.set_cookie()
- CSRF: fastapi-csrf-protect or custom implementation
- Cookie flags: HttpOnly=True, Secure=True (production), SameSite='Lax'
```

---

### ~~ISSUE-006: Next.js 16 Turbopack SSR Prerender Error with Button onClick~~ → RESOLVED

**Classification:** Boilerplate
**Severity:** Critical (build-breaking)
**Status:** RESOLVED
**Date identified:** 2026-02-06
**Date resolved:** 2026-02-07

**Problem:**
Next.js 16 with Turbopack (default bundler) fails to build with error:
```
Error: Event handlers cannot be passed to Client Component props.
  {onClick: function onClick, variant: ..., className: ..., children: ...}
            ^^^^^^^^^^^^^^^^
If you need interactivity, consider converting part of this to a Client Component.
```

This happens during static page generation (prerendering) even for pages marked with `'use client'`. The issue is that Next.js 16 still attempts to prerender client components during build, and event handlers cannot be serialized.

**Root cause:**
- Pages/layouts with `'use client'` that contain Button components with `onClick` handlers
- `export const dynamic = 'force-dynamic'` only works in **server components**, not client components
- Next.js 16 Turbopack prerenders all pages by default during build

**Affected files (boilerplate scope):**
- `frontend/src/app/(auth)/admin/layout.tsx` - Admin layout with Button onClick
- `frontend/src/app/(auth)/admin/logs/page.tsx` - Audit logs page with Button onClick
- `frontend/src/app/(dashboard)/layout.tsx` - Dashboard layout with Button onClick
- `frontend/src/app/not-found.tsx` - 404 page with Button onClick (window.history.back)

**Solution pattern:**
Split each affected file into two parts:
1. **Server component** (page.tsx or layout.tsx) - exports `dynamic = 'force-dynamic'` and imports client component
2. **Client component** (*Client.tsx) - has `'use client'` and contains all UI with event handlers

**Instructions for Boilerplate Claude:**

```
ISSUE: Next.js 16 Turbopack SSR Prerender Error

Next.js 16 with Turbopack fails to build pages that have Button onClick handlers,
even with 'use client' directive. The error is:
"Event handlers cannot be passed to Client Component props"

This happens because Next.js 16 prerenders pages during build, and onClick handlers
cannot be serialized. The fix is to use a server component wrapper with
`export const dynamic = 'force-dynamic'` which skips prerendering.

IMPORTANT: `export const dynamic = 'force-dynamic'` only works in SERVER components,
not client components. So we need to split each page/layout into two files.

TASK: Apply the server component wrapper pattern to these files.

== FILE 1: Admin Layout ==

1. Create `frontend/src/app/(auth)/admin/AdminLayoutClient.tsx`:
   - Move ALL content from current layout.tsx here
   - Keep the `'use client'` directive at top
   - Export as default function `AdminLayoutClient`

2. Replace `frontend/src/app/(auth)/admin/layout.tsx` with:
   ```tsx
   // Force dynamic rendering to skip static generation for all admin pages
   export const dynamic = 'force-dynamic';

   import AdminLayoutClient from './AdminLayoutClient';

   export default function AdminLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return <AdminLayoutClient>{children}</AdminLayoutClient>;
   }
   ```

== FILE 2: Admin Logs Page ==

3. Create `frontend/src/app/(auth)/admin/logs/AuditLogsClient.tsx`:
   - Move ALL content from current page.tsx here
   - Keep the `'use client'` directive at top
   - Export as default function `AuditLogsClient`

4. Replace `frontend/src/app/(auth)/admin/logs/page.tsx` with:
   ```tsx
   // Force dynamic rendering to skip static generation
   export const dynamic = 'force-dynamic';

   import AuditLogsClient from './AuditLogsClient';

   export default function AuditLogsPage() {
     return <AuditLogsClient />;
   }
   ```

== FILE 3: Dashboard Layout ==

5. Create `frontend/src/app/(dashboard)/DashboardLayoutClient.tsx`:
   - Move ALL content from current layout.tsx here
   - Keep the `'use client'` directive at top
   - Export as default function `DashboardLayoutClient`

6. Replace `frontend/src/app/(dashboard)/layout.tsx` with:
   ```tsx
   // Force dynamic rendering to skip static generation for all dashboard pages
   export const dynamic = 'force-dynamic';

   import DashboardLayoutClient from './DashboardLayoutClient';

   export default function DashboardLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
   }
   ```

== FILE 4: Not Found Page ==

7. Create `frontend/src/app/NotFoundClient.tsx`:
   - Move ALL content from current not-found.tsx here
   - Add `'use client'` directive at top
   - Export as default function `NotFoundClient`

8. Replace `frontend/src/app/not-found.tsx` with:
   ```tsx
   // Force dynamic rendering to skip static generation
   export const dynamic = 'force-dynamic';

   import NotFoundClient from './NotFoundClient';

   export default function NotFound() {
     return <NotFoundClient />;
   }
   ```

== VERIFICATION ==

After applying all changes, run `npm run build` in the frontend directory.
The build should complete successfully with routes showing:
- ○ (Static) for public pages like /login, /register
- ƒ (Dynamic) for admin and dashboard pages

== WHY THIS WORKS ==

1. Server component with `export const dynamic = 'force-dynamic'` tells Next.js
   to skip prerendering and render on-demand
2. The server component imports the client component which has all the UI
3. Since the server component is never prerendered, the client component's
   onClick handlers are never serialized during build
4. At runtime, the client component hydrates normally with full interactivity
```

**Resolution:**
- Created `frontend/src/app/(auth)/admin/AdminLayoutClient.tsx` - client component with all admin layout UI
- Updated `frontend/src/app/(auth)/admin/layout.tsx` - server wrapper with `export const dynamic = 'force-dynamic'`
- Created `frontend/src/app/(auth)/admin/logs/AuditLogsClient.tsx` - client component for audit logs page
- Updated `frontend/src/app/(auth)/admin/logs/page.tsx` - server wrapper
- Created `frontend/src/app/(dashboard)/DashboardLayoutClient.tsx` - client component for dashboard layout
- Updated `frontend/src/app/(dashboard)/layout.tsx` - server wrapper
- Created `frontend/src/app/NotFoundClient.tsx` - client component for 404 page
- Updated `frontend/src/app/not-found.tsx` - server wrapper

**Harmony local fix applied:**
The fix has been applied locally in Harmony. When pulling boilerplate updates after this issue is fixed there, expect conflicts in:
- `frontend/src/app/(dashboard)/layout.tsx` - Harmony has added master data navigation items

**Conflict resolution strategy:**
1. Accept the new server component wrapper pattern from boilerplate
2. Re-add Harmony's master data navigation items to `DashboardLayoutClient.tsx`
3. The navigation items to preserve are in the `masterDataNav` array

---

---

## Resolved Issues

### ~~ISSUE-001: Super Admin Cannot Access Audit Logs Page~~ → RESOLVED

**Classification:** Boilerplate
**Severity:** High
**Status:** RESOLVED
**Date identified:** 2026-01-30
**Date resolved:** 2026-02-04

**Problem:**
1. The admin sidebar has a navigation link to `/admin/logs` but no page exists at that route
2. The backend audit endpoints (`/api/v1/admin/audit-logs/`) use `get_super_admin_user` dependency, which works for super admins at the API level, but there is no frontend page to display the data
3. Additionally, tenant admins have `AUDIT_VIEW` permission in the permission matrix but cannot access audit logs because the endpoint hardcodes `get_super_admin_user` instead of using `require_permission(Permission.AUDIT_VIEW)`

**Affected files (boilerplate scope):**
- `frontend/src/app/(auth)/admin/logs/page.tsx` — MISSING, needs to be created
- `backend/app/api/v1/endpoints/audit.py` — Uses `get_super_admin_user` instead of permission-based access

**Expected behavior:**
- Super admin should see a working audit logs page at `/admin/logs` with filtering by tenant, user, action, date range
- The page should call the existing `/api/v1/admin/audit-logs/` backend endpoints

**Instructions for Boilerplate Claude:**

```
ISSUE: Super Admin Audit Logs Page Missing

The admin sidebar links to `/admin/logs` but no page exists. The backend API endpoints
are already built at `/api/v1/admin/audit-logs/` with 5 endpoints (list, detail, statistics,
actions, resources), all requiring super_admin access.

TASK: Create the audit logs frontend page for super admin.

1. Create `frontend/src/app/(auth)/admin/logs/page.tsx`:
   - Data table showing audit log entries
   - Columns: timestamp, user email, tenant name, action, resource, status, IP address
   - Filters: tenant dropdown, action type dropdown, date range picker, search by user
   - Pagination (server-side, using skip/limit params)
   - Click row to see detail (modal or expand)
   - Statistics summary at top (total logs, actions breakdown) using /statistics endpoint
   - Use the existing API endpoints:
     - GET /api/v1/admin/audit-logs/ (list with filters)
     - GET /api/v1/admin/audit-logs/{id} (detail)
     - GET /api/v1/admin/audit-logs/statistics (stats)
     - GET /api/v1/admin/audit-logs/actions (action types for filter dropdown)
     - GET /api/v1/admin/audit-logs/resources (resource types for filter dropdown)

2. Create `frontend/src/lib/api/audit.ts`:
   - API client functions for all 5 audit endpoints
   - TypeScript types for audit log entries and responses

3. The admin sidebar already has the link at `/admin/logs` in the layout file,
   so no navigation changes needed.

4. Follow existing patterns from other admin pages (e.g., admin/tenants, admin/users)
   for layout, styling, and component patterns.

5. Use shadcn/ui components (Table, Card, Select, DatePicker if available, Badge for status).
```

**Resolution:**
- Created `/admin/logs` page for super admin with full filtering and pagination
- Created tenant dashboard `/audit-logs` page for tenant admins
- Created `frontend/src/lib/api/audit.ts` with all API functions
- Backend endpoints now use `require_permission(Permission.AUDIT_VIEW)` with tenant scoping

---

### ~~ISSUE-002: Audit Log Permission Inconsistency~~ → RESOLVED

**Classification:** Boilerplate
**Severity:** Medium
**Status:** RESOLVED
**Date identified:** 2026-01-30
**Date resolved:** 2026-02-04

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

**Resolution:**
- Changed all audit endpoints from `get_super_admin_user` to `require_permission(Permission.AUDIT_VIEW)`
- Added `_apply_tenant_scope()` helper to scope queries by tenant for non-super-admins
- Created tenant dashboard audit logs page at `/audit-logs`
- Super admins can filter by any tenant; tenant admins see only their tenant's logs

---

### ~~ISSUE-003: Enhanced Developer Tools~~ → RESOLVED

**Classification:** Boilerplate
**Severity:** Medium
**Status:** RESOLVED
**Date identified:** 2026-01-30
**Date resolved:** 2026-02-04

**Problem:**
Developer tooling is minimal. The `/admin/tools` page only has seed and reset buttons. There is no runtime toggle for DEV_MODE, no log level control, no system info panel, and no way to clear audit logs for fresh testing. The dev toolbar (bottom bar) only shows auth state info.

**Current state:**
- `/admin/tools` — Seed data + reset database (2 buttons)
- `/admin/logs` — Page missing (ISSUE-001), but once built it needs a clear/archive action
- `DEV_MODE` — Env var only, requires server restart to change
- Log level — Hardcoded to INFO in `main.py`, no runtime control
- Dev toolbar — Shows user/role/tenant, no controls

**Page arrangement:**

`/admin/logs` (Audit Logs) — operational admin feature:
- Audit log viewer (from ISSUE-001)
- "Clear Audit Logs" button (dev mode only, hidden in production)
- "Archive Audit Logs" button (available in production — moves old logs to archive table or exports)

`/admin/tools` (Developer Tools) — dev infrastructure page:
- **Database Tools** section (existing: seed, reset)
- **Runtime Settings** section (new):
  - DEV_MODE on/off toggle (affects rate limiting + dev features visibility)
  - Log Level selector (DEBUG / INFO / WARNING / ERROR)
  - Rate Limiting on/off toggle (independent of DEV_MODE)
- **System Info** section (new):
  - Health status (DB connected, Redis connected) — from existing `/health/detailed`
  - Current Alembic migration version
  - Python version, FastAPI version
  - Active env config display (secrets masked)
- **Request Logs** section (new):
  - Live tail of recent entries from `logs/app.log`
  - Filter by log level (ERROR / WARNING / INFO / DEBUG)
  - Auto-refresh toggle

**Affected files (boilerplate scope):**
- `backend/app/api/v1/endpoints/admin_tools.py` — Add new endpoints
- `backend/app/api/v1/endpoints/audit.py` — Add clear/archive endpoints
- `frontend/src/app/(auth)/admin/tools/page.tsx` — Expand with new sections
- `frontend/src/app/(auth)/admin/logs/page.tsx` — Add clear/archive buttons (after ISSUE-001)
- `backend/app/config.py` — Support runtime settings override
- `backend/app/main.py` — Dynamic log level

**Dependencies:** ISSUE-001 should be completed first (audit logs page must exist before adding clear button to it).

**Instructions for Boilerplate Claude:**

```
ISSUE: Enhanced Developer Tools

The /admin/tools page only has seed and reset buttons. We need better developer tooling
for runtime control, system visibility, and log management.

TASK: Enhance developer tools in two pages.

== PART A: Backend Endpoints ==

1. Add to `backend/app/api/v1/endpoints/admin_tools.py` (all require super_admin):

   a. POST /admin/tools/settings — Update runtime settings
      - Accepts JSON: { "dev_mode": bool, "log_level": str, "rate_limit_enabled": bool }
      - Stores in an in-memory runtime config that overrides env vars for the running process
      - Updates loguru log level dynamically: logger.remove() + logger.add() with new level
      - Updates settings.DEV_MODE and settings.RATE_LIMIT_ENABLED in memory
      - Returns current settings state
      - Audit log the change

   b. GET /admin/tools/settings — Get current runtime settings
      - Returns: { dev_mode, log_level, rate_limit_enabled }

   c. GET /admin/tools/system-info — Get system information
      - Python version, FastAPI version
      - Database connection status (reuse health check logic)
      - Redis connection status
      - Current Alembic migration version (run `alembic current` or query alembic_version table)
      - Server uptime
      - Environment variables (mask SECRET_KEY, DATABASE_URL password, MAIL_PASSWORD, etc.)

   d. GET /admin/tools/logs — Get recent application logs
      - Query params: level (filter), limit (default 100), offset
      - Reads from logs/app.log file, parses lines
      - Returns array of { timestamp, level, message }

2. Add to `backend/app/api/v1/endpoints/audit.py`:

   a. DELETE /admin/audit-logs/ — Clear audit logs (dev mode only)
      - Check settings.DEV_MODE is True, return 403 if not
      - Delete all audit log records from database
      - Audit log the clear action itself (meta — "audit logs cleared")
      - Return count of deleted records

   b. POST /admin/audit-logs/archive — Archive old audit logs
      - Query param: before_date (default: 90 days ago)
      - For now, just delete records older than the date (full archive table is future work)
      - Return count of archived/deleted records
      - Works in both dev and production mode

== PART B: Frontend — Expand /admin/tools page ==

3. Expand `frontend/src/app/(auth)/admin/tools/page.tsx` with three new sections
   below the existing Database Tools section:

   a. "Runtime Settings" card:
      - DEV_MODE toggle switch (calls POST /admin/tools/settings)
      - Log Level dropdown: DEBUG, INFO, WARNING, ERROR
      - Rate Limiting toggle switch
      - Each change calls the settings endpoint immediately
      - Show current values on load (GET /admin/tools/settings)

   b. "System Info" card:
      - Display all fields from GET /admin/tools/system-info
      - Color-coded status badges for DB and Redis (green=connected, red=disconnected)
      - Show migration version
      - Refresh button to re-fetch
      - Env vars in a collapsible section (values masked by default, click to reveal)

   c. "Request Logs" card:
      - Table showing recent log entries from GET /admin/tools/logs
      - Columns: timestamp, level (color-coded badge), message
      - Level filter dropdown (show all, or filter by ERROR/WARNING/INFO/DEBUG)
      - Limit selector (50, 100, 200)
      - Auto-refresh checkbox (polls every 5 seconds when enabled)
      - Scroll to bottom / scroll to top buttons

   Follow existing patterns from the current seed/reset cards for styling.

== PART C: Frontend — Add buttons to /admin/logs page ==

4. After ISSUE-001 is done (audit logs page exists), add:
   - "Clear All Logs" button (only visible when DEV_MODE is true)
     - Confirmation dialog before clearing
     - Calls DELETE /admin/audit-logs/
     - Refreshes the log list after clearing
   - "Archive Old Logs" button (always visible)
     - Date picker for cutoff date (default: 90 days ago)
     - Calls POST /admin/audit-logs/archive
     - Shows count of archived records
     - Refreshes the log list

== IMPORTANT NOTES ==
- Runtime settings are in-memory only. Server restart resets to env var values.
  This is intentional — env vars are the source of truth, runtime is for quick toggling.
- The clear audit logs endpoint MUST check DEV_MODE. Never allow clearing in production.
- Mask sensitive env vars: any key containing SECRET, PASSWORD, KEY, TOKEN, or DATABASE_URL.
- The log file reader should handle the case where logs/app.log doesn't exist yet.
- All new endpoints need audit logging.
```

**Resolution:**
- Added backend endpoints: `GET/POST /admin/tools/settings`, `GET /admin/tools/system-info`, `GET /admin/tools/logs`
- Added `DELETE /admin/audit-logs/` (dev mode only) and `POST /admin/audit-logs/archive`
- Expanded `/admin/tools` page with Runtime Settings, System Info, and Request Logs sections
- Added clear/archive buttons to audit logs page
- Created `frontend/src/lib/api/admin-tools.ts` and `frontend/src/lib/store/devModeStore.ts`

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
  - `frontend/src/app/(dashboard)/layout.tsx` (master data nav added) → **After ISSUE-006, this becomes `DashboardLayoutClient.tsx`**
  - `backend/alembic/env.py` (business model imports added)
- These are the only files that overlap between boilerplate and business features

### ISSUE-006 Boilerplate Pull Checklist

When pulling boilerplate updates after ISSUE-006 is applied:

1. **New files from boilerplate** (no conflicts expected):
   - `frontend/src/app/(auth)/admin/AdminLayoutClient.tsx`
   - `frontend/src/app/(auth)/admin/logs/AuditLogsClient.tsx`
   - `frontend/src/app/(dashboard)/DashboardLayoutClient.tsx`
   - `frontend/src/app/NotFoundClient.tsx`

2. **Files that will conflict** (Harmony has local changes):
   - `frontend/src/app/(dashboard)/layout.tsx` - Accept boilerplate's server component wrapper
   - After accepting, ensure `DashboardLayoutClient.tsx` includes Harmony's `masterDataNav` and `posNav` arrays

3. **Manual merge needed for `DashboardLayoutClient.tsx`**:
   Add these navigation arrays that are Harmony-specific:
   ```tsx
   const posNav = [
     { name: 'Point of Sale', href: '/pos', icon: ShoppingCart },
     { name: 'Shifts', href: '/pos/shifts', icon: Clock },
   ];

   const masterDataNav = [
     { name: 'Items', href: '/master/items', icon: Package },
     { name: 'Categories', href: '/master/categories', icon: FolderTree },
     { name: 'Units', href: '/master/units', icon: Ruler },
     { name: 'Warehouses', href: '/master/warehouses', icon: Warehouse },
     { name: 'Suppliers', href: '/master/suppliers', icon: Truck },
     { name: 'Customers', href: '/master/customers', icon: UserCircle },
     { name: 'Price Levels', href: '/master/price-levels', icon: Tags },
   ];
   ```
   And add the corresponding nav sections in the sidebar JSX.
