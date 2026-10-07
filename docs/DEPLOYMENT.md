# Deploying Dtico Dairy

Target: one Ubuntu 22.04/24.04 server (2 GB RAM is enough for dozens of dairies), one domain,
HTTPS. The PWA and API share the domain, so there is no CORS setup.

## 1. Install the server packages

```bash
sudo apt update
sudo apt install -y nginx mysql-server git unzip \
  php8.2-fpm php8.2-cli php8.2-mysql php8.2-mbstring php8.2-xml php8.2-bcmath php8.2-gd php8.2-zip php8.2-curl
# Composer: https://getcomposer.org/download/   Node 20+: https://github.com/nodesource/distributions
```

## 2. Create the database

```sql
CREATE DATABASE dtico_dairy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dtico'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL ON dtico_dairy.* TO 'dtico'@'localhost';
```

## 3. Install the code

```bash
sudo mkdir -p /var/www/dtico && sudo chown $USER:www-data /var/www/dtico
git clone <your-repo> /var/www/dtico && cd /var/www/dtico

cp backend/.env.production.example backend/.env   # edit APP_URL, DB_PASSWORD
cd backend && composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force          # roles + languages only (no demo data in production)
php artisan dairy:super-admin        # asks for mobile + password of the platform owner
cd ..

sudo chown -R www-data:www-data backend/storage backend/bootstrap/cache
chmod +x deploy/deploy.sh && ./deploy/deploy.sh   # builds the PWA, caches config
```

## 4. Web server, HTTPS, daily cleanup

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/dtico      # set server_name
sudo ln -s /etc/nginx/sites-available/dtico /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d dairy.example.com                         # HTTPS is required

( crontab -l 2>/dev/null; echo "* * * * * cd /var/www/dtico/backend && php artisan schedule:run >> /dev/null 2>&1" ) | crontab -
```

HTTPS is mandatory: phones only install the app, work offline, and connect to Bluetooth
printers on secure origins.

## 5. Add the first dairy

Log in at `https://dairy.example.com` with the super admin. Go to **Companies → Add Company**, which
creates the company and its single login. Give the dairy that mobile number and password. On their
phone they open the site and choose *Add to Home screen* / *Install*.

## Updating

```bash
cd /var/www/dtico && git pull && ./deploy/deploy.sh
```

Open apps show "A new version is available → Update". Entries saved offline stay on the phone and
sync after the update.

## Backups

```bash
# /etc/cron.daily/dtico-backup
mysqldump --single-transaction dtico_dairy | gzip > /var/backups/dtico-$(date +%F).sql.gz
tar czf /var/backups/dtico-logos-$(date +%F).tgz -C /var/www/dtico/backend/storage/app public
find /var/backups -name 'dtico-*' -mtime +30 -delete
```

Copy backups off the server, for example to object storage.

## Health checks

* `GET /up` returns 200 when Laravel is running (for uptime monitors).
* Logs: `backend/storage/logs/laravel-YYYY-MM-DD.log`.
