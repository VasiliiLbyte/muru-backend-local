#!/bin/bash
# B6 storefront deploy — run on VPS after backend smoke OK.
set -euo pipefail

STOREFRONT_DIR="${STOREFRONT_DIR:-/var/www/muru-storefront}"
cd "$STOREFRONT_DIR"

echo "=== B6 storefront deploy (web.murushop.ru) ==="
git pull origin main

if grep -q 'api-staging' .env.production 2>/dev/null; then
  echo "WARNING: .env.production points to staging API — should be https://murushop.ru/api for prod content"
fi

npm ci
NODE_OPTIONS=--max-old-space-size=2048 npm run build
npm ci --omit=dev
pm2 restart muru-storefront
pm2 save

for path in / /landings/ /company/; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "https://web.murushop.ru$path")"
  echo "https://web.murushop.ru$path → $code"
done

echo "=== Storefront deploy complete ==="
