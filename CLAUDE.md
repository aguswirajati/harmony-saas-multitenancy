# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Project Status

**Phase 1 (Critical Foundation): 100% complete.**

What's built:
- 49 API endpoints across 8 routers (auth, tenants, users, branches, tenant-settings, audit, admin-tools, admin-stats)
- 21 frontend pages (6 public, 4 dashboard, 11 admin)
- 5 models (User, Tenant, Branch, AuditLog) + BaseModel and TenantScopedModel abstract bases
- 6 services (Auth, Tenant, User, Branch, Audit, Email)
- 3 middleware (rate limiter, error handler, request logger)
- 6 input validators (password, subdomain, email, name, SQL injection, XSS)
- Permission matrix (RBAC with `require_permission` dependency + `usePermission` hook)
- Dark/light theme switcher (next-themes)
- User invitation system (invite + accept-invite flow)
- Developer mode tools (DEV_MODE flag, dev toolbar)
- Performance benchmark script
- 73 backend tests (tenant isolation, auth, services, authorization) - all passing
- 20 Playwright E2E tests passing + 2 fixme (registration, login, dashboard, navigation)
- Docker setup (Dockerfiles + docker-compose for local dev)
- CI/CD (GitHub Actions for backend lint/test, frontend lint/build/e2e)

What's NOT built yet (Phase 2+): notifications, file upload, i18n, billing integration.

For full status details, see [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md).

## Project Overview

**Harmony** is an enterprise-grade SaaS multi-tenant boilerplate with branch management, built with FastAPI (backend) and Next.js (frontend). The system uses a **shared database with logical tenant isolation** model, where all tenants share one database but data is isolated via `tenant_id` foreign keys.

## Development Commands

### Backend (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Database migrations
alembic upgrade head                    # Apply all migrations
alembic downgrade -1                    # Rollback one migration
alembic revision --autogenerate -m "description"  # Create new migration
alembic current                         # Show current migration version
alembic history                         # Show migration history

# Run tests (requires harmony_test PostgreSQL database)
pytest                                  # Run all tests (73 tests)
pytest -v                              # Verbose output
pytest tests/test_tenant_isolation/ -v # Tenant isolation tests only
pytest tests/test_auth/ -v            # Auth tests only
pytest tests/test_services/ -v        # Service tests only
pytest --cov=app --cov-report=term-missing  # With coverage report
pytest -k "test_name"                  # Run tests matching pattern

# Create super admin user (for system administration)
python scripts/create_super_admin.py

# Seed sample data
python scripts/seed_data.py
```

**Environment variables required** (`.env`):
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT signing key
- `REDIS_URL` - Redis connection (optional, defaults to localhost:6379)
- `DEV_MODE` - Set `true` to disable rate limiting and enable dev tools (default: `false`)
- `RATE_LIMIT_ENABLED` - Explicitly disable rate limiting (default: `true`)

### Frontend (Next.js)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev                            # Starts on http://localhost:3000

# Build for production
npm run build                          # Creates optimized production build
npm run start                          # Runs production server

# Linting
npm run lint                           # Run ESLint

# E2E Tests (requires backend running on localhost:8000)
npx playwright install chromium        # One-time: install browser
npm run test:e2e                       # Run all E2E tests
npm run test:e2e:ui                    # Run with interactive UI
npx playwright test e2e/auth/          # Run auth tests only
npx playwright test e2e/dashboard/     # Run dashboard tests only
npx playwright test --headed           # Run with visible browser
npx playwright show-report             # View HTML test report
```

### Docker

```bash
# Start all services (PostgreSQL, Redis, backend, frontend)
docker compose up -d

# Start with hot-reload for development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Rebuild after dependency changes
docker compose build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop all services
docker compose down

# Stop and remove volumes (reset database)
docker compose down -v
```

### CI/CD

GitHub Actions workflows run automatically on push/PR to `main`:
- **`backend-ci.yml`**: Lint (ruff) + test (pytest with PostgreSQL service container)
- **`frontend-ci.yml`**: Lint (ESLint) + build (next build) + E2E tests (Playwright with PostgreSQL + Redis + backend)

## Architecture Overview

### Multi-Tenancy Model

**Pattern**: Shared Database with Logical Isolation

- All tenants share a single PostgreSQL database
- Every resource (users, branches) has a `tenant_id` foreign key
- Tenant isolation is enforced at:
  1. **Database layer**: Foreign key constraints with CASCADE delete
  2. **API layer**: Dependency injection extracts tenant context from JWT or headers
  3. **Service layer**: All queries filtered by `tenant_id`

### Three-Tier User Model

1. **Super Admin** (`role='super_admin'`, `tenant_id=NULL`, `is_super_admin=True`)
   - System-wide access to all tenants
   - Can create/delete tenants via `/api/v1/admin/tenants/*`
   - Specifies target tenant via `X-Tenant-ID` header

2. **Tenant Admin** (`role='admin'`, has `tenant_id`)
   - Manages their own tenant's settings, users, and branches
   - Access to `/api/v1/tenant/*` self-service endpoints
   - Cannot access other tenants' data

3. **Tenant Staff** (`role='staff'`, has `tenant_id`)
   - Regular users within a tenant
   - Limited permissions based on role

### Layered Architecture

```
API Endpoints (backend/app/api/v1/endpoints/)
       ↓
  Pydantic Schemas (backend/app/schemas/)
       ↓
  Services (backend/app/services/)          ← Business logic lives here
       ↓
  Models (backend/app/models/)              ← SQLAlchemy ORM
       ↓
  Database (PostgreSQL)
```

**Key principle**: Keep endpoints thin, put business logic in services for reusability and testability.

### Authentication Flow

1. **Registration** (`POST /api/v1/auth/register`):
   - Creates new tenant + HQ branch + admin user in one transaction
   - Returns JWT access token (30 min) and refresh token (7 days)

2. **Login** (`POST /api/v1/auth/login`):
   - Accepts `email`, `password`, optional `tenant_subdomain`
   - Returns tokens + user info + tenant info
   - Super admins receive `tenant=null`

3. **Request Authentication**:
   - Frontend sends `Authorization: Bearer <token>`
   - Backend dependency `get_current_user()` decodes JWT
   - JWT payload: `{"sub": user_id, "role": "admin", "tenant_id": "uuid"}`

4. **Tenant Context Resolution** (`get_tenant_context()` dependency):
   - Super admin with `X-Tenant-ID` header → use header value
   - Regular user → use `user.tenant_id` from JWT
   - Used to filter all database queries

5. **Token Refresh** (`POST /api/v1/auth/refresh`):
   - Accepts refresh token in request body
   - Returns new access token and refresh token
   - Frontend automatically refreshes tokens before expiry using axios interceptors

### Permission System

**Backend** (`backend/app/core/permissions.py`):
- `Permission` enum with granular actions (e.g., `users.create`, `branches.delete`)
- `ROLE_PERMISSIONS` dict maps roles to permission sets
- `require_permission(permission)` FastAPI dependency for endpoint protection
- See `docs/PERMISSIONS.md` for the full matrix

**Frontend** (`frontend/src/hooks/use-permission.ts`):
- `usePermission(permission)` - returns boolean for single permission check
- `usePermissions(...permissions)` - returns boolean array for multiple checks
- Mirrors backend ROLE_PERMISSIONS for client-side UI gating

### Authentication Features

**User Invitation Flow**:
1. Admin invites user via `POST /api/v1/users/invite` (email, role, optional branch)
2. System creates inactive user with invitation token (7-day expiry)
3. Invitation email sent with link to `/accept-invite?token=...`
4. User sets password and optional name on accept-invite page
5. `POST /api/v1/auth/accept-invite` activates user and returns auth tokens

**Password Reset Flow**:
1. User requests password reset at `/forgot-password`
2. Backend sends reset email with token (requires email service configuration)
3. User clicks link and lands on `/reset-password?token=...`
4. User sets new password
5. System validates token and updates password

**Email Verification**:
1. User registers and receives verification email
2. User clicks verification link → `/verify-email?token=...`
3. Backend validates token and marks email as verified
4. Unverified users see banner in dashboard prompting verification
5. Email verification banner component: `EmailVerificationBanner`

**Public Auth Routes**:
- `/login` - User login page
- `/register` - New tenant registration
- `/forgot-password` - Request password reset
- `/reset-password` - Set new password with token
- `/verify-email` - Verify email with token
- `/accept-invite` - Accept user invitation and set password

### Dependency Injection Pattern

Located in `backend/app/api/deps.py`, these are composable FastAPI dependencies:

- `get_db()` - Database session
- `get_current_user()` - Extracts user from JWT token
- `get_current_active_user()` - Ensures user is active
- `get_super_admin_user()` - Requires `role='super_admin'`
- `get_admin_user()` - Requires role in ['super_admin', 'admin']
- `get_tenant_context()` - Returns tenant for current request context
- `get_current_tenant()` - Returns logged-in user's tenant (non-super-admin)

**Usage example**:
```python
@router.get("/branches/")
async def list_branches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_tenant_context)
):
    return BranchService.get_branches(db, tenant.id)
```

### Soft Delete Pattern

All models inherit from `BaseModel` with:
- `is_active: bool = True`
- `deleted_at: datetime | None = None`
- `created_by_id: UUID | None` — who created the record
- `updated_by_id: UUID | None` — who last updated the record
- `deleted_by_id: UUID | None` — who soft-deleted the record

Never hard delete records. Instead:
```python
# Mark as deleted
obj.is_active = False
obj.deleted_at = datetime.utcnow()
obj.deleted_by_id = current_user.id
db.commit()

# Filter active records
db.query(User).filter(User.is_active == True)
```

### TenantScopedModel

For domain models that belong to a tenant, inherit from `TenantScopedModel` instead of `BaseModel`:

```python
from app.models.base import TenantScopedModel

class Item(Base, TenantScopedModel):
    __tablename__ = "items"
    name = Column(String, nullable=False)
    # tenant_id and branch_id are inherited automatically
```

`TenantScopedModel` extends `BaseModel` and adds:
- `tenant_id` (required, CASCADE delete) — links to `tenants` table
- `branch_id` (optional, SET NULL) — links to `branches` table for branch-level scoping

### Frontend Architecture

**State Management**:
- **Zustand** (`lib/store/authStore.ts`): Global auth state (user, tenant, tokens)
- **React Query**: Server state caching & data fetching
- **localStorage**: Token persistence

**API Client** (`lib/api/client.ts`):
- Axios instance with interceptors
- Auto-injects `Authorization: Bearer <token>`
- Auto-injects `X-Tenant-ID` and `X-Branch-ID` headers
- Automatic token refresh on 401 errors (refreshes token and retries request)
- Logout on refresh token failure

**Route Protection** (`middleware.ts`):
- Public routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/accept-invite`
- Super admin users: Forced redirect to `/admin/*`
- Regular users: Cannot access `/admin/*`, redirect to `/dashboard`
- Unauthenticated: Redirect to `/login`

**Error Handling**:
- **ErrorBoundary Component** (`components/ErrorBoundary.tsx`): React class component that catches JavaScript errors in child components
  - Shows user-friendly error UI with retry option
  - Displays error details in development mode
  - Logs errors to console (can be extended to send to error tracking service)
- **Global Error Page** (`app/global-error.tsx`): Catches errors at the app root level
- **Route Error Page** (`app/error.tsx`): Catches errors within route segments
- **404 Not Found** (`app/not-found.tsx`): Custom 404 page with helpful navigation options
- All error pages include:
  - Clear error messages
  - "Try Again" and "Go Home" actions
  - Development-only error details (stack traces)
  - Error IDs for support reference in production

**Directory Structure**:
- `app/(auth)/admin/*` - Super admin pages
- `app/(dashboard)/*` - Tenant user dashboard
- `app/(public)/*` - Login/register pages
- `components/admin/*` - Super admin UI components
- `components/tenant/*` - Tenant-specific components
- `components/features/*` - Business feature components
- `components/ui/*` - Reusable Radix UI-based components

### Audit Logging System

**Model** (`backend/app/models/audit_log.py`):
- Tracks all user actions with fields: `user_id`, `tenant_id`, `action`, `resource`, `resource_id`, `details` (JSON), `status`, `ip_address`, `user_agent`, `request_id`
- Composite indexes for common queries: `(user_id, created_at)`, `(tenant_id, created_at)`, `(action, created_at)`

**Service** (`backend/app/services/audit_service.py`):
- `log_action()` - Main method, auto-extracts IP/user-agent/request-ID from Request object
- `get_audit_logs()` - Query with filters (user, tenant, action, date range, pagination)
- `get_failed_login_attempts()` / `get_security_events()` - Security monitoring

**Action constants** (`AuditAction`): `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `PASSWORD_RESET`, `TENANT_CREATED`, `USER_CREATED`, `USER_ROLE_CHANGED`, etc.

**Integrated into**: auth endpoints (login/logout/register/password-reset), tenant endpoints (CRUD, subscription, status), user endpoints (CRUD, role changes).

**API endpoints** (`backend/app/api/v1/endpoints/audit.py`):
- `GET /api/v1/audit/logs` - List with filters
- `GET /api/v1/audit/logs/{id}` - Detail
- `GET /api/v1/audit/stats` - Statistics
- `GET /api/v1/audit/actions` - Available action types

### Email Service

**Service** (`backend/app/services/email_service.py`):
- SMTP-based with async sending (`aiosmtplib`)
- Jinja2 template rendering from `backend/app/templates/email/`
- Methods: `send_welcome_email()`, `send_password_reset_email()`, `send_verification_email()`, `send_invitation_email()`
- Gracefully disabled when `MAIL_ENABLED=False`

**Templates** (4 responsive HTML templates in `backend/app/templates/email/`):
- `welcome.html`, `password-reset.html`, `email-verification.html`, `user-invitation.html`

**Configuration** (in `.env`):
- `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`
- `MAIL_ENABLED` (set `False` for development)
- `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`
- `FRONTEND_URL` (for email link generation)

### Middleware Stack

Registered in `backend/app/main.py`, execution order:

1. **Request Logger** (`backend/app/middleware/logging.py`):
   - Generates UUID request ID per request
   - Adds `X-Request-ID` and `X-Process-Time` response headers
   - Logs method, path, client IP, status, duration

2. **CORS** (FastAPI built-in):
   - Origins from `CORS_ORIGINS` env var

3. **Rate Limiter** (`backend/app/middleware/rate_limiter.py`):
   - Redis-based sliding window algorithm
   - Applied per-endpoint via dependency injection
   - Presets: `auth_rate_limit` (5/15min), `strict_rate_limit` (3/hr), `api_rate_limit` (100/min)
   - Disabled when `DEV_MODE=true` or `RATE_LIMIT_ENABLED=false`
   - Fails open if Redis unavailable (logs warning)

4. **Error Handler** (`backend/app/middleware/error_handler.py`):
   - Catches `RequestValidationError` (422), SQLAlchemy errors (500), generic exceptions (500)
   - Returns standardized JSON: `{"error": {"code": "...", "message": "...", "timestamp": "...", "details": [...]}}`
   - Debug mode shows stack traces

### Input Validators

Located in `backend/app/core/validators.py`. Used in Pydantic schemas via `field_validator`:

- **PasswordValidator**: 8-128 chars, uppercase + lowercase + digit required, blocks common passwords
- **SubdomainValidator**: Lowercase alphanumeric + hyphens, blocks 40+ reserved names (www, api, admin, etc.)
- **EmailValidator**: Blocks disposable email domains, normalizes to lowercase
- **NameValidator**: Strips `< > " ' & ;` characters, supports Unicode
- **SQLInjectionValidator**: Detects SQL keywords, comments, OR/AND patterns
- **XSSValidator**: Detects `<script>`, `javascript:`, event handlers, `<iframe>`

### Admin Endpoints

**Admin Stats** (`backend/app/api/v1/endpoints/admin_stats.py`):
- `GET /api/v1/admin/stats` - System-wide statistics (tenant counts, user counts, tier distribution)

**Admin Tools** (`backend/app/api/v1/endpoints/admin_tools.py`):
- `POST /api/v1/admin/tools/seed` - Seed sample data for development
- `POST /api/v1/admin/tools/reset` - Reset database (development only)

## Important Code Patterns

### When Adding New Endpoints

1. **Define Pydantic schemas** in `backend/app/schemas/`
2. **Implement service methods** in `backend/app/services/`
3. **Create endpoint** in `backend/app/api/v1/endpoints/`
4. **Use appropriate dependencies** for auth/tenant context
5. **Always filter by tenant_id** unless you're a super admin endpoint

Example:
```python
# schemas/item.py
class ItemCreate(BaseModel):
    name: str
    description: str | None = None

# services/item_service.py
class ItemService:
    @staticmethod
    def create_item(db: Session, tenant_id: UUID, data: ItemCreate) -> Item:
        item = Item(tenant_id=tenant_id, **data.dict())
        db.add(item)
        db.commit()
        return item

# endpoints/items.py
@router.post("/", response_model=ItemResponse)
async def create_item(
    data: ItemCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_context)
):
    return ItemService.create_item(db, tenant.id, data)
```

### When Adding Database Models

1. **Inherit from `TenantScopedModel`** for tenant-scoped models (gets `id`, `created_at`, `updated_at`, `deleted_at`, `is_active`, `created_by_id`, `updated_by_id`, `deleted_by_id`, `tenant_id`, `branch_id`)
2. **Inherit from `BaseModel`** only for tenant-independent models (e.g., system-level tables)
3. **Create migration**: `alembic revision --autogenerate -m "add_item_model"`
4. **Review migration file** before applying
5. **Apply migration**: `alembic upgrade head`

Example (tenant-scoped):
```python
# models/item.py
from app.models.base import TenantScopedModel
from sqlalchemy import Column, String
from sqlalchemy.orm import relationship
from app.core.database import Base

class Item(Base, TenantScopedModel):
    __tablename__ = "items"

    name = Column(String, nullable=False)
    description = Column(String)

    # tenant_id, branch_id inherited from TenantScopedModel
    tenant = relationship("Tenant", back_populates="items")
```

### Tenant Feature Flags

Tenants have a `features` JSON field for feature toggles:

```python
# Check if tenant has feature
if "inventory_module" in tenant.features:
    # Allow inventory access
    pass

# Service method to check feature
def require_feature(feature_name: str):
    """Dependency to check if tenant has feature enabled"""
    def _check(tenant: Tenant = Depends(get_tenant_context)):
        if feature_name not in tenant.features:
            raise HTTPException(status_code=403, detail=f"Feature '{feature_name}' not enabled")
        return tenant
    return _check

# Usage in endpoint
@router.get("/inventory/")
async def list_inventory(
    tenant: Tenant = Depends(require_feature("inventory_module"))
):
    pass
```

### Subscription Tiers

Defined in `TenantService.TIER_CONFIGS`:
- **free**: 5 users, 1 branch, 1GB storage
- **basic**: 20 users, 5 branches, 10GB storage
- **premium**: 100 users, 20 branches, 50GB storage
- **enterprise**: Unlimited users/branches, 200GB storage

Check limits:
```python
# In service layer
current_user_count = db.query(User).filter(User.tenant_id == tenant_id).count()
if current_user_count >= tenant.max_users:
    raise HTTPException(status_code=403, detail="User limit reached")
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app initialization, CORS, middleware registration |
| `backend/app/config.py` | Environment variables & settings (DB, JWT, email, Redis) |
| `backend/app/api/deps.py` | **Critical**: Auth & tenant context dependencies |
| `backend/app/core/security.py` | JWT creation/validation, password hashing |
| `backend/app/core/database.py` | Database connection & session management |
| `backend/app/core/validators.py` | Input validators (password, subdomain, email, SQLi, XSS) |
| `backend/app/services/auth_service.py` | Registration, login, token refresh, password reset |
| `backend/app/services/tenant_service.py` | Tenant CRUD, subscription management, system stats |
| `backend/app/services/audit_service.py` | Audit trail logging and querying |
| `backend/app/services/email_service.py` | SMTP email sending with Jinja2 templates |
| `backend/app/core/permissions.py` | Permission enum and ROLE_PERMISSIONS mapping |
| `backend/app/middleware/rate_limiter.py` | Redis-based rate limiting |
| `backend/app/middleware/error_handler.py` | Global exception handler |
| `backend/app/middleware/logging.py` | Request logging with request ID |
| `backend/app/models/audit_log.py` | Audit log model with action constants |
| `frontend/src/lib/api/client.ts` | Axios client with auth interceptors & token refresh |
| `frontend/src/lib/api/auth.ts` | Auth API calls (login, register, refresh, password reset) |
| `frontend/src/lib/store/authStore.ts` | Zustand auth state store |
| `frontend/src/hooks/use-permission.ts` | Frontend permission checking hook |
| `frontend/src/components/theme-provider.tsx` | next-themes dark/light mode provider |
| `frontend/src/components/dev/dev-toolbar.tsx` | Development-only debug toolbar |
| `frontend/middleware.ts` | **Critical**: Route protection & role-based redirects |
| `frontend/src/components/ErrorBoundary.tsx` | React error boundary for graceful error handling |
| `frontend/src/components/EmailVerificationBanner.tsx` | Email verification reminder banner |
| `backend/tests/conftest.py` | **Critical**: Test fixtures, factories, DB session setup |
| `backend/tests/test_tenant_isolation/test_isolation.py` | **Security**: Cross-tenant data access tests |
| `frontend/playwright.config.ts` | Playwright E2E test configuration |
| `frontend/e2e/helpers/auth.ts` | E2E test helpers (register, login, token injection) |
| `frontend/e2e/auth/` | E2E tests for registration, login, forgot-password |
| `frontend/e2e/dashboard/` | E2E tests for dashboard content and navigation |

## Common Gotchas

1. **Always use `tenant_id` in queries**: Forgetting to filter by tenant can cause data leaks
2. **Super admin `tenant_id` is NULL**: Don't assume all users have a tenant
3. **Soft deletes**: Check `is_active=True` in all queries
4. **JWT expiration**: Access tokens expire in 30 minutes but auto-refresh prevents logout
5. **Migration order**: Always review auto-generated migrations before applying
6. **Frontend token storage**: Tokens in localStorage, user data in cookies for middleware
7. **CORS origins**: Update `CORS_ORIGINS` in `.env` for frontend domain
8. **Email service**: Password reset and email verification require email service configuration (SendGrid/AWS SES)
9. **Error boundaries**: Wrap async components in ErrorBoundary for graceful error handling
10. **Public routes**: Update `middleware.ts` when adding new public authentication routes
11. **Permissions**: Keep `ROLE_PERMISSIONS` in sync between backend (`core/permissions.py`) and frontend (`hooks/use-permission.ts`)
12. **Dev mode**: Set `DEV_MODE=true` in `.env` to disable rate limiting and show dev toolbar
13. **Invitation tokens**: Expire after 7 days; invited users are inactive until they accept

## Testing Infrastructure

### Backend Tests

**73 tests, all passing** against PostgreSQL. Uses transaction rollback per test (savepoint pattern) for speed and isolation.

#### Test Database Setup
```bash
# One-time: create test database
createdb harmony_test
# Or set TEST_DATABASE_URL env var for custom connection string
```

#### Test Structure
```
backend/tests/
├── conftest.py                          # Core fixtures, factories, autouse mocks
├── test_tenant_isolation/
│   └── test_isolation.py                # SECURITY CRITICAL: cross-tenant data access
├── test_auth/
│   ├── test_login.py                    # Login flows, JWT claims
│   ├── test_register.py                 # Registration, duplicate rejection
│   ├── test_token.py                    # Token refresh
│   └── test_authorization.py            # Role-based access control
└── test_services/
    ├── test_tenant_service.py           # Tenant CRUD, subscriptions, limits, stats
    ├── test_user_service.py             # User CRUD, tier limits, password change
    └── test_branch_service.py           # Branch CRUD, HQ protection, tier limits
```

#### Key Test Fixtures (`conftest.py`)
- `db_session` — per-test transactional session with savepoint rollback
- `client` — FastAPI `TestClient` with DB override
- `create_tenant()`, `create_branch()`, `create_user()` — factory callables
- `tenant_with_admin` — tenant + HQ branch + admin user
- `two_tenants` — two isolated tenants for cross-tenant tests
- `super_admin` — super admin user (no tenant)
- `auth_headers(user)` — generates `Authorization: Bearer` headers
- `mock_email_service` (autouse) — prevents SMTP calls
- `disable_rate_limiting` (autouse) — bypasses Redis rate limits

#### Adding New Backend Tests
1. Use factory fixtures to create test data
2. Always test tenant isolation for new resource types
3. Test both happy path and error cases (401, 403, 404)
4. Service tests use `db_session` directly; API tests use `client`

### E2E Tests (Playwright)

**22 tests across 5 spec files**, running against a live frontend + backend (Chromium).

#### Prerequisites
- Backend running on `localhost:8000` (with PostgreSQL + Redis)
- Chromium installed: `cd frontend && npx playwright install chromium`

#### Running E2E Tests
```bash
cd frontend
npm run test:e2e          # Run all E2E tests (auto-starts Next.js dev server)
npm run test:e2e:ui       # Interactive UI mode
npx playwright test --headed  # Visible browser
```

#### E2E Test Structure
```
frontend/e2e/
├── helpers/
│   └── auth.ts                          # Test helpers: registerTestTenant, loginViaUI, setAuthTokens
├── auth/
│   ├── registration.spec.ts             # 3 tests: register, duplicate subdomain, login link
│   ├── login.spec.ts                    # 6 tests: success, wrong password, bad email, logout, nav links
│   └── forgot-password.spec.ts          # 2 tests: submit email, back-to-login link
└── dashboard/
    ├── dashboard.spec.ts                # 5 tests: welcome, stats, org info, quick actions, account info
    └── navigation.spec.ts               # 6 tests: page access, admin redirect, sidebar links
```

#### E2E Test Helpers (`e2e/helpers/auth.ts`)
- `registerTestTenant()` — registers a new tenant via API, returns credentials + tokens
- `loginViaUI(page, email, password)` — fills and submits the login form
- `setAuthTokens(page, tenant)` — injects auth tokens into localStorage (skips login UI for speed)

#### Adding New E2E Tests
1. Create spec files in `frontend/e2e/` under a descriptive subdirectory
2. Use `registerTestTenant()` to create isolated test data per test/suite
3. Use `setAuthTokens()` for tests that don't need to exercise the login flow
4. Use unique timestamps in test data to avoid collisions between parallel runs
5. Assert on visible text and semantic roles, not CSS classes or internal IDs

#### E2E Configuration (`frontend/playwright.config.ts`)
- `baseURL`: `http://localhost:3000` (override with `E2E_BASE_URL` env var)
- `webServer`: auto-starts `npm run dev` (reuses existing server locally)
- Projects: Chromium only (expand later)
- CI: retries 2x, single worker, HTML reporter
- Traces captured on first retry; screenshots on failure

## API Documentation

When backend is running, visit:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc
- OpenAPI JSON: http://localhost:8000/api/openapi.json

## What's Next

See [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) for the complete status tracker including:
- Boilerplate finalization checklist
- Known issues and tech debt
- Future implementation guide (Docker, testing, notifications, i18n, billing, etc.)
- Session history
