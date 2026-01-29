# Fork & Extension Guide

How to use Harmony as a boilerplate for business projects (POS, ERP, Accounting, etc.) while keeping the ability to receive upstream updates.

## Setup (one-time per business project)

```bash
# 1. Fork or clone the boilerplate
git clone <boilerplate-repo> my-pos-project
cd my-pos-project

# 2. Rename the origin to "boilerplate"
git remote rename origin boilerplate

# 3. Add your project's repo as "origin"
git remote add origin <my-pos-project-repo>
git push -u origin main
```

## Receiving Boilerplate Updates

```bash
git fetch boilerplate
git merge boilerplate/main
# Resolve any conflicts, then commit
```

Or cherry-pick specific commits:

```bash
git fetch boilerplate
git cherry-pick <commit-hash>
```

## Directory Convention

Keep business logic in separate directories to minimize merge conflicts.

### Backend

```
backend/app/
├── api/v1/endpoints/           # Boilerplate (don't modify)
│   ├── auth.py
│   ├── users.py
│   └── ...
├── api/v1/endpoints/business/  # Your business endpoints
│   ├── __init__.py
│   ├── pos/
│   │   ├── products.py
│   │   ├── sales.py
│   │   └── inventory.py
│   └── ...
├── models/                     # Boilerplate models (don't modify)
├── models/business/            # Your business models
│   ├── product.py
│   └── sale.py
├── services/                   # Boilerplate services (don't modify)
├── services/business/          # Your business services
│   ├── product_service.py
│   └── sale_service.py
└── schemas/business/           # Your business schemas
```

### Frontend

```
frontend/src/app/
├── (dashboard)/               # Boilerplate dashboard (don't modify)
│   ├── dashboard/
│   ├── users/
│   └── branches/
├── (business)/                # Your business pages
│   ├── layout.tsx
│   ├── pos/
│   │   ├── products/
│   │   ├── sales/
│   │   └── inventory/
│   └── ...
└── ...
```

## Router Registration Pattern

Register all business routers in a single file:

```python
# backend/app/api/v1/endpoints/business/__init__.py
from fastapi import APIRouter

business_router = APIRouter(prefix="/business", tags=["Business"])

from .pos.products import router as products_router
from .pos.sales import router as sales_router

business_router.include_router(products_router, prefix="/pos")
business_router.include_router(sales_router, prefix="/pos")
```

Then add one line to `main.py`:

```python
from app.api.v1.endpoints.business import business_router
app.include_router(business_router, prefix="/api/v1")
```

This means boilerplate updates only conflict on `main.py` changes, which are rare and easy to resolve.

## Database Migrations

Use a separate Alembic branch label for business migrations:

```bash
alembic revision --autogenerate -m "add_products_table" --branch-label=business
```

This keeps business migrations separate from boilerplate migrations.

## Feature Flags

Use the existing tenant feature flag system to gate business features:

```python
from app.api.deps import require_feature

@router.get("/inventory/", dependencies=[Depends(require_feature("pos_module"))])
async def list_inventory(...):
    ...
```

Enable features per tenant via the admin panel or API.

## Key Rules for Clean Merges

1. **Never modify boilerplate files directly** - extend them instead
2. **Business code in `business/` directories** - separate from boilerplate
3. **One router registration line** in `main.py` - the only boilerplate file you touch
4. **Separate migration branches** - avoids migration chain conflicts
5. **Use feature flags** - gate business features per tenant
6. **Keep business dependencies separate** - add to a `requirements-business.txt` if needed
