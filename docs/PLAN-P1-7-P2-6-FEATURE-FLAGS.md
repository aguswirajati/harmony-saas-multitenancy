# P1-7 & P2-6: Feature Flag Architecture + Tier Integration

## Overview

Implement a comprehensive feature flag system that:
1. Defines business features with metadata
2. Maps features to subscription tiers
3. Allows tenant-level overrides
4. Provides backend dependencies and frontend hooks for feature gating

---

## Feature Registry Design

### Feature Modules & Codes

```
Module: pos (Point of Sale)
├── pos.terminal        - POS terminal interface
├── pos.transactions    - Sales transactions
└── pos.shifts          - Shift management

Module: inventory
├── inventory.stock     - Stock management
└── inventory.adjustments - Stock adjustments

Module: masterdata
├── masterdata.items       - Product/Item management
├── masterdata.categories  - Category management
├── masterdata.units       - Unit of measure
├── masterdata.warehouses  - Warehouse management
├── masterdata.suppliers   - Supplier management
├── masterdata.customers   - Customer management
├── masterdata.price_levels - Price level tiers
├── masterdata.discounts   - Discount rules
└── masterdata.promotions  - Promotional campaigns

Module: purchasing (Future)
├── purchasing.orders      - Purchase orders
└── purchasing.receiving   - Goods receiving

Module: reports
├── reports.basic          - Basic reports
├── reports.advanced       - Advanced analytics
└── reports.export         - Export to CSV/PDF

Module: platform
├── platform.api_access    - External API access
├── platform.integrations  - Third-party integrations
├── platform.audit_advanced - Advanced audit features
├── platform.multi_currency - Multi-currency support
├── platform.custom_fields  - Custom field definitions
└── platform.workflow       - Workflow automation

Module: loyalty (Future)
└── loyalty.points         - Loyalty point system

Module: hr (Future)
└── hr.employees           - Employee management
```

### Tier-Feature Mapping (Default)

| Feature | Free | Basic | Premium | Enterprise |
|---------|------|-------|---------|------------|
| **POS** |
| pos.terminal | ✅ | ✅ | ✅ | ✅ |
| pos.transactions | ✅ | ✅ | ✅ | ✅ |
| pos.shifts | ❌ | ✅ | ✅ | ✅ |
| **Inventory** |
| inventory.stock | ✅ | ✅ | ✅ | ✅ |
| inventory.adjustments | ❌ | ✅ | ✅ | ✅ |
| **Masterdata** |
| masterdata.items | ✅ | ✅ | ✅ | ✅ |
| masterdata.categories | ✅ | ✅ | ✅ | ✅ |
| masterdata.units | ✅ | ✅ | ✅ | ✅ |
| masterdata.warehouses | ❌ | ✅ | ✅ | ✅ |
| masterdata.suppliers | ❌ | ✅ | ✅ | ✅ |
| masterdata.customers | ✅ | ✅ | ✅ | ✅ |
| masterdata.price_levels | ❌ | ❌ | ✅ | ✅ |
| masterdata.discounts | ❌ | ✅ | ✅ | ✅ |
| masterdata.promotions | ❌ | ❌ | ✅ | ✅ |
| **Purchasing** |
| purchasing.orders | ❌ | ❌ | ✅ | ✅ |
| purchasing.receiving | ❌ | ❌ | ✅ | ✅ |
| **Reports** |
| reports.basic | ✅ | ✅ | ✅ | ✅ |
| reports.advanced | ❌ | ❌ | ✅ | ✅ |
| reports.export | ❌ | ✅ | ✅ | ✅ |
| **Platform** |
| platform.api_access | ❌ | ❌ | ✅ | ✅ |
| platform.integrations | ❌ | ❌ | ❌ | ✅ |
| platform.audit_advanced | ❌ | ❌ | ✅ | ✅ |
| platform.multi_currency | ❌ | ❌ | ❌ | ✅ |
| platform.custom_fields | ❌ | ❌ | ✅ | ✅ |
| platform.workflow | ❌ | ❌ | ❌ | ✅ |
| **Loyalty** |
| loyalty.points | ❌ | ❌ | ✅ | ✅ |
| **HR** |
| hr.employees | ❌ | ❌ | ✅ | ✅ |

---

## Implementation Plan

### Phase 1: Backend Foundation

#### 1.1 Feature Registry (`backend/app/core/features.py`)
```python
from enum import Enum
from typing import List, Dict, Set

class FeatureCode(str, Enum):
    # POS
    POS_TERMINAL = "pos.terminal"
    POS_TRANSACTIONS = "pos.transactions"
    POS_SHIFTS = "pos.shifts"
    # Inventory
    INVENTORY_STOCK = "inventory.stock"
    INVENTORY_ADJUSTMENTS = "inventory.adjustments"
    # Masterdata
    MASTERDATA_ITEMS = "masterdata.items"
    # ... etc

class FeatureModule(str, Enum):
    POS = "pos"
    INVENTORY = "inventory"
    MASTERDATA = "masterdata"
    PURCHASING = "purchasing"
    REPORTS = "reports"
    PLATFORM = "platform"
    LOYALTY = "loyalty"
    HR = "hr"

FEATURE_METADATA: Dict[str, dict] = {
    "pos.terminal": {
        "name": "POS Terminal",
        "description": "Point of Sale terminal interface",
        "module": "pos",
    },
    # ... etc
}

# Default tier-feature mapping
TIER_FEATURES: Dict[str, Set[str]] = {
    "free": {"pos.terminal", "pos.transactions", ...},
    "basic": {"pos.terminal", "pos.transactions", "pos.shifts", ...},
    "premium": {...},
    "enterprise": {...},
}
```

#### 1.2 Feature Service (`backend/app/services/feature_service.py`)
```python
class FeatureService:
    @staticmethod
    def get_tenant_features(db: Session, tenant: Tenant) -> Set[str]:
        """Get all enabled features for tenant (tier + overrides)"""

    @staticmethod
    def has_feature(db: Session, tenant: Tenant, feature_code: str) -> bool:
        """Check if tenant has access to feature"""

    @staticmethod
    def sync_features_from_tier(db: Session, tenant: Tenant) -> None:
        """Sync tenant features when tier changes"""
```

#### 1.3 Update deps.py
```python
def require_feature(feature_code: str):
    """Enhanced feature check using FeatureService"""
    def check(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
        if not FeatureService.has_feature(db, tenant, feature_code):
            raise HTTPException(403, f"Feature '{feature_code}' not available")
        return True
    return check
```

#### 1.4 Feature API Endpoints (`backend/app/api/v1/endpoints/features.py`)
- `GET /api/v1/features` - Get tenant's enabled features
- `GET /api/v1/features/check/{code}` - Check single feature
- `GET /api/v1/admin/features` - List all available features (admin)
- `GET /api/v1/admin/features/tiers` - Get tier-feature matrix (admin)
- `PUT /api/v1/admin/tiers/{id}/features` - Update tier features (admin)

#### 1.5 Update Tier Schema
- Change `features` from marketing strings to feature codes
- Add migration to convert existing data

### Phase 2: Frontend Implementation

#### 2.1 Feature Types (`frontend/src/types/features.ts`)
```typescript
export type FeatureCode =
  | 'pos.terminal'
  | 'pos.transactions'
  | 'pos.shifts'
  // ... etc

export interface FeatureMetadata {
  code: FeatureCode;
  name: string;
  description: string;
  module: string;
}
```

#### 2.2 Feature API (`frontend/src/lib/api/features.ts`)
```typescript
export const featuresAPI = {
  list: () => apiClient.get<string[]>('/features'),
  check: (code: string) => apiClient.get<boolean>(`/features/check/${code}`),
};
```

#### 2.3 Feature Hook (`frontend/src/hooks/use-feature.ts`)
```typescript
export function useFeature(code: FeatureCode): boolean
export function useFeatures(): string[]
export function useAnyFeature(codes: FeatureCode[]): boolean
export function useAllFeatures(codes: FeatureCode[]): boolean
```

#### 2.4 Feature Gate Component (`frontend/src/components/FeatureGate.tsx`)
```typescript
export function FeatureGate({ feature, children, fallback }: Props)
export function AnyFeatureGate({ features, children, fallback }: Props)
```

#### 2.5 Auth Store Update
- Add `features: string[]` to auth store
- Load features on login/refresh

### Phase 3: Admin UI Updates

#### 3.1 Tier Management Page
- Replace text-based features input with checkbox matrix
- Group features by module
- Show feature descriptions on hover

#### 3.2 Feature Matrix Page (new)
- Read-only view of all features and their tier availability
- Similar to permission matrix page

---

## Files to Create

| File | Purpose |
|------|---------|
| `backend/app/core/features.py` | Feature registry, codes, metadata, tier defaults |
| `backend/app/services/feature_service.py` | Feature checking logic |
| `backend/app/api/v1/endpoints/features.py` | Feature API endpoints |
| `backend/app/schemas/features.py` | Pydantic schemas for features |
| `frontend/src/types/features.ts` | TypeScript feature types |
| `frontend/src/lib/api/features.ts` | Feature API client |
| `frontend/src/hooks/use-feature.ts` | Feature checking hooks |
| `frontend/src/components/FeatureGate.tsx` | Feature gate components |

## Files to Modify

| File | Changes |
|------|---------|
| `backend/app/api/deps.py` | Enhance `require_feature()` |
| `backend/app/api/v1/router.py` | Add features router |
| `backend/app/services/subscription_tier_service.py` | Update DEFAULT_TIERS |
| `backend/app/schemas/subscription_tier.py` | Update features field type |
| `frontend/src/lib/store/authStore.ts` | Add features to store |
| `frontend/src/lib/api/auth.ts` | Load features on auth |
| `frontend/src/app/(auth)/admin/tiers/page.tsx` | Feature checkbox UI |

---

## Migration Strategy

1. **No schema changes** - `features` is already JSON
2. **Data migration** via seed script:
   - Convert marketing strings to feature codes
   - Set tier-feature mappings

---

## Usage Examples

### Backend: Protect an endpoint
```python
@router.get("/inventory/adjustments")
async def list_adjustments(
    _: bool = Depends(require_feature("inventory.adjustments")),
    tenant: Tenant = Depends(get_current_tenant),
):
    ...
```

### Frontend: Conditional rendering
```tsx
<FeatureGate feature="inventory.adjustments">
  <StockAdjustmentButton />
</FeatureGate>
```

### Frontend: Hook usage
```tsx
const canAdjustStock = useFeature('inventory.adjustments');
if (canAdjustStock) {
  // show UI
}
```
