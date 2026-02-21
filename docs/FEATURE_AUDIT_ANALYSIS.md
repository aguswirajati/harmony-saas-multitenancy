# Feature Flag & Licensing System - Audit Analysis

> **Importance:** HIGH
> **Status:** WAITING DECISION
> **Requires:** Further discussion before implementation
> **Date:** 2026-02-21

---

## Context

This audit was performed based on [`FEATURE_FLAG_LICENSING_GUIDE.md`](./FEATURE_FLAG_LICENSING_GUIDE.md) which outlines a 3-tier distribution strategy:

| Tier | Model | Target |
|------|-------|--------|
| `free` | Local executable, gratis 6-12 bulan | Early adopter, validasi pasar |
| `pro` | One-time purchase, lokal/private server | Multi-branch, kumpulkan modal |
| `cloud` | Subscription bulanan/tahunan | Skala penuh, managed service |

---

## Audit Results

### Backend (FastAPI + SQLAlchemy + PostgreSQL)

| Item | Finding |
|------|---------|
| **Framework** | FastAPI + SQLAlchemy + PostgreSQL |
| **Auth Middleware** | Yes - JWT-based with `get_current_user()`, `get_current_tenant()` dependencies |
| **Feature-related files** | `app/core/features.py`, `app/services/feature_service.py`, `app/api/v1/endpoints/features.py` |
| **License-related files** | None (not yet implemented) |
| **Tier-related files** | `app/models/subscription_tier.py`, `app/services/subscription_tier_service.py` |
| **Tenant model** | `app/models/tenant.py` - has `tier` (string) and `features` (JSON) fields |

**Existing Database Tables:**
- `subscription_tiers` - Stores tier configs (code, features list, limits, pricing)
- `tenants` - Has `tier` field linking to tier code, `features` for overrides
- No `tenant_licenses` table
- No separate `features` master table

### Frontend (Next.js App Router)

| Item | Finding |
|------|---------|
| **Router Type** | Next.js App Router (`/app` directory) |
| **Auth Context** | Zustand store (`authStore.ts`) with `features: string[]` |
| **Feature Hooks** | `useFeature()`, `useFeatures()`, `useAnyFeature()`, `useAllFeatures()` in `hooks/use-feature.ts` |
| **Feature Components** | `FeatureGate`, `AnyFeatureGate`, `AllFeaturesGate` in `components/FeatureGate.tsx` |
| **Session Data** | API call to `/api/v1/features/enabled` on login, stored in localStorage |

### Feature Flag System Comparison

| Aspect | Current State | Guide Requirement |
|--------|---------------|-------------------|
| **Feature Storage** | JSON array in `subscription_tiers.features` | Separate `features` table |
| **Tier Assignment** | `tenant.tier` string field | `tenant_licenses` table with license_key, expires_at |
| **Feature Overrides** | `tenant.features` JSON `{enabled: [], disabled: []}` | `tenant_feature_overrides` table |
| **Feature Checker** | `FeatureService.has_feature()` | `is_feature_enabled()` ✓ |
| **Endpoint Decorator** | `require_feature()` dependency | `require_feature()` ✓ |
| **License Key System** | Not implemented | Required for free/pro tiers |
| **Activation Endpoint** | Not implemented | `POST /api/license/activate` required |

---

## Gap Analysis

### What's Already Built (Can Keep)

1. ✅ Feature registry with 38+ features across 8 modules (`app/core/features.py`)
2. ✅ Tier-feature mapping in `subscription_tiers` table
3. ✅ `require_feature()` backend dependency (`app/api/deps.py`)
4. ✅ `FeatureGate` frontend component (`components/FeatureGate.tsx`)
5. ✅ Feature hooks (`useFeature`, `useAnyFeature`, `useAllFeatures`)
6. ✅ Override mechanism via `tenant.features` JSON

### What's Missing (Must Add for Local Distribution)

1. ❌ **License Key System** - No license key generation, validation, or activation
2. ❌ **`tenant_licenses` Table** - For tracking license_key, tier, activated_at, expires_at
3. ❌ **Activation Endpoint** - `POST /api/license/activate`
4. ❌ **License Status Endpoint** - `GET /api/license/status`
5. ❌ **Offline Validation** - For local installations (free/pro tiers)

---

## Decision Options

### Option A: Full Migration (Match Guide Exactly)

**Changes Required:**
- Create `features` master table
- Create `tenant_licenses` table
- Create `tenant_feature_overrides` table
- Migrate data from `subscription_tiers.features` JSON
- Update all feature checking logic

**Pros:**
- Normalized database design
- Matches guide specification exactly
- Easier to query individual features

**Cons:**
- Significant refactor effort
- Migration complexity
- Current system already working

### Option B: Extend Current System

**Changes Required:**
- Add `tenant_licenses` table only
- Add license activation endpoints
- Keep `subscription_tiers.features` JSON approach

**Pros:**
- Minimal changes to working code
- Lower risk of regression
- Faster to implement

**Cons:**
- Slight deviation from guide
- Features still in JSON (less normalized)

### Option C: Hybrid Approach (Recommended)

**Changes Required:**
- Keep current `subscription_tiers.features` JSON (it works)
- Add `tenant_licenses` table for license key management
- Add license activation/validation endpoints
- No separate `features` master table needed

**Pros:**
- Best of both worlds
- Adds licensing without breaking existing code
- Tier config already serves as feature master

**Cons:**
- None significant

---

## Current Decision

**Decision:** Keep current architecture for now, test in business feature development.

**Rationale:** The existing feature flag system is functional and comprehensive. License key system can be added later when preparing for local distribution (free/pro tiers).

**Next Steps:**
1. Test current feature flag system with business features (POS, Inventory, etc.)
2. Revisit licensing implementation when approaching local distribution phase
3. Consider Option C (Hybrid) when implementing license keys

---

## Related Files

### Backend
- `backend/app/core/features.py` - Feature registry and tier mappings
- `backend/app/services/feature_service.py` - Feature checking logic
- `backend/app/api/deps.py` - `require_feature()` dependency
- `backend/app/models/subscription_tier.py` - Tier model with features
- `backend/app/services/subscription_tier_service.py` - Tier CRUD

### Frontend
- `frontend/src/hooks/use-feature.ts` - Feature checking hooks
- `frontend/src/components/FeatureGate.tsx` - Feature gate components
- `frontend/src/lib/store/authStore.ts` - Features in auth state
- `frontend/src/types/features.ts` - Feature type definitions

---

*This document will be updated when a final decision is made on the licensing architecture.*
