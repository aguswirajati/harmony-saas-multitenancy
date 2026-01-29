# Security Considerations

This document covers security-related configuration and known trade-offs in the Harmony SaaS platform.

---

## SECRET_KEY Configuration

The `SECRET_KEY` environment variable is used to sign JWT tokens. A weak or default key compromises all authentication.

**Production requirements:**
- Use a cryptographically random string of at least 32 characters
- Generate with: `python -c "import secrets; print(secrets.token_urlsafe(64))"`
- Never use the development default (`dev-secret-key-change-in-production`)
- Rotate keys by deploying a new key; existing sessions will be invalidated

The application will refuse to start in production (`DEBUG=False`) if the SECRET_KEY contains `dev-secret` or is shorter than 32 characters. See `backend/app/config.py`.

---

## Rate Limiter Fail-Open Behavior

The rate limiter depends on Redis. If Redis is unavailable, rate limiting **fails open** -- requests are allowed through without limit.

**Why fail-open:**
- Avoids blocking all authenticated users when Redis goes down temporarily
- Authentication still requires valid JWT tokens regardless of rate limiting
- Brute force protection is one layer; account lockout and audit logging provide additional defense

**Mitigations:**
- Monitor Redis uptime in production (use `/health/detailed` endpoint)
- Set up alerts for Redis connection failures (logged as warnings)
- Consider adding an application-level in-memory fallback rate limiter for critical auth endpoints
- Use infrastructure-level rate limiting (nginx `limit_req`, cloud WAF) as a secondary layer

**nginx-level rate limiting** (recommended addition to `nginx/nginx.conf`):
```nginx
# In the http block:
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# In the /api/v1/auth/ location:
location /api/v1/auth/ {
    limit_req zone=auth burst=10 nodelay;
    proxy_pass http://backend;
}
```

---

## CORS Configuration

CORS is configured via the `CORS_ORIGINS` environment variable (JSON array of allowed origins).

**Per-environment guidance:**

| Environment | CORS_ORIGINS | Notes |
|-------------|-------------|-------|
| Local dev | `["http://localhost:3000"]` | Default in docker-compose.yml |
| Staging | `["https://staging.your-domain.com"]` | Match staging frontend URL |
| Production | `["https://your-domain.com"]` | Only your production domain |

**Do not use** `["*"]` in production. This allows any website to make authenticated API requests on behalf of your users.

See `docs/CORS-CONFIGURATION.md` for detailed setup instructions.

---

## Tenant Isolation

Data isolation is enforced at multiple layers:

1. **Database**: All resources have `tenant_id` foreign keys with CASCADE delete
2. **API dependencies**: `get_tenant_context()` extracts tenant from JWT; all queries filter by tenant_id
3. **Service layer**: Every query includes tenant_id filter
4. **Tests**: `test_tenant_isolation/` verifies cross-tenant access is blocked

**Risk:** A missing tenant_id filter in a new endpoint would leak data across tenants. Always:
- Use `get_tenant_context()` or `get_current_tenant()` dependencies
- Filter queries by `tenant_id`
- Add isolation tests for new resource types

---

## Soft Delete Considerations

All records use soft delete (`is_active=False`, `deleted_at` timestamp). Additionally, `BaseModel` includes `created_by_id`, `updated_by_id`, and `deleted_by_id` fields for audit tracking (who performed each action). This means:

- Deleted user emails remain in the database (relevant for uniqueness constraints)
- Audit logs reference soft-deleted users/tenants (by design, for compliance)
- `deleted_by_id` records which user performed the soft delete for accountability
- Ensure all queries filter `is_active == True` to avoid exposing deleted records
- Database backups contain soft-deleted data

---

## Input Validation

Validators in `backend/app/core/validators.py` protect against:
- SQL injection patterns
- XSS via script tags, event handlers, javascript: URIs
- Weak passwords and common password lists
- Disposable email domains
- Reserved subdomain names

These validators are applied in Pydantic schemas. Any new user-facing input fields should use the appropriate validator.

---

## Password Storage

Passwords are hashed with bcrypt via `passlib`. The system:
- Enforces minimum 8 characters with uppercase, lowercase, and digit
- Blocks common passwords (password123, etc.)
- Never stores or logs plaintext passwords
- Uses constant-time comparison for password verification

---

## Token Security

- **Access tokens**: 30-minute expiry, contain user_id, role, tenant_id
- **Refresh tokens**: 7-day expiry, used to obtain new access tokens
- **Password reset tokens**: 1-hour expiry, single-use
- **Email verification tokens**: Single-use

All tokens are signed with HS256 using the SECRET_KEY. Token payloads do not contain sensitive data beyond identifiers.
