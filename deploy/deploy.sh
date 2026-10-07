#!/usr/bin/env bash
# Update a running server to the latest code. Run from /var/www/dtico as the deploy user.
#   ./deploy/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "→ Backend dependencies"
cd backend
composer install --no-dev --optimize-autoloader --no-interaction

echo "→ Maintenance mode"
php artisan down --retry=15 || true

echo "→ Database"
php artisan migrate --force
php artisan db:seed --class=RolesAndPermissionsSeeder --force   # idempotent
php artisan db:seed --class=LanguageSeeder --force             # idempotent

echo "→ Caches"
php artisan storage:link 2>/dev/null || true
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

echo "→ Frontend build"
cd ../frontend
npm ci --no-audit --no-fund
npm run build

cd ../backend
php artisan up

echo "✓ Deployed"
