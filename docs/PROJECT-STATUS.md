# Harmony SaaS - Project Status

> Single source of truth for what's built, what's not, and what's next.
> Last updated: 2026-02-20 (Session 23)

---

## 1. Project Scorecard

| Area | Status | Notes |
|------|--------|-------|
| Multi-tenant isolation | Done | tenant_id FK on all resources, enforced at API + service layer |
| Authentication (10 endpoints) | Done | Register, login, logout, refresh, forgot/reset password, email verify, accept-invite |
| Super Admin system (25+ endpoints) | Done | Tenant CRUD, subscriptions, stats, tools (runtime settings, system info, logs), audit logs (clear/archive) |
| Tenant Admin dashboard (5 pages) | Done | Dashboard, users, branches, settings, audit logs |
| Rate limiting | Done | Redis-based sliding window, per-endpoint config |
| Audit logging | Done | Full CRUD tracking, security events, IP/user-agent capture |
| Email service | Done | SMTP with Jinja2 templates (welcome, reset, verify, invite) |
| Error handling | Done | Global exception handler, error boundaries, 404 page |
| Input validation | Done | Password, subdomain, email, SQL injection, XSS validators |
| Request logging | Done | Request ID, processing time, structured logging with Loguru |
| Health checks | Done | `/health` and `/health/detailed` (DB + Redis status) |
| Tier limit enforcement | Done | User and branch limits checked on creation |
| Testing | Done | 73 backend tests + 20 Playwright E2E tests passing (auth, dashboard, navigation) |
| Docker / containerization | Done | Dockerfiles for backend + frontend, docker-compose for local dev |
| CI/CD | Done | GitHub Actions: backend (lint + test with PostgreSQL), frontend (lint + build + E2E with Playwright) |
| `.env.example` | Done | Backend + frontend env examples with documentation |
| Monitoring (Sentry) | Done | Sentry integration (opt-in via SENTRY_DSN), health checks |
| Theme switcher | Done | Dark/light mode with next-themes, toggle in sidebar |
| Permission matrix | Done | RBAC with Permission enum, `require_permission` dependency, `usePermission` hook |
| Developer mode | Done | `DEV_MODE`/`RATE_LIMIT_ENABLED` env vars, dev toolbar, runtime settings toggle, system info, app log viewer |
| User invitations | Done | Invite endpoint, accept-invite flow, email integration, 7-day token expiry |
| Performance benchmarks | Done | `scripts/benchmark.py` with httpx, `docs/PERFORMANCE.md` |
| Format settings | Done | Tenant-level currency, number, date formatting with live preview in settings |
| Subscription tiers (DB-driven) | Done | Database-driven tier config, admin UI for CRUD, replaces hardcoded tiers |
| Manual payment system | Done | Bank transfer + QRIS, upgrade requests with proof upload, admin review/approval |
| Revenue analytics | Done | MRR/ARR/churn/ARPU metrics, time-series charts, revenue breakdowns, CSV export |
| Usage metering | Done | API call tracking, quota management, usage alerts, admin usage overview |
| Coupon system | Done | Percentage/fixed/trial discounts, redemption tracking, admin CRUD, upgrade integration |
| Transaction Command Center | Done | Unified billing management, approve/reject, coupon/discount/bonus application, proration with bonus days |

**Overall**: Phase 1 (Critical Foundation) is **100% complete**. Phase 2 (Billing & Subscription System) is **100% complete**.

---

## 2. What's Implemented

### Backend: 180+ API Endpoints across 24 Routers

| Router | Prefix | Endpoints | Auth Required |
|--------|--------|-----------|---------------|
| auth | `/api/v1/auth` | 10 (register, login, logout, me, forgot-password, reset-password, verify-email, resend-verification, refresh, accept-invite) | Varies |
| tenants (admin) | `/api/v1/admin/tenants` | 12 (CRUD, subscription mgmt, feature flags, status, stats, users list) | Super Admin |
| users | `/api/v1/users` | 7 (list, get, create, update, delete, change-password, invite) | Tenant Admin/Staff |
| users (admin) | `/api/v1/admin/users` | 1 (cross-tenant listing) | Super Admin |
| branches | `/api/v1/branches` | 5 (list, get, create, update, delete) | Tenant Admin/Staff |
| tenant-settings | `/api/v1/tenant` | 9 (self-service: get/update tenant, subscription view, usage, features, format settings get/update) | Tenant Admin |
| audit | `/api/v1/audit` | 7 (list logs, stats, actions, resources, detail, clear, archive) | Admin (AUDIT_VIEW permission) |
| admin-tools | `/api/v1/admin/tools` | 5 (seed data, reset DB, settings get/post, system-info, logs) | Super Admin |
| admin-stats | `/api/v1/admin/stats` | 1 (system-wide statistics) | Super Admin |
| subscription-tiers (admin) | `/api/v1/admin/tiers` | 6 (list, get, create, update, delete, reorder) | Super Admin |
| subscription-tiers (public) | `/api/v1/tiers` | 2 (list public tiers, get tier by code) | Public |
| payment-methods (admin) | `/api/v1/admin/payment-methods` | 6 (list, get, create, update, delete, set QRIS image) | Super Admin |
| payment-methods (public) | `/api/v1/payment-methods` | 1 (list available methods) | Authenticated |
| upgrade-requests (tenant) | `/api/v1/upgrade-requests` | 7 (create, list, get, update, upload proof, cancel, preview, invoice) | Tenant Admin |
| upgrade-requests (admin) | `/api/v1/admin/upgrade-requests` | 5 (list all, get, review, stats, pending count) | Super Admin |
| admin-billing | `/api/v1/admin/billing` | 12 (list, detail, stats, approve, reject, apply-coupon, apply-discount, add-bonus, add-note, create manual, requires-review) | Super Admin |
| admin-revenue | `/api/v1/admin/revenue` | 3 (stats, trends, CSV export) | Super Admin |
| usage (tenant) | `/api/v1/usage` | 8 (summary, quotas, trends, alerts, dismiss alert) | Tenant Admin |
| usage (admin) | `/api/v1/admin/usage` | 8 (overview, tenant list, tenant detail, set quota, reset quota) | Super Admin |
| coupons | `/api/v1/coupons` + `/api/v1/admin/coupons` | 15 (CRUD, validate, apply, redemptions, stats) | Varies |
| features | `/api/v1/features` | 3 (list tenant features, check feature, detailed status) | Tenant |
| features (admin) | `/api/v1/admin/features` | 6 (list all, matrix, update tier features, tenant features, override, reset) | Super Admin |
| notifications | `/api/v1/notifications` | 12 (list, count, types, get, mark-read, mark-all-read, delete, delete-all, preferences get/update/bulk/reset) | Authenticated |
| notifications (admin) | `/api/v1/admin/notifications` | 3 (send, stats, types) | Super Admin |
| files | `/api/v1/files` | 12 (presign upload, confirm, list, get, download, update, delete, storage usage, tenant logo CRUD, user avatar CRUD) | Varies |
| files (admin) | `/api/v1/files/admin` | 1 (admin download - view any file) | Super Admin |

### Backend: Models (16 concrete + 2 abstract bases)

| Model | Table | Key Fields |
|-------|-------|------------|
| User | `users` | email, role, tenant_id, is_super_admin, verification/reset/invitation tokens |
| Tenant | `tenants` | name, code, subdomain, subscription_tier, max_users, max_branches, features (JSON) |
| Branch | `branches` | name, code, tenant_id, is_headquarters |
| AuditLog | `audit_logs` | user_id, tenant_id, action, resource, details (JSON), ip_address, request_id |
| File | `files` | filename, storage_key, content_type, size_bytes, category, tenant_id |
| SubscriptionTier | `subscription_tiers` | code, display_name, price_monthly, price_yearly, max_users, max_branches, max_storage_gb, features (JSON) |
| PaymentMethod | `payment_methods` | code, name, type (bank_transfer/qris/wallet), bank_name, account_number, qris_image_file_id, wallet_type |
| UpgradeRequest | `upgrade_requests` | request_number, tenant_id, current/target_tier_code, amount, status, payment_proof_file_id, coupon_code, discount_amount |
| BillingTransaction | `billing_transactions` | transaction_number, upgrade_request_id, amount, original_amount, credit_applied, discount_amount, bonus_days, net_amount, proration_details (JSON), period_start, period_end, coupon_id, admin_notes, adjusted_by_id, rejected_by_id, rejection_reason, status |
| UsageRecord | `usage_records` | tenant_id, metric_type, value, recorded_at |
| UsageQuota | `usage_quotas` | tenant_id, metric_type, quota_limit, current_usage, alert_threshold |
| UsageAlert | `usage_alerts` | tenant_id, metric_type, threshold_percent, message, is_dismissed |
| Coupon | `coupons` | code, name, discount_type, discount_value, max_redemptions, valid_until, valid_for_tiers |
| CouponRedemption | `coupon_redemptions` | coupon_id, tenant_id, upgrade_request_id, discount_applied, expires_at |
| BaseModel | (abstract) | id (UUID), created_at, updated_at, deleted_at, is_active, created_by_id, updated_by_id, deleted_by_id |
| Notification | `notifications` | user_id, tenant_id, type, title, message, priority, data (JSON), is_read, read_at, channels_sent |
| NotificationPreference | `notification_preferences` | user_id, notification_type, in_app_enabled, email_enabled, email_digest |
| TenantScopedModel | (abstract) | Inherits BaseModel + tenant_id (CASCADE), branch_id (SET NULL) |

### Backend: Services (14)

| Service | Purpose |
|---------|---------|
| AuthService | Registration, login, token refresh, password reset, email verification |
| TenantService | Tenant CRUD, subscription management, system stats, tier configs (from DB) |
| UserService | User CRUD within tenant, role management, tier limit checks, user invitation |
| BranchService | Branch CRUD within tenant, HQ management, tier limit checks |
| AuditService | Log actions, query audit trail, security event tracking |
| EmailService | SMTP sending, Jinja2 template rendering (welcome, reset, verify, invite) |
| SubscriptionTierService | Tier CRUD, get public/all tiers, tier limits lookup, default tier seeding |
| PaymentService | Payment method CRUD, upgrade request lifecycle (create → proof → review → apply) |
| RevenueService | MRR/ARR/churn/ARPU calculations, revenue trends, breakdowns, CSV export |
| UsageService | Usage tracking, quota management, alerts, trends aggregation |
| ProrationService | Proration calculations for mid-cycle upgrades/downgrades |
| CouponService | Coupon validation, redemption, statistics, discount application |
| FeatureService | Tier-based feature checking, tenant feature overrides, feature matrix |
| NotificationService | Create, list, mark read, delete notifications, preference management, bulk operations |

### Backend: Middleware (4)

| Middleware | File | Purpose |
|------------|------|---------|
| Rate Limiter | `middleware/rate_limiter.py` | Redis sliding window, configurable per-endpoint |
| Error Handler | `middleware/error_handler.py` | Global exception handling, standardized responses |
| Request Logger | `middleware/logging.py` | Request ID, processing time, structured logging |
| Usage Tracking | `middleware/usage_tracking.py` | API call metering per tenant, excludes auth/public paths |

### Backend: Validators

| Validator | Checks |
|-----------|--------|
| PasswordValidator | Length 8-128, uppercase, lowercase, digit, blocks common passwords |
| SubdomainValidator | Alphanumeric + hyphens, blocks 40+ reserved names |
| EmailValidator | Blocks disposable domains, normalizes to lowercase |
| NameValidator | Strips XSS characters, supports Unicode, 1-100 chars |
| SQLInjectionValidator | Detects SQL keywords, comments, injection patterns |
| XSSValidator | Detects script tags, javascript: protocol, event handlers |

### Frontend: 36 Pages

**Public (6 pages)**:
| Route | Purpose |
|-------|---------|
| `/login` | Login with role-based redirect |
| `/register` | Tenant + admin registration |
| `/forgot-password` | Request password reset email |
| `/reset-password` | Set new password with token |
| `/verify-email` | Verify email with token |
| `/accept-invite` | Accept user invitation and set password |

**Dashboard - Tenant Users (10 pages)**:
| Route | Purpose |
|-------|---------|
| `/dashboard` | Stats, usage cards, quick actions |
| `/branches` | Branch CRUD with tier limit pre-check, Set as HQ |
| `/users` | User CRUD with tier limit pre-check, tenant_role (owner/admin/member) |
| `/settings` | Organization tab + Format settings tab + Subscription tab + Permissions tab |
| `/audit-logs` | Tenant-scoped audit log viewer (admin only) |
| `/upgrade` | Upgrade wizard + active request management (proof preview, invoice dialog, print/PDF) |
| `/usage` | Usage dashboard with quotas, trends, alerts |
| `/profile` | User profile with edit mode, change password, account deletion/closure |
| `/notifications` | Notification list with filters, mark as read, delete, notification preferences |

**Admin - Super Admin (20 pages)**:
| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard with system stats |
| `/admin/tenants` | Tenant list with filters, pagination |
| `/admin/tenants/new` | Create tenant form |
| `/admin/tenants/[id]` | Tenant detail (edit, subscription, features, status, delete) |
| `/admin/users` | Cross-tenant user listing |
| `/admin/stats` | System statistics |
| `/admin/subscriptions` | Subscription tier overview and management |
| `/admin/logs` | Audit log viewer |
| `/admin/tools` | Developer tools (seed, reset, runtime settings, system info, logs) |
| `/admin/settings/organization` | Admin org settings |
| `/admin/settings/subscription` | Admin subscription settings |
| `/admin/tiers` | Subscription tier CRUD (pricing, limits, features) |
| `/admin/payment-methods` | Payment method CRUD (bank transfer, QRIS) |
| `/admin/upgrade-requests` | Review and approve/reject upgrade requests |
| `/admin/billing` | Billing transactions list, dashboard stats |
| `/admin/billing/[transactionId]` | Transaction detail with approve/reject/coupon/discount/bonus/notes actions, payment proof preview, invoice dialog |
| `/admin/revenue` | Revenue analytics (MRR, ARR, churn, trends, CSV export) |
| `/admin/usage` | System-wide usage overview, per-tenant quotas |
| `/admin/coupons` | Coupon management (CRUD, statistics, redemptions) |
| `/admin/permissions` | Permission matrix display (System roles vs SystemPermissions) |

### Frontend: Key Components

**Layout Components** (P1-2):
- **AppSidebar** - Collapsible sidebar with shadcn components, mobile drawer support
- **TopNavBar** - Top navigation with page title, theme toggle, notifications, user dropdown
- **Logo** - System/tenant logo with collapsed state support
- **UserDropdown** - User avatar with profile/logout menu
- **NotificationDropdown** - Notification bell with dropdown (placeholder)
- **DevModeButton** - Dev mode toggle for admin (syncs with backend)

**Core Components**:
- **ThemeProvider** - next-themes dark/light mode provider
- **ThemeToggle** - Dark/light mode toggle button
- **DevToolbar** - Development-only toolbar showing user role, tenant info
- **ErrorBoundary** - React class component for graceful error catching
- **EmailVerificationBanner** - Banner for unverified users
- **AvatarUpload** - User avatar upload with preview
- **TenantLogoUpload** - Tenant logo upload with preview

**Admin Components**:
- **CreateTenantForm** - Multi-field tenant creation form
- **SystemStatsGrid** - System-wide statistics display
- **TenantDataTable** - Filterable tenant data table
- **TenantUsageCard** - Tenant resource usage display

- 50+ Radix UI-based components in `components/ui/`

### Database Migrations

| Migration | Description |
|-----------|-------------|
| `be606be2fe13` | Initial tables (tenants, branches, users) |
| `5c5b21b248cf` | Add super admin support |
| `ac0eec46e937` | Add email verification and password reset tokens |
| `a53b92ec41a0` | Add audit logs table |
| `b7f2a1c3d4e5` | Add user invitation fields (token, expiry, invited_by) |
| `73458efe5641` | Add audit tracking (created/updated/deleted_by_id), tenant code, TenantScopedModel base |
| `d8f3a2b5c6e7` | Add file storage (files table, tenant storage tracking) |
| `e9f4a3b6c7d8` | Add subscription system (subscription_tiers, payment_methods, upgrade_requests) |
| `g2h4i5j6k7l8` | Add billing transactions table (invoices/receipts for upgrade requests) |
| `h3i5j6k7l8m9` | Add proration billing fields to upgrade_requests |
| `i4j6k7l8m9n0` | Add usage metering (usage_records, usage_quotas, usage_alerts) |
| `j5k7l8m9n0o1` | Add coupon system (coupons, coupon_redemptions, upgrade_requests coupon fields) |
| `k6l8m9n0o1p2` | Transaction command center (billing_transaction enhancements: discount, bonus, proration, admin actions) |
| `l7m9n0o1p2q3` | User architecture redesign (system_role/tenant_role columns, owner per tenant constraint) |
| `m8n0o1p2q3r4` | Notification system (notifications, notification_preferences tables) |

---

## 3. Known Issues & Cleanup Needed

### Bugs
- [x] ~~`middleware.ts` had `console.log` debug statements~~ - Removed
- [x] ~~Middleware public routes list missing `/forgot-password`, `/reset-password`, `/verify-email`~~ - Fixed

### Tech Debt
- [x] ~~165 `tmpclaude-*` temp files~~ - Deleted, added to `.gitignore`
- [x] ~~`__pycache__` directories~~ - Deleted, added global pattern to `.gitignore`
- [x] ~~Duplicate component files (`components_admin_*.tsx`, `auth_admin_*.tsx`)~~ - Deleted (7 files)
- [x] ~~`schemas_auth.py` duplicate~~ - Deleted
- [x] ~~Debug scripts (`check_users.py`, `test_login.py`, etc.)~~ - Deleted (7 files)
- [x] ~~`nul` Windows artifact~~ - Deleted
- [x] ~~Storage-related TODOs in tenant service~~ - Extracted to `_get_storage_used_gb()` stub method

### Security
- [x] ~~Ensure `SECRET_KEY` is not a placeholder in production~~ - Validated at startup (rejects weak keys when DEBUG=False)
- [x] ~~CORS origins should be configured per environment~~ - Documented in `docs/CORS-CONFIGURATION.md`
- [x] ~~Rate limiter fails open if Redis is unavailable~~ - Documented in `docs/SECURITY.md` with nginx mitigation

---

## 4. Boilerplate Finalization Checklist

Before this project can be considered a production-ready boilerplate:

### Must Have
- [x] Testing infrastructure (pytest + fixtures, 73 tests, tenant isolation verified)
- [x] Docker setup (backend + frontend Dockerfiles, docker-compose.yml + docker-compose.dev.yml)
- [x] CI/CD pipeline (GitHub Actions: backend-ci.yml, frontend-ci.yml)
- [x] `.env.example` with all variables documented (backend + frontend)
- [x] Remove all debug scripts, temp files, and duplicate components
- [x] Remove `console.log` from middleware.ts
- [x] Production CORS configuration guide (`docs/CORS-CONFIGURATION.md`)

### Should Have
- [x] E2E test for critical paths (registration, login, tenant CRUD)
- [x] Sentry or equivalent error tracking integration (backend + frontend, opt-in via SENTRY_DSN)
- [x] Database backup/restore scripts (`scripts/backup.sh`, `scripts/restore.sh`)
- [x] Deployment guide (`docs/DEPLOYMENT.md` — Docker Compose, Railway, manual VPS)

### Nice to Have
- [x] Makefile with common commands (`make help` for full list)
- [x] Pre-commit hooks (`.pre-commit-config.yaml` — ruff, eslint, trailing whitespace, private key detection)
- [x] API documentation enrichment (OpenAPI tags, app description, endpoint summaries)
- [x] Performance benchmarks (`scripts/benchmark.py`, `docs/PERFORMANCE.md`)

---

## 5. Pending Tasks & Roadmap

> Prioritized backlog of features, improvements, and fixes.

### Priority Levels
- **P0 (Critical)**: Bugs, broken features - must fix before release
- **P1 (High)**: Core UX/architecture changes needed for production
- **P2 (Medium)**: Important features and improvements
- **P3 (Low)**: Nice-to-have, future enhancements

---

### P0 - Critical (Bugs & Broken Features)

| ID | Task | Description | Status |
|----|------|-------------|--------|
| P0-1 | **Forgot password not working** | Fix `/forgot-password` page - missing Request dependency in endpoint | ✅ Complete |
| P0-2 | **Seed data outdated** | Comprehensive seed_data.py with tiers, payment methods, system admin, demo tenant (owner/admin/members), second tenant for multi-tenant testing. | ✅ Complete |

---

### P1 - High Priority (Core Architecture & UX)

| ID | Task | Description | Status |
|----|------|-------------|--------|
| P1-1 | **User Architecture Redesign** | System scope (System Admin, System Operator) + Tenant scope (Tenant Owner, Tenant Admin, Tenant Member). See [detailed plan](plans/P1-1-USER-ARCHITECTURE-REDESIGN.md). | ✅ Complete |
| P1-2 | **Layout Redesign** | New layout structure: shadcn sidebar with collapsible mode, top nav with page title/desc, dev_mode button, theme switcher, notification dropdown, user dropdown (profile, logout). | ✅ Complete |
| P1-3 | **Simplify Registration Flow** | Removed subdomain and company fields from registration. Auto-generates subdomain from email and company name from user name. | ✅ Complete |
| P1-4 | **Permission Matrix Enhancement** | Extended permission system: sidebar filtering by permission, conditional rendering of create/edit/delete buttons on branches/users pages, billing-specific permissions for subscription tab and upgrade actions, quick actions permission-gated on dashboard. | ✅ Complete |
| P1-5 | **Payment Provider Interface (Strategy Pattern)** | Abstract payment integration using Strategy Pattern. Support Stripe, Midtrans, manual payment, and other providers. User selects active provider in settings. | 🔴 Not Started |
| P1-6 | **System Admin Profile** | Add profile link to admin user dropdown. Create system settings page (platform name, logo, organizational info). | 🔴 Not Started |
| P1-7 | **Feature Flag Architecture** | Feature registry with 30+ business features (POS, Inventory, Masterdata, Purchasing, Reports, Platform, Loyalty, HR modules). FeatureService for tier-based and tenant-override feature checking. `require_feature()` dependency for backend. `useFeature()` hook and `FeatureGate` component for frontend. API endpoints at `/api/v1/features` and `/api/v1/admin/features`. | ✅ Done |
| P1-8 | **Admin Page Cleanup** | Removed duplicate "Upgrade Requests" tab from Subscriptions page (functionality exists in Billing page). | ✅ Complete |
| P1-9 | **Permission Matrix Display** | Read-only permission matrix pages showing role-permission mappings. System admin sees SystemPermissions (Admin vs Operator) at `/admin/permissions`. Tenant settings shows TenantPermissions (Owner vs Admin vs Member) at `/settings?tab=permissions`. | ✅ Done |

---

### P2 - Medium Priority (Feature Improvements)

| ID | Task | Description | Status |
|----|------|-------------|--------|
| P2-1 | **User Profile Page Redesign** | Profile page with edit mode (name, phone), change password with visibility toggle, account deletion for members, account closure for owners (with confirmation dialogs). | ✅ Complete |
| P2-2 | **Branch Switcher** | UI component to switch between branches within a tenant (for multi-branch tenants) | 🔴 Not Started |
| P2-3 | **Admin Impersonate** | Super admin can impersonate tenant users for support/debugging (with audit trail) | 🔴 Not Started |
| P2-4 | **Notification System** | In-app notifications with bell dropdown, notification preferences, mark as read, delete, bulk operations. Database-backed with 16 notification types across 6 categories. | ✅ Done |
| P2-5 | **Internationalization (i18n)** | Support English + Bahasa Indonesia. Use `next-intl` or `react-i18next`. Language switcher, backend error i18n keys. | 🔴 Not Started |
| P2-6 | **Tier-Feature Integration** | Tier features stored as feature codes in DB. Admin tier management UI with checkbox feature selection grouped by module. DEFAULT_TIERS updated with feature codes. Features loaded into auth store on login. | ✅ Done |

---

### P3 - Low Priority (Future Enhancements)

| ID | Task | Description | Status |
|----|------|-------------|--------|
| P3-1 | **Prometheus Metrics** | Add `/metrics` endpoint for monitoring | 🔴 Not Started |
| P3-2 | **Per-tenant Branding** | Custom colors/themes per tenant | 🔴 Not Started |
| P3-3 | **Bulk User Invitations** | Invite multiple users at once via CSV or batch form | 🔴 Not Started |
| P3-4 | **Custom Report Builder** | User-defined reports and scheduled email delivery | 🔴 Not Started |
| P3-5 | **Trial Period Management** | Built-in trial period tracking and conversion flows | 🔴 Not Started |
| P3-6 | **Frontend Unit Tests** | Jest + React Testing Library for components | 🔴 Not Started |
| P3-7 | **Security Audit** | OWASP compliance, security scanners, penetration testing | 🔴 Not Started |
| P3-8 | **Performance Optimization** | Query optimization, Redis caching, bundle analysis | 🔴 Not Started |

---

### Implementation Notes

#### P1-1: User Architecture Redesign ✅ COMPLETE

**Status**: All 118 backend tests passing. UI polish deferred.

**Decision**: Approved architecture with two distinct scopes.

| Scope | Roles | Description |
|-------|-------|-------------|
| **System** | `admin`, `operator` | SaaS platform management (tenant_id = NULL) |
| **Tenant** | `owner`, `admin`, `member` | Customer business operations (tenant_id = UUID) |

**Key Rules:**
- 1 Tenant Owner per tenant (billing authority)
- Tenant Owner deletion = account closure (hard delete all tenant data)
- Tenant Admin/Member deletion = soft delete
- System Operator = limited platform access (support role)

**Detailed Plan**: [`docs/plans/P1-1-USER-ARCHITECTURE-REDESIGN.md`](plans/P1-1-USER-ARCHITECTURE-REDESIGN.md)

**36 tasks across 5 phases:**
1. Database Schema Migration (7 tasks)
2. Backend Permission System (6 tasks)
3. API Changes (7 tasks)
4. Frontend UI Adjustments (10 tasks)
5. Testing & Validation (6 tasks)

#### P1-4: Permission Architecture

**Three-Layer Permission Model:**

| Layer | Scope | Roles | Permission Type | Description |
|-------|-------|-------|-----------------|-------------|
| **System** | Platform | Admin, Operator | `SystemPermission` | SaaS platform management |
| **Tenant** | Business Admin | Owner, Admin, Member | `TenantPermission` | Tenant team & settings management |
| **Business** | Features | (Future) | (Future) | Domain-specific feature permissions |

**Permission Flow:**
```
User logs in → Has role (system_role or tenant_role)
    → Role maps to fixed permissions (hardcoded in code)
    → UI shows/hides elements based on permissions
    → Backend validates with require_*_permission() dependencies
```

**Current Permission Counts:**
- SystemPermission: 17 permissions (system.tenants.*, system.billing.*, system.tiers.*, etc.)
- TenantPermission: 22 permissions (tenant.users.*, tenant.branches.*, tenant.billing.*, etc.)

**Key Files:**
- Backend: `backend/app/core/permissions.py` - Permission enums, role mappings, dependencies
- Frontend: `frontend/src/hooks/use-permission.ts` - Permission hooks (useTenantPermission, useSystemPermission)
- Frontend: `frontend/src/components/PermissionGate.tsx` - Declarative permission components

**System Role Permissions:**

| Permission | Admin | Operator |
|------------|:-----:|:--------:|
| system.tenants.* (view/create/update/delete/impersonate) | ✓ | view only |
| system.billing.* (view/manage) | ✓ | view only |
| system.tiers.* (view/manage) | ✓ | view only |
| system.coupons.* (view/manage) | ✓ | view only |
| system.users.* (view/create/update/delete) | ✓ | view only |
| system.tools.access | ✓ | ✗ |
| system.settings.* (view/manage) | ✓ | view only |
| system.audit.* (view/manage) | ✓ | view only |
| system.revenue.view | ✓ | ✓ |
| system.usage.* (view/manage) | ✓ | view only |

**Tenant Role Permissions:**

| Permission | Owner | Admin | Member |
|------------|:-----:|:-----:|:------:|
| tenant.dashboard.view | ✓ | ✓ | ✓ |
| tenant.users.view | ✓ | ✓ | ✓ |
| tenant.users.create/update/delete/invite/change_role | ✓ | ✓ | ✗ |
| tenant.branches.view | ✓ | ✓ | ✓ |
| tenant.branches.create/update/delete | ✓ | ✓ | ✗ |
| tenant.settings.view | ✓ | ✓ | ✓ |
| tenant.settings.edit | ✓ | ✓ | ✗ |
| tenant.billing.view | ✓ | ✓ | ✗ |
| tenant.billing.manage | ✓ | ✗ | ✗ |
| tenant.account.delete | ✓ | ✗ | ✗ |
| tenant.audit.view | ✓ | ✓ | ✗ |
| tenant.files.view | ✓ | ✓ | ✓ |
| tenant.files.upload | ✓ | ✓ | ✓ |
| tenant.files.delete | ✓ | ✓ | ✗ |
| tenant.usage.view | ✓ | ✓ | ✓ |

**Not Yet Implemented:**
- Database-stored permissions (currently hardcoded)
- Per-user permission overrides
- Business feature permissions (inventory, sales, etc.)
- Tier-based feature access (linked to subscription)

#### P1-5: Payment Provider Interface

```
┌─────────────────────────────────────────────────────────┐
│                  PaymentProvider (Interface)            │
├─────────────────────────────────────────────────────────┤
│ + create_payment(amount, metadata) → PaymentIntent      │
│ + verify_payment(payment_id) → PaymentResult            │
│ + refund_payment(payment_id, amount) → RefundResult     │
│ + get_payment_methods() → List[PaymentMethod]           │
│ + handle_webhook(payload) → WebhookResult               │
└─────────────────────────────────────────────────────────┘
          ▲              ▲              ▲
          │              │              │
   ┌──────┴──────┐ ┌─────┴─────┐ ┌──────┴──────┐
   │StripeProvider│ │MidtransProvider│ │ManualProvider│
   └─────────────┘ └───────────┘ └─────────────┘
```

**Files to create:**
- `backend/app/services/payment_providers/base.py` - Abstract interface
- `backend/app/services/payment_providers/stripe_provider.py`
- `backend/app/services/payment_providers/midtrans_provider.py`
- `backend/app/services/payment_providers/manual_provider.py` (current system)
- `backend/app/services/payment_providers/factory.py` - Provider factory

---

## 6. Future Implementation Guide

### Infrastructure

**Docker & Deployment**
- ~~Create `backend/Dockerfile`~~ Done
- ~~Create `frontend/Dockerfile`~~ Done (multi-stage with standalone output)
- ~~Create `docker-compose.yml`~~ Done (backend, frontend, postgres, redis)
- ~~Create `docker-compose.prod.yml`~~ Done (nginx reverse proxy, production settings)
- ~~Create `Makefile`~~ Done

**CI/CD**
- ~~`.github/workflows/backend-ci.yml` - lint (ruff), test (pytest with PostgreSQL service)~~ Done
- ~~`.github/workflows/frontend-ci.yml` - lint (eslint), build (next build), E2E (Playwright)~~ Done
- ~~`.github/workflows/deploy.yml`~~ Done (builds + pushes images to GHCR on merge to main)

**Monitoring**
- ~~Add Sentry SDK to backend and frontend~~ Done (opt-in via SENTRY_DSN)
- Add `/metrics` endpoint (Prometheus format)
- ~~Create database backup scripts~~ Done (`scripts/backup.sh`, `scripts/restore.sh`)

### Features

**Notifications System** (Done)
- ~~In-app notification bell + dropdown~~ Done (NotificationDropdown component with real data)
- ~~Notification preferences per user~~ Done (per-category in-app/email toggles)
- ~~Notification management page~~ Done (/notifications with list, filter, mark read, delete)
- ~~16 notification types across 6 categories~~ Done (system, billing, user, tenant, usage, security)
- Real-time notifications via WebSocket/SSE (deferred)
- Email notification digests (deferred)

**File Upload & Storage** (Done)
- ~~S3-compatible file storage service~~ Done (MinIO/S3, presigned URLs, inline/download modes)
- ~~Tenant logo upload~~ Done (with preview, delete)
- ~~User avatar upload~~ Done (with preview, delete)
- ~~Payment proof upload~~ Done (upgrade request workflow)
- ~~Storage quota tracking per tenant~~ Done (model + enforcement)
- Document attachments (deferred)

**Theme Switcher** (Done)
- ~~Dark/light mode toggle~~ Done (ThemeToggle component in sidebar)
- ~~Store preference in localStorage~~ Done (next-themes)
- ~~CSS variables or Tailwind dark mode classes~~ Done (both)
- Per-tenant branding colors (optional, deferred)

**Internationalization (i18n)**
- Support for English and Bahasa Indonesia
- Use `next-intl` or `react-i18next`
- Translation files in `frontend/messages/`
- Language switcher component
- Backend error messages with i18n keys

**Subscription & Billing** (Done)
- ~~Database-driven subscription tiers~~ Done (admin CRUD, replaces hardcoded config)
- ~~Manual payment system (Indonesia market)~~ Done (bank transfer + QRIS, proof upload, admin review)
- ~~Self-service tier upgrade flow~~ Done (4-step wizard: tier → billing → payment → confirm)
- ~~Upgrade request tracking~~ Done (status workflow: pending → payment_uploaded → approved/rejected)
- ~~Revenue analytics dashboard~~ Done (MRR, ARR, churn rate, ARPU, time-series charts, CSV export)
- ~~Usage metering~~ Done (API call tracking, quota management, alerts, admin overview)
- ~~Coupon/discount system~~ Done (percentage, fixed, trial extension, redemption tracking, upgrade integration)
- ~~Proration for mid-cycle changes~~ Done (credit/charge calculations, days remaining)
- Stripe or Midtrans online payment integration (deferred)
- Trial period management (deferred)

**User Invitations** (Done)
- ~~Admin sends invite email to new user~~ Done (`POST /api/v1/users/invite`)
- ~~Invite link → accept page → set password → auto-login~~ Done (`/accept-invite` page + `POST /api/v1/auth/accept-invite`)
- ~~Invitation tracking and expiry~~ Done (7-day token expiry)
- Bulk invite support (deferred)

**Analytics & Reporting** (Partial)
- ~~Tenant usage analytics (active users, API calls, storage)~~ Done (usage dashboard, quotas, trends)
- ~~Super admin system-wide analytics~~ Done (revenue dashboard, usage overview)
- ~~Export to CSV/PDF~~ Done (revenue CSV export, invoice PDF)
- ~~Dashboard charts~~ Done (recharts for revenue trends, usage graphs)
- Custom report builder (deferred)
- Scheduled report emails (deferred)

### Quality

**Testing**
- Backend: ~~pytest + pytest-asyncio, test factories~~ Done (73 tests, PostgreSQL, savepoint rollback)
- Frontend: Jest + React Testing Library for components (not started)
- E2E: ~~Playwright for critical user flows~~ Done (5 spec files: registration, login, forgot-password, dashboard, navigation)
- ~~Tenant isolation security tests~~ Done (10 tests covering cross-tenant user/branch access)

**Security Audit**
- OWASP Top 10 compliance review
- Run security scanners (Bandit for Python, npm audit for JS)
- Security headers (CSP, HSTS, X-Frame-Options)
- Penetration testing checklist

**Performance**
- Database query optimization (check N+1 queries)
- Add database indexes where needed
- Redis caching for frequently accessed data
- Frontend code splitting and lazy loading
- Bundle size analysis and optimization

### Documentation

**API Documentation**
- Enrich OpenAPI descriptions for all endpoints
- Add request/response examples
- Document error codes and responses

**Deployment Guide**
- Docker deployment step-by-step
- Cloud platform guides (AWS, Railway, DigitalOcean)
- Environment configuration per platform
- SSL/TLS setup instructions

**User Guide**
- Super admin onboarding guide
- Tenant admin getting started
- Staff user guide

---

## 7. Session History

| # | Date | Focus | Outcome |
|---|------|-------|---------|
| 1 | 2026-01-24 | Email infrastructure | Email service, 4 templates, 5 auth endpoints, password reset + verification flows |
| 2 | 2026-01-24 | Security hardening | Rate limiter, 6 validators, error handler, request logger, health checks |
| 3 | 2026-01-25 | Audit logging | AuditLog model, audit service, integrated into auth/tenant/user endpoints |
| 4 | 2026-01-27 | Super admin system | Tenant detail page, subscriptions page, admin sidebar, bug fixes |
| 5 | 2026-01-28 | Backend testing | 73 tests: tenant isolation, auth (login/register/token), services (tenant/user/branch), authorization |
| 5b | 2026-01-28 | Infrastructure | Docker, CI/CD, .env.example, CORS guide, Sentry, backup scripts, deployment guide, Makefile, pre-commit |
| 6 | 2026-01-28 | Finalization | Commit cleanup, docker-compose.prod.yml + nginx, deploy workflow, OpenAPI enrichment, security docs, storage TODO resolution |
| 7 | 2026-01-28 | E2E Testing | Playwright setup, 22 E2E tests (5 spec files: registration, login, forgot-password, dashboard, navigation), CI integration with PostgreSQL + Redis + backend |
| 8 | 2026-01-29 | Boilerplate finalization | Theme switcher (dark/light), permission matrix (RBAC), dev mode tools, user invitation system, performance benchmarks, fork guide |
| 9 | 2026-01-29 | ERP foundation | Audit user tracking (created/updated/deleted_by_id on BaseModel), TenantScopedModel abstract base, tenant code column, health check text() fix |
| 10 | 2026-01-30 | Developer tools & audit permissions | Fixed audit permission inconsistency (permission-based auth + tenant scoping), enhanced dev tools (runtime settings, system info, app logs), audit log clear/archive, tenant audit logs page |
| 11 | 2026-02-04 | Dark mode & UI polish | Fixed dark mode text colors across admin/dashboard pages (branches, users, settings), dev tools card reordering (System Info → Runtime Settings → Request Logs → Database Tools), admin dashboard welcome card conditional (only when no tenants), dev toolbar fix (only show when logged in), TenantDataTable dark mode fixes |
| 12 | 2026-02-04 | React hooks bug fix | Fixed "Rendered fewer hooks than expected" crash on /admin/tools page when toggling dev_mode off - moved all hooks above conditional early return |
| 13 | 2026-02-07 | SSR fix & Format settings | Fixed Next.js 16 Turbopack SSR prerender error (server/client component split pattern), implemented tenant-level format settings (currency, number, date formatting with live preview) |
| 14 | 2026-02-12 | Subscription & Payment system | Database-driven subscription tiers (admin CRUD), manual payment system (bank transfer + QRIS), upgrade request workflow (create → proof upload → admin review → apply), 15 new endpoints, 3 new models |
| 15 | 2026-02-12 | Payment UX & Invoice | Payment proof preview on tenant/admin pages, inline image viewing (no download), fullscreen lightbox, invoice dialog with print/PDF, billing transactions model, e-wallet payment type, tenant logo upload improvements |
| 16 | 2026-02-13 | Billing System Enhancement | Revenue analytics (MRR/ARR/churn/ARPU, trends, CSV export), Usage metering (API tracking, quotas, alerts, middleware), Coupon system (discounts, redemptions, admin CRUD), 5 new models, 4 new services, 30+ new endpoints |
| 17 | 2026-02-18 | Transaction Command Center | Unified billing transaction management, transaction detail page with approve/reject/coupon/discount/bonus actions, proration calculation fix for free-to-paid upgrades, bonus days applied on approval, subscription duration breakdown UX, payment proof preview with presigned URLs, invoice dialog with print/PDF |
| 18 | 2026-02-19 | User Architecture Planning | Created prioritized roadmap (P0-P3), discussed and finalized user architecture redesign (System scope: admin/operator, Tenant scope: owner/admin/member), created detailed 36-task implementation plan across 5 phases |
| 19 | 2026-02-20 | User Architecture Implementation | Implemented P1-1: Database migration (new role columns, data migration, constraints), backend permission system (SystemPermission/TenantPermission enums, new dependencies), API changes (auth/user endpoints, account closure, ownership transfer), frontend core (auth store, permission hooks, middleware) |
| 20 | 2026-02-20 | User Architecture Testing | Fixed all 118 backend tests: updated test fixtures (conftest.py), updated assertions (staff→member, admin→owner), fixed TenantService.create_tenant to use TenantRole.OWNER, fixed backward compatibility role property for system admin (returns "super_admin") |
| 21 | 2026-02-20 | Layout Redesign & Simplified Registration | Implemented P1-2: Layout redesign with shadcn sidebar (collapsible, mobile sheet drawer, keyboard shortcuts), TopNavBar with page titles, NotificationDropdown, UserDropdown, DevModeButton, Logo components. Fixed P0-1: forgot password endpoint missing Request dependency. Added dark mode support to auth pages. Implemented P1-3: Simplified registration (removed subdomain/company fields, auto-generation). |
| 22 | 2026-02-20 | Profile & UX Improvements | Implemented P2-1: Profile page with edit mode (name, phone), change password with eye toggle, account deletion (members) and account closure (owners). Updated user management to use tenant_role (owner/admin/member). Fixed owner role display in UserDialog. Branch dialog HQ management (Set as Headquarters button). Reorganized subscription flow (upgrade button in plans section, pending upgrade info, removed sidebar upgrade menu). |
| 23 | 2026-02-20 | Permission Matrix Enhancement | Implemented P1-4: Permission-based UI rendering across dashboard. AppSidebar now filters nav items by tenant permissions. Branches page: create/edit/delete buttons gated by permissions. Users page: create/edit/delete buttons gated by permissions. Settings page: subscription tab visible only with billing.view, upgrade buttons only with billing.manage. Dashboard quick actions filtered by permissions. Created PermissionGate component for declarative permission checks. |
| 24 | 2026-02-21 | Feature Audit & Notifications | Created FEATURE_AUDIT_ANALYSIS.md documenting feature flag system audit. Implemented P2-4 Notification System: 2 new models (Notification, NotificationPreference), NotificationService, 15 API endpoints (user + admin), NotificationDropdown with real data, /notifications page with list/filter/preferences. 16 notification types across 6 categories (system, billing, user, tenant, usage, security). |

Detailed session logs: [`docs/sessions/`](sessions/)
