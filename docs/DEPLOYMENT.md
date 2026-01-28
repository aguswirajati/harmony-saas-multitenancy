# Deployment Guide

> How to deploy Harmony SaaS to production using Docker Compose, Railway, or manual VPS.

---

## Option 1: Docker Compose (Recommended)

The simplest way to deploy — everything runs in containers.

### Prerequisites
- Server with Docker and Docker Compose installed
- Domain name pointed to your server
- At least 2GB RAM

### Steps

1. **Clone the repo on your server**:
   ```bash
   git clone https://github.com/your-org/harmony-saas.git
   cd harmony-saas
   ```

2. **Create production environment files**:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

3. **Edit `backend/.env`** with production values:
   ```env
   DATABASE_URL=postgresql://postgres:STRONG_PASSWORD_HERE@postgres:5432/saas_db
   SECRET_KEY=<generate with: openssl rand -hex 32>
   REDIS_URL=redis://redis:6379/0
   CORS_ORIGINS=["https://app.yourdomain.com"]
   FRONTEND_URL=https://app.yourdomain.com
   DEBUG=False
   MAIL_ENABLED=True
   MAIL_SERVER=smtp.your-provider.com
   MAIL_PORT=587
   MAIL_USERNAME=your-email
   MAIL_PASSWORD=your-password
   SENTRY_DSN=https://your-sentry-dsn
   SENTRY_ENVIRONMENT=production
   ```

4. **Edit `frontend/.env.local`**:
   ```env
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
   NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
   NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-sentry-dsn
   NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
   ```

5. **Build and start**:
   ```bash
   docker compose up -d --build
   ```

6. **Run database migrations**:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

7. **Create the first super admin**:
   ```bash
   docker compose exec backend python scripts/create_super_admin.py
   ```

8. **Set up a reverse proxy** (nginx) for SSL termination:

   ```nginx
   # /etc/nginx/sites-available/harmony
   server {
       listen 443 ssl;
       server_name api.yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }

   server {
       listen 443 ssl;
       server_name app.yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Then enable and get SSL:
   ```bash
   sudo ln -s /etc/nginx/sites-available/harmony /etc/nginx/sites-enabled/
   sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
   sudo nginx -t && sudo systemctl reload nginx
   ```

---

## Option 2: Railway

Railway provides managed PostgreSQL and Redis with zero-config deploys.

### Steps

1. **Create a Railway project** at [railway.app](https://railway.app)

2. **Add services**:
   - PostgreSQL (from Railway's template)
   - Redis (from Railway's template)
   - Backend (from GitHub repo, set root directory to `backend`)
   - Frontend (from GitHub repo, set root directory to `frontend`)

3. **Backend environment variables** (Railway dashboard):
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   SECRET_KEY=<generate with: openssl rand -hex 32>
   CORS_ORIGINS=["https://your-frontend.up.railway.app"]
   FRONTEND_URL=https://your-frontend.up.railway.app
   MAIL_ENABLED=False
   DEBUG=False
   ```

   Set the **start command** to:
   ```
   alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

4. **Frontend environment variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app/api/v1
   NEXT_PUBLIC_APP_URL=https://your-frontend.up.railway.app
   ```

5. **Deploy** — Railway auto-deploys on git push.

6. **Custom domains** — add via Railway dashboard, update CORS_ORIGINS accordingly.

---

## Option 3: Manual VPS (Ubuntu)

For full control over the infrastructure.

### Prerequisites
- Ubuntu 22.04+ server
- Python 3.10+, Node.js 20+
- PostgreSQL 15+, Redis 7+
- Nginx

### Steps

1. **Install system dependencies**:
   ```bash
   sudo apt update && sudo apt install -y python3.10 python3.10-venv python3-pip \
       nodejs npm postgresql redis-server nginx certbot python3-certbot-nginx
   ```

2. **Set up PostgreSQL**:
   ```bash
   sudo -u postgres psql -c "CREATE DATABASE saas_db;"
   sudo -u postgres psql -c "CREATE USER harmony WITH PASSWORD 'STRONG_PASSWORD';"
   sudo -u postgres psql -c "GRANT ALL ON DATABASE saas_db TO harmony;"
   ```

3. **Deploy backend**:
   ```bash
   cd /opt
   git clone https://github.com/your-org/harmony-saas.git
   cd harmony-saas/backend

   python3.10 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt

   cp .env.example .env
   # Edit .env with production values

   alembic upgrade head
   ```

4. **Create systemd service** for backend:
   ```ini
   # /etc/systemd/system/harmony-backend.service
   [Unit]
   Description=Harmony SaaS Backend
   After=network.target postgresql.service redis.service

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/harmony-saas/backend
   Environment=PATH=/opt/harmony-saas/backend/venv/bin
   ExecStart=/opt/harmony-saas/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl enable harmony-backend
   sudo systemctl start harmony-backend
   ```

5. **Deploy frontend**:
   ```bash
   cd /opt/harmony-saas/frontend
   cp .env.example .env.local
   # Edit .env.local with production values

   npm ci
   npm run build
   ```

6. **Create systemd service** for frontend:
   ```ini
   # /etc/systemd/system/harmony-frontend.service
   [Unit]
   Description=Harmony SaaS Frontend
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/harmony-saas/frontend
   ExecStart=/usr/bin/node /opt/harmony-saas/frontend/.next/standalone/server.js
   Environment=PORT=3000 HOSTNAME=127.0.0.1
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl enable harmony-frontend
   sudo systemctl start harmony-frontend
   ```

7. **Configure nginx** — same as the Docker option above, then get SSL with certbot.

---

## Post-Deployment Checklist

- [ ] `SECRET_KEY` is a strong random value (not the default)
- [ ] `DEBUG=False`
- [ ] `CORS_ORIGINS` only includes your frontend domain(s)
- [ ] `MAIL_ENABLED=True` with working SMTP credentials
- [ ] SSL/TLS configured (HTTPS only)
- [ ] Database backups scheduled (`scripts/backup.sh` via cron)
- [ ] Sentry DSN configured for error tracking
- [ ] Super admin user created
- [ ] Health check endpoint responding: `curl https://api.yourdomain.com/health`
- [ ] Firewall: only ports 80, 443 exposed; PostgreSQL/Redis not public

## Backup Cron

Add to `/etc/crontab` for daily backups at 2 AM:

```
0 2 * * * root cd /opt/harmony-saas && ./scripts/backup.sh >> /var/log/harmony-backup.log 2>&1
```
