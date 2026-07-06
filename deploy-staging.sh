#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== MURU Staging Deploy (backend only, NOT prod) ==="

# Prod-safety guard: refuse to run if ecosystem.staging.config.js was ever
# edited to target the production PM2 process name.
if ! grep -q "name: 'muru-backend-staging'" ecosystem.staging.config.js; then
  echo "ABORT: ecosystem.staging.config.js does not target 'muru-backend-staging'." >&2
  echo "Refusing to run — this guard exists to prevent accidentally reloading prod PM2 process 'muru-backend'." >&2
  exit 1
fi

echo "[1/2] Backend: install (with dev) -> build -> prod deps..."
cd backend
NODE_ENV=development npm ci
npm run build
npm ci --omit=dev
cd ..

mkdir -p logs

echo "[2/2] Starting/reloading PM2 staging process (muru-backend-staging only)..."
pm2 startOrReload ecosystem.staging.config.js --update-env
pm2 save

echo "=== Staging deploy complete ==="
echo "NOTE: frontend NOT built (staging = API only). Prod process 'muru-backend' was not touched by this script."
