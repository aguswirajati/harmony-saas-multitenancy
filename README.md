# Harmony - SaaS Multi-Tenant Boilerplate

Enterprise-grade multi-tenant SaaS boilerplate with branch management, built with **FastAPI** and **Next.js**.

## Features

### Multi-Tenancy
- Shared database with logical tenant isolation via `tenant_id` foreign keys
- Three-tier user model: Super Admin, Tenant Admin, Staff
- Per-tenant subscription tiers with user/branch limits (free, basic, premium, enterprise)
- Tenant feature flags (JSON-based toggles)

### Authentication & Security
- JWT authentication with access tokens (30 min) and refresh tokens (7 days)
- Automatic token refresh via axios interceptors
- Password reset flow with email tokens
- Email verification on registration
- User invitation system (invite via email, accept and set password)
- Redis-based rate limiting (sliding window algorithm, disable with `DEV_MODE`)
- Input validation: password strength, SQL injection, XSS prevention
- Granular permission matrix (RBAC with `require_permission` dependency + `usePermission` hook)

### Super Admin System
- Tenant management (create, edit, activate/deactivate, delete)
- Subscription tier management with limit enforcement
- Feature flag toggling per tenant
- System-wide statistics dashboard
- Cross-tenant user listing
- Audit log viewer
- Database tools (seed, reset)

### Tenant Dashboard
- Organization settings (name, domain, logo)
- User management with CRUD operations
- User invitation system (invite, accept, activate)
- Branch management (HQ + sub-branches)
- Subscription usage overview
- Tier limit pre-check dialogs
- Dark/light theme switcher

### Infrastructure
- Comprehensive audit logging (all CRUD, auth events, security events)
- Audit user tracking (`created_by_id`, `updated_by_id`, `deleted_by_id` on all models)
- `TenantScopedModel` abstract base class for tenant-isolated domain models
- Email service with responsive HTML templates (welcome, reset, verify, invite)
- Global error handling with standardized responses
- Request logging with unique request IDs
- Health check endpoints (`/health`, `/health/detailed`)
- Error boundaries and custom error pages (404, 500)
- Developer mode with debug toolbar and rate limit bypass
- Performance benchmarking script

### Testing
- **73 backend tests** — tenant isolation, auth flows, service layer (pytest + PostgreSQL)
- **22 E2E tests** — registration, login, forgot-password, dashboard, navigation (Playwright)
- CI/CD: GitHub Actions with automated lint, build, and E2E pipelines

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Python + FastAPI | 0.120.2 |
| ORM | SQLAlchemy | 2.0.44 |
| Validation | Pydantic | 2.12+ |
| Frontend | Next.js + React | 16.0.1 / 19.2.0 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | Radix UI | 50+ components |
| State | Zustand + React Query | - |
| Database | PostgreSQL | 15+ |
| Cache | Redis | 7+ |
| Auth | JWT (PyJWT) | - |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+ (optional, needed for rate limiting)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, SECRET_KEY, etc.

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# Opens at http://localhost:3000

# E2E Tests (requires backend running on localhost:8000)
npx playwright install chromium   # One-time browser install
npm run test:e2e                  # Run all E2E tests
npm run test:e2e:ui               # Interactive UI mode
```

### First Steps

1. Register a new tenant at `/register`
2. Log in at `/login`
3. For super admin access, create one via `python scripts/create_super_admin.py`

## Architecture

```
backend/
  app/
    api/v1/endpoints/   # Route handlers (thin controllers)
    core/               # Security, database, validators
    middleware/          # Rate limiter, error handler, request logger
    models/             # SQLAlchemy ORM models
    schemas/            # Pydantic request/response schemas
    services/           # Business logic layer
    templates/          # Email templates (Jinja2)

frontend/
  src/
    app/(auth)/admin/   # Super admin pages
    app/(dashboard)/    # Tenant user pages
    app/(public)/       # Login, register, password reset
    components/         # React components (ui/, admin/, tenant/)
    lib/api/            # API client with auth interceptors
    lib/store/          # Zustand state stores
```

**Key principle**: Shared database, logical isolation. All tenant data filtered by `tenant_id` at the service layer. Super admins specify target tenant via `X-Tenant-ID` header.

## API Documentation

When the backend is running:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Project Status

See [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md) for detailed status, known issues, and roadmap.

For AI development guidance, see [CLAUDE.md](CLAUDE.md).

## Additional Documentation

- [Permission Matrix](docs/PERMISSIONS.md) - RBAC roles and permissions
- [Fork Guide](docs/FORK-GUIDE.md) - How to fork for business projects (POS, ERP, etc.)
- [Performance](docs/PERFORMANCE.md) - Benchmark script and baseline numbers

## License

MIT
