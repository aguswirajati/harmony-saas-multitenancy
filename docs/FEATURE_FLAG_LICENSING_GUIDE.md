# Claude CLI Guidance: Feature Flag + Licensing System
> Baca seluruh dokumen ini sebelum melakukan perubahan apapun pada codebase.

---

## 1. KONTEKS & TUJUAN

Project ini adalah **SaaS Multi-Tenant ERP/POS** yang akan didistribusikan dalam 3 tier:

| Tier | Model Distribusi | Target |
|------|-----------------|--------|
| `free` | Executable lokal, gratis 6-12 bulan | Early adopter, validasi pasar |
| `pro` | One-time purchase, lokal/private server | Multi-branch, kumpulkan modal |
| `cloud` | Subscription bulanan/tahunan | Skala penuh, managed service |

**Prinsip utama:**
- User pada tier tertentu TIDAK bisa upgrade fitur sendiri — harus beli tier berikutnya
- Gating harus terjadi di **backend (source of truth)** dan **frontend (UX)**
- Arsitektur harus fleksibel untuk ditambah fitur baru tanpa refactor besar

---

## 2. AUDIT YANG HARUS DILAKUKAN PERTAMA

Sebelum menulis kode apapun, lakukan audit berikut dan laporkan hasilnya:

### 2a. Audit Backend
```
- Temukan semua file yang berkaitan dengan "feature", "flag", "license", "permission", "tier"
- Identifikasi apakah sudah ada tabel database untuk licensing/feature
- Temukan struktur tenant/organization model
- Identifikasi framework: FastAPI atau Django?
- Cek apakah sudah ada middleware auth
```

### 2b. Audit Frontend
```
- Identifikasi apakah menggunakan Next.js App Router (/app directory) atau Pages Router (/pages directory)
- Temukan semua komponen yang menampilkan fitur premium (jika ada)
- Cek apakah ada context/provider untuk auth atau permission
- Temukan cara frontend saat ini mengambil data user/session
```

### 2c. Audit Existing Feature Flag
```
- Temukan config file .py yang berisi feature flag
- Evaluasi: apakah berbasis hardcoded list, database, atau environment variable?
- Tentukan apakah perlu migrasi ke database model (rekomendasikan jika hardcoded)
- Laporkan gap: apa yang belum ada dari sistem yang dibutuhkan
```

**Laporkan hasil audit dalam format ringkas sebelum lanjut ke implementasi.**

---

## 3. ARSITEKTUR TARGET

### 3a. Database Model (PostgreSQL + SQLAlchemy)

Ini adalah **source of truth** untuk licensing. Lebih fleksibel dari config file karena bisa diubah tanpa deploy ulang.

```python
# Struktur tabel yang harus ada:

# 1. features — master daftar semua fitur
# columns: id, key (str, unique), name, description, tier_minimum (free/pro/cloud)

# 2. tenant_licenses — lisensi per tenant
# columns: id, tenant_id (FK), tier (free/pro/cloud), license_key, 
#          activated_at, expires_at (null = lifetime), is_active

# 3. tenant_feature_overrides (opsional, untuk kasus khusus)
# columns: id, tenant_id, feature_key, is_enabled
#          (override default tier — misal: berikan akses pro ke tenant tertentu secara manual)
```

**Jika saat ini masih config file .py:** buat migration Alembic untuk tabel di atas, lalu migrate data dari config file ke database.

### 3b. Backend: Feature Checker Service

```python
# Lokasi: app/services/feature_service.py (atau sesuaikan dengan struktur existing)

# Fungsi utama yang harus ada:
# - get_tenant_tier(tenant_id) -> "free" | "pro" | "cloud"
# - is_feature_enabled(tenant_id, feature_key) -> bool
# - get_enabled_features(tenant_id) -> list[str]
# - require_feature(feature_key) -> FastAPI dependency / Django decorator
```

### 3c. Backend: Middleware/Decorator

Setiap endpoint yang di-gate harus menggunakan decorator/dependency, bukan manual check di dalam fungsi.

```python
# Contoh penggunaan yang diinginkan (FastAPI):
@router.get("/branches")
@require_feature("multi_branch")  # <-- cukup ini
async def get_branches(tenant=Depends(get_current_tenant)):
    ...

# Contoh penggunaan yang diinginkan (Django):
@feature_required("multi_branch")
def branches_view(request):
    ...
```

### 3d. Frontend: Feature Gate Component

```typescript
// Komponen wrapper yang menyembunyikan/menonaktifkan UI berdasarkan tier
// Lokasi: components/FeatureGate.tsx

// Penggunaan yang diinginkan:
<FeatureGate feature="multi_branch" fallback={<UpgradePrompt />}>
  <BranchManagement />
</FeatureGate>
```

Frontend harus mengambil daftar fitur yang aktif dari API, bukan hardcode di client.

---

## 4. DEFINISI TIER & FITUR

Gunakan ini sebagai referensi untuk mengisi tabel `features`. Sesuaikan dengan fitur yang sudah ada di codebase.

```python
FEATURE_TIERS = {
    # FREE TIER
    "pos_basic":              "free",   # Transaksi POS single kasir
    "inventory_single":       "free",   # Manajemen stok single gudang
    "customer_basic":         "free",   # Data pelanggan dasar
    "report_daily_basic":     "free",   # Laporan harian sederhana
    "supplier_basic":         "free",   # Data supplier

    # PRO TIER
    "pos_advanced":           "pro",    # Diskon, promo, multi-payment
    "inventory_multi":        "pro",    # Multi gudang
    "multi_branch":           "pro",    # Manajemen multi cabang ← KEY DIFFERENTIATOR
    "report_advanced":        "pro",    # Laporan laba rugi, neraca
    "report_export":          "pro",    # Export PDF/Excel
    "accounting_basic":       "pro",    # Jurnal, chart of accounts
    "hr_basic":               "pro",    # Data karyawan, absensi
    "purchase_order":         "pro",    # PO ke supplier
    "inter_branch_transfer":  "pro",    # Transfer stok antar cabang

    # CLOUD TIER
    "api_access":             "cloud",  # REST API untuk integrasi
    "advanced_analytics":     "cloud",  # Dashboard analytics
    "custom_report":          "cloud",  # Report builder
    "multi_user_role":        "cloud",  # Role management detail
    "audit_log":              "cloud",  # Log aktivitas lengkap
    "webhook":                "cloud",  # Webhook / integrasi eksternal
    "white_label":            "cloud",  # Custom branding
}
```

**Tambahkan fitur lain yang sudah ada di codebase ke daftar ini, tentukan tier-nya.**

---

## 5. LICENSE KEY SYSTEM

### Fase saat ini (simple): Activation via License Key

```
Format license key: TIER-XXXXX-XXXXX-XXXXX
Contoh: FREE-A1B2C-D3E4F-G5H6I
        PRO-A1B2C-D3E4F-G5H6I
```

**Untuk instalasi lokal (free & pro):**
- License key di-generate oleh developer (kamu) secara manual atau via script
- Validasi: cek format + tier prefix + checksum sederhana
- Aktivasi membutuhkan koneksi internet 1x (panggil endpoint aktivasi)
- Setelah aktif, simpan di database lokal — tidak perlu online terus

**Untuk cloud:**
- License dikelola otomatis saat user subscribe

### Endpoint yang harus dibuat:
```
POST /api/license/activate   — input: license_key, output: tier + expires_at
GET  /api/license/status     — cek status lisensi aktif
GET  /api/features/enabled   — return list fitur yang aktif untuk tenant ini
```

---

## 6. URUTAN IMPLEMENTASI

Lakukan dalam urutan ini, **jangan loncat**:

```
Step 1: Audit & laporan (Section 2)
Step 2: Buat/migrasi database model (Section 3a)
Step 3: Seed data features dari FEATURE_TIERS (Section 4)
Step 4: Buat FeatureService backend (Section 3b)
Step 5: Buat decorator/dependency untuk endpoint (Section 3c)
Step 6: Buat endpoint license (Section 5)
Step 7: Buat API endpoint GET /api/features/enabled
Step 8: Buat FeatureGate component di frontend (Section 3d)
Step 9: Integrasikan FeatureGate ke halaman/komponen yang relevan
Step 10: Testing: simulasi login sebagai tenant free, pro, cloud
```

---

## 7. TESTING CHECKLIST

Setelah implementasi, verifikasi:

- [ ] Tenant dengan tier `free` tidak bisa akses endpoint `multi_branch`
- [ ] Tenant dengan tier `free` tidak melihat menu multi-branch di UI
- [ ] Tenant dengan tier `pro` bisa akses semua fitur pro
- [ ] Upgrade tier (ubah di DB) langsung berlaku tanpa restart
- [ ] License key invalid ditolak dengan pesan jelas
- [ ] `GET /api/features/enabled` return list yang benar per tier

---

## 8. CATATAN PENTING

- **Jangan hapus config file .py lama** sebelum migrasi selesai dan terverifikasi
- **Gunakan Alembic** untuk semua perubahan schema database
- **Jangan hardcode tier check** di dalam business logic — selalu gunakan `is_feature_enabled()`
- Frontend hanya untuk UX — **backend adalah satu-satunya enforcement yang valid**
- Jika ada fitur yang belum jelas masuk tier mana, tanyakan sebelum assign

---

## 9. OUTPUT YANG DIHARAPKAN

Setelah selesai, developer (non-teknis) harus bisa:
1. Menambah fitur baru cukup dengan: tambah row di tabel `features` + pasang decorator di endpoint baru
2. Memberikan akses khusus ke tenant tertentu via `tenant_feature_overrides`
3. Melihat semua fitur per tier dari database — tidak perlu baca kode

---

*Dokumen ini dibuat berdasarkan diskusi strategi bisnis & teknis. Update sesuai kondisi codebase aktual.*
