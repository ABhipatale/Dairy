# Dtico Dairy — Multi-Tenant Dairy Management PWA

Milk collection (morning/evening, FAT, dynamic rates), 10-day billing, payments, 58 mm thermal
receipts, WhatsApp, PDF invoices, reports, English/मराठी/हिंदी, and offline milk entry.
One installation serves many dairy companies with complete data isolation.

| | |
|---|---|
| `backend/` | Laravel 12 REST API (`/api/v1`), MySQL/MariaDB, Sanctum, mPDF, OpenSpout |
| `frontend/` | React 19 + Tailwind 4 PWA (Vite, Workbox, IndexedDB) |
| `docs/ARCHITECTURE.md` | Tenancy, pricing, billing/ledger, printing, offline, and security design |

## Run locally

Requirements: PHP 8.2+ (bcmath, gd, mbstring, pdo_mysql), Composer, Node 20+, MySQL 8 / MariaDB 10.4+.

```bash
# API
cd backend
cp .env.example .env          # set DB_* (database: dtico_dairy)
composer install
php artisan key:generate
php artisan migrate --seed    # roles, languages, super admin + 2 demo dairies (non-production)
php artisan storage:link
php artisan serve --port=8010 # set PHP_CLI_SERVER_WORKERS=6 in .env for parallel requests

# PWA
cd frontend
npm install
npm run dev                   # http://localhost:5173 (API proxied to :8010)
```

Demo logins (password in brackets):

| Role | Mobile |
|---|---|
| Super admin (creates companies) | 9000000000 (`Admin@123`) |
| Shree Dairy | 9876543210 (`Password@123`) |
| Gokul Milk Centre | 9876500000 (`Password@123`) |

Each dairy company has **one login** with full access. The super admin creates the company
together with that login, and can later change its mobile/password or block it.

## Tests

```bash
cd backend && php artisan test     # needs a database named dtico_dairy_test (see phpunit.xml)
cd frontend && npx oxlint src && npm run build
```

The 58 feature/unit tests cover auth, tenant isolation, milk entry (sessions, rates, FAT,
duplicate and offline-replay prevention), billing (10-day periods, carry-forward, payments,
cancel), reports, PDF, XLSX and WhatsApp links.

## Production

Step-by-step server setup (nginx, HTTPS, cron, backups) is in
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. Updates: `git pull && ./deploy/deploy.sh`.
Production seeding creates no demo data and no default password. Create the platform owner with
`php artisan dairy:super-admin`.
