# Dtico Dairy — System Architecture

Multi-tenant Dairy Management PWA. `backend/` is a Laravel REST API (MySQL/MariaDB).
`frontend/` is a React + Tailwind PWA. They communicate only over `/api/v1`.

## 1. High-level

```
┌──────────────────────── Browser / Installed PWA ────────────────────────┐
│ React UI ─ i18next (en/mr/hi) ─ Router ─ AuthContext ─ TenantSettings     │
│   │                                                                       │
│   ├─ services/api.js (axios, bearer token, error normalisation)           │
│   ├─ services/offlineQueue.js (IndexedDB queue, idempotent sync)          │
│   ├─ services/print/* (receipt model → HTML print | raster ESC/POS → BT)  │
│   └─ Service Worker (Workbox: app-shell precache, API network-first)      │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │ HTTPS  Authorization: Bearer <sanctum>
┌──────────────────────────────────▼────────────────────────────────────────┐
│ Laravel API  /api/v1                                                      │
│  Middleware: auth:sanctum → tenant.resolve → tenant.active → throttle     │
│  Controllers (thin) → FormRequests (validation) → Policies (authz)        │
│  Services: MilkEntryService, PricingService(strategies), BillingService,  │
│            PaymentService, LedgerService, ReportService, PdfService,      │
│            WhatsAppService(wa.me), ReceiptFormatter, AuditLogger        │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │
                           MySQL / MariaDB (single DB, row-level tenancy)
```

## 2. Multi-tenancy

* Shared database, **row-level isolation**: every tenant-owned table has `tenant_id` (FK, indexed,
  first column of every composite index).
* `App\Models\Concerns\BelongsToTenant` adds a global scope `where tenant_id = current tenant` and
  fills `tenant_id` on create. The current tenant comes **only** from the authenticated user
  (`TenantContext`), never from request input. `tenant_id` is not mass-assignable.
* Route-model binding goes through the scoped query, so `/customers/{id}` from tenant B returns 404.
* Super admin users have `tenant_id = NULL` and use the separate `/api/v1/admin/*` routes. No tenant scope
  is applied there (the scope is disabled because no tenant is set).
* A deactivated tenant is blocked by the `tenant.active` middleware.

## 3. Logins & permissions

**One login per dairy company.** It is created together with the company by the super admin
(`POST /admin/tenants`) and has full access to that company: role `admin`, all permissions. There
is no staff/user management inside a company. The super admin can change that login's mobile, email
and password, or block it (`GET|PUT /admin/tenants/{id}/login`). Changing the password or blocking
the login signs out every device.

Roles: `super_admin` (platform) and `admin` (the company login). The permission catalogue
(`config/dairy.php`) and `Gate::before` checks are kept, so restricted roles can be added later without
touching controllers. Policies still verify tenant ownership as a second line of defence.

## 4. Pricing (strategy pattern)

`milk_prices` rows are **effective-dated**, per session (`morning` | `evening` | `both`):
`method` = `fixed` (rate/L) or `fat` (rate = fat × `fat_rate`, optional `min_rate`).
`PricingService::resolve(date, session, fat)` picks the latest row with `effective_from <= date`
(a session-specific row beats `both`) and delegates to a `PricingStrategy`. Adding SNF/CLR charts later only
needs a new strategy class and a `method` value.

The applied `rate`, `rate_source` (`auto` | `manual`) and `amount` are **snapshotted on each milk entry**.
Later price changes never alter existing entries.

## 5. Milk entries & duplicate prevention

* Unique `(tenant_id, customer_id, entry_date, session)`: one entry per customer per session per day.
* Unique `(tenant_id, client_uuid)` makes offline sync idempotent. A replayed request returns the existing
  row (HTTP 200, `meta.duplicate_replay = true`).
* An entry linked to a non-cancelled bill (`bill_id`) is **locked** (no edit or delete).
* Deletes are hard deletes. The full snapshot is kept in `audit_logs`, so the unique key stays simple on
  MariaDB, which has no partial indexes.

## 6. Billing & ledger

* 10-day cycles: **1–10, 11–20, 21–end of month**. `BillingPeriod::forDate()` / `::previous()`.
* `BillingService::preview()` returns the computed bill without saving it. `generate()` runs in a transaction
  with row locks. It snapshots each entry into `bill_items`, links `milk_entries.bill_id`, and assigns a
  per-tenant sequential `bill_no` (`bill_sequences` row lock).
* Customer ledger (single source of truth):
  `balance = opening_balance + Σ(bill.total_amount − bill.discount, non-cancelled) − Σ(payments)`
* `bill.previous_balance` is the ledger balance just before the bill.
  `net_payable = previous_balance + total_amount − discount`, `outstanding = net_payable − paid_amount`.
* Generating a new bill **carries forward** older open bills (`carried_forward_to_id`), so outstanding
  amounts are never double counted.
* Status: `draft`, `generated`, `pending` (sent to the customer), `partially_paid`, `paid`, `cancelled`.
  Cancelling unlinks the entries so they can be billed again.

## 7. WhatsApp (no setup)

The server builds the message in the company's receipt language (bill messages include an expiring
signed link to the bill PDF) and returns a `https://wa.me/<phone>?text=…` link. The app opens WhatsApp
on the phone with the message ready, and the user taps Send. No WhatsApp Business account, API key or
background queue is needed. When offline, the app builds the same link on the phone. Each send is
recorded in `whatsapp_logs`.

## 8. Printing (58 mm)

The frontend builds a **receipt document model** (lines with align, bold and size) from the entry or bill.
The user picks one of two printers:
* **Normal print** renders a dedicated 58/80 mm HTML page (`@page { size: 58mm auto }`) in a hidden
  iframe and opens the phone or computer print dialog, so any installed printer works.
* **Bluetooth printer** draws the receipt on a 384-dot canvas (58 mm @ 203 dpi), applies a threshold,
  and sends ESC/POS `GS v 0` raster bytes over Web Bluetooth. Because the text is drawn as an image,
  Marathi and Hindi print correctly on any cheap thermal printer.
Every print is recorded in `print_logs`.

## 9. Offline

* Workbox precaches the app shell. GET requests for customers and prices are network-first, with an
  IndexedDB mirror for offline customer search.
* Milk entries saved offline go into an IndexedDB queue with a `client_uuid`. They sync on `online`, on app
  start, and when the user taps sync. Server idempotency (§5) prevents duplicates.

## 10. Security

Sanctum bearer tokens (hashed, expiring), bcrypt passwords, login throttle (5/min per IP+mobile), API
throttle (120/min per user), FormRequest validation everywhere, Eloquent bindings (no raw input in SQL),
React escaping (no `dangerouslySetInnerHTML` for user data), a JSON exception renderer that maps DB and authz
errors to friendly translated messages (no `SQLSTATE` leaks), and an audit log of every mutation.

## 11. Database (main tables)

`tenants, users, roles, permissions, permission_role, customers, milk_prices, milk_entries, bills,
bill_items, bill_sequences, payments, whatsapp_logs, print_logs, notifications, settings, languages,
audit_logs, personal_access_tokens, jobs`. See `backend/database/migrations`.

Hot-path indexes: `milk_entries(tenant_id, entry_date, session)`, `(tenant_id, customer_id, entry_date)`,
`customers(tenant_id, mobile)`, `(tenant_id, code)`, `(tenant_id, status, name)`,
`bills(tenant_id, customer_id, period_start)`, `(tenant_id, status, bill_date)`,
`payments(tenant_id, customer_id, payment_date)`.
