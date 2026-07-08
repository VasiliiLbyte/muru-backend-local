#!/bin/bash
# B6 prod deploy — run on VPS as root from /var/www/muru after git pull.
# Usage: cd /var/www/muru && git fetch origin && git reset --hard origin/master && sudo bash deploy/b6-prod-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== B6 prod deploy (DEP-010) ==="
echo "Repo: $ROOT"

echo ""
echo "--- PM2 baseline ---"
pm2 show muru-backend | grep -E 'restart time|status|uptime' || true
RESTARTS_BEFORE="$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((p['pm2_env'].get('restart_time',0) for p in d if p.get('name')=='muru-backend'),0))" 2>/dev/null || echo "?")"
echo "restart_time before: $RESTARTS_BEFORE"

if ! grep -q '^ADMIN_JWT_SECRET=.\{32,\}' backend/.env 2>/dev/null; then
  echo "ERROR: ADMIN_JWT_SECRET missing or too short in backend/.env — fix before deploy"
  exit 1
fi

echo ""
echo "--- [1/4] Migration 017 on prod DB (before code deploy) ---"
DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2-)"
psql "$DB_URL" -f backend/src/db/migrations/017_content.sql
psql "$DB_URL" -c "\dt public.content_*"

echo ""
echo "--- [2/4] Uploads directory ---"
PM2_PID="$(pm2 pid muru-backend 2>/dev/null | head -1 || true)"
if [[ -n "$PM2_PID" && "$PM2_PID" != "0" ]]; then
  PM2_USER="$(ps -o user= -p "$PM2_PID" | tr -d ' ')"
else
  PM2_USER="$(whoami)"
fi
mkdir -p /var/www/muru/uploads
chown "$PM2_USER:$PM2_USER" /var/www/muru/uploads
chmod 755 /var/www/muru/uploads
echo "uploads owner: $PM2_USER"

if ! grep -q '^UPLOADS_DIR=' backend/.env 2>/dev/null; then
  echo "NOTE: UPLOADS_DIR not set — backend defaults to /var/www/muru/uploads in production"
fi

echo ""
echo "--- [3/4] deploy.sh (backend + frontend + admin) ---"
bash deploy.sh

echo ""
echo "--- [4/4] nginx sync (/uploads/ + client_max_body_size) ---"
bash deploy/sync-nginx-murushop.sh

RESTARTS_AFTER="$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((p['pm2_env'].get('restart_time',0) for p in d if p.get('name')=='muru-backend'),0))" 2>/dev/null || echo "?")"
echo ""
echo "--- PM2 after deploy ---"
pm2 show muru-backend | grep -E 'restart time|status|uptime' || true
echo "restart_time before: $RESTARTS_BEFORE → after: $RESTARTS_AFTER"

echo ""
echo "--- Quick health ---"
curl -sS -o /dev/null -w "health HTTP %{http_code}\n" https://murushop.ru/api/health

echo ""
echo "=== B6 deploy complete. Run: bash deploy/b6-prod-smoke.sh ==="
