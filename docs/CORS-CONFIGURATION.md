# CORS Configuration Guide

> How to configure Cross-Origin Resource Sharing (CORS) for development and production.

## How It Works

The backend uses FastAPI's `CORSMiddleware` configured in `backend/app/main.py`. Allowed origins come from the `CORS_ORIGINS` environment variable defined in `backend/app/config.py`.

```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # from CORS_ORIGINS env var
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"]
)
```

## Configuration

### Development (default)

In your `.env` file:

```env
CORS_ORIGINS=["http://localhost:3000"]
```

This allows the Next.js dev server at `localhost:3000` to call the backend API.

### Production — Single Domain

```env
CORS_ORIGINS=["https://app.yourdomain.com"]
```

### Production — Multiple Domains

If you serve from multiple domains (e.g., main app + admin panel on separate subdomains):

```env
CORS_ORIGINS=["https://app.yourdomain.com","https://admin.yourdomain.com"]
```

### Production — With Custom Domain per Tenant

If tenants have custom domains, you need to list all possible origins or use a wildcard subdomain approach. The current implementation uses a static list, so for dynamic tenant domains you have two options:

**Option A: List all known domains** (works for small number of tenants)

```env
CORS_ORIGINS=["https://app.yourdomain.com","https://tenant1.yourdomain.com","https://tenant2.yourdomain.com"]
```

**Option B: Implement dynamic CORS** (recommended for multi-tenant SaaS)

Replace the static middleware in `main.py` with a custom one that checks the `Origin` header against your database of tenant domains:

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class DynamicCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin", "")

        # Always allow your main domain
        allowed = origin in settings.CORS_ORIGINS

        # Check tenant custom domains from DB/cache
        if not allowed and origin:
            # Query your tenant table or Redis cache
            # allowed = is_valid_tenant_domain(origin)
            pass

        response = await call_next(request)

        if allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Expose-Headers"] = "X-Request-ID, X-Process-Time"

        return response
```

## Security Checklist

1. **Never use `allow_origins=["*"]` with `allow_credentials=True`** — browsers will reject it and it exposes your API to any website.

2. **Always use HTTPS origins in production** — `https://` not `http://`.

3. **Keep the origin list minimal** — only include domains that actually need to call your API.

4. **`allow_methods=["*"]`** is acceptable since authentication is handled via JWT tokens, not CORS. If you want to restrict further, use `["GET", "POST", "PUT", "DELETE", "OPTIONS"]`.

5. **`allow_headers=["*"]`** is needed because the frontend sends custom headers (`Authorization`, `X-Tenant-ID`, `X-Branch-ID`). You can restrict to: `["Authorization", "Content-Type", "X-Tenant-ID", "X-Branch-ID"]`.

6. **`expose_headers`** lists response headers the browser can read. Currently exposes `X-Request-ID` and `X-Process-Time` for debugging.

## Docker / Reverse Proxy

When running behind nginx or a load balancer:

- Set `CORS_ORIGINS` to your **public-facing domain** (what users type in the browser), not internal service URLs.
- If nginx handles CORS headers, disable them in the backend to avoid duplicate headers.
- Example: Users visit `https://app.example.com` which nginx proxies to `backend:8000` — set `CORS_ORIGINS=["https://app.example.com"]`.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `CORS policy: No 'Access-Control-Allow-Origin'` | Origin not in `CORS_ORIGINS` | Add your frontend URL to `CORS_ORIGINS` |
| `CORS policy: credentials flag` | Using `*` with credentials | List specific origins instead of `*` |
| Preflight (OPTIONS) returns 405 | Middleware order wrong | Ensure CORS middleware is added first in `main.py` |
| Works in Postman but not browser | Postman doesn't enforce CORS | This is normal — fix the origin list |
| Headers duplicated | Both nginx and backend set CORS | Configure CORS in one place only |
