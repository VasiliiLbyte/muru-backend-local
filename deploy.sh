#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== MURU Deploy ==="

echo "[1/4] Backend: install (with dev) -> build -> prod deps..."
cd backend
NODE_ENV=development npm ci
npm run build
npm ci --omit=dev
cd ..

echo "[2/4] Frontend: install (with dev) -> build..."
cd frontend
NODE_ENV=development rm -rf node_modules
NODE_ENV=development npm install
npm run build
cd ..

echo "[3/4] Admin panel: install (with dev) -> build..."
cd admin
NODE_ENV=development rm -rf node_modules
NODE_ENV=development npm install
npm run build
cd ..

echo "[4/4] Restarting PM2..."
pm2 reload ecosystem.config.js --update-env
pm2 save

injected_count=$(pm2 logs muru-backend --lines 25 --nostream 2>/dev/null | grep -oP 'injected env \(\K[0-9]+' | head -1 || true)
if [ -n "${injected_count:-}" ] && [ "$injected_count" -lt 40 ]; then
  echo "WARN: injected env ($injected_count) < 40 — возможен stale PM2 env — запусти scripts/golden-restart.sh"
fi

echo "=== Deploy complete ==="
