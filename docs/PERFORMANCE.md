# Performance Benchmarks

## Running Benchmarks

```bash
# Requires backend running on localhost:8000
pip install httpx  # if not already installed
python scripts/benchmark.py

# With custom options
python scripts/benchmark.py --base-url http://localhost:8000 --iterations 100
```

## What's Tested

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Basic health check |
| `/health/detailed` | GET | No | DB + Redis connectivity check |
| `/api/v1/auth/login` | POST | No | User login with JWT generation |
| `/api/v1/auth/me` | GET | Yes | Current user info |
| `/api/v1/users` | GET | Yes | List tenant users |
| `/api/v1/branches` | GET | Yes | List tenant branches |
| `/api/v1/auth/refresh` | POST | No | Token refresh |

The script also tests 10 concurrent requests to `/health` to measure concurrency handling.

## Baseline Numbers

Run `python scripts/benchmark.py` against your local setup to establish baseline numbers. Results depend on hardware, database size, and Redis availability.

Expected ranges for local development (single process):

| Endpoint | Expected Avg | Notes |
|----------|-------------|-------|
| Health check | < 5ms | No DB call |
| Detailed health | < 50ms | DB + Redis ping |
| Login | < 100ms | Password hashing (bcrypt) |
| Auth me | < 20ms | JWT decode + DB lookup |
| List users | < 30ms | DB query with filters |
| List branches | < 30ms | DB query with filters |
| Token refresh | < 50ms | JWT decode + create |

## Optimization Notes

- **bcrypt** password hashing is intentionally slow (security tradeoff)
- **Rate limiting** adds Redis round-trip per request when enabled
- **Request logging** middleware adds minimal overhead
- For production, run with multiple workers: `uvicorn app.main:app --workers 4`
