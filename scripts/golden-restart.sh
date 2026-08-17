#!/usr/bin/env bash
set -euo pipefail

MURU_ROOT="${MURU_ROOT:-/var/www/muru}"

echo "=== MURU golden restart ==="
echo "[1/7] cd $MURU_ROOT/backend"
cd "$MURU_ROOT/backend"

echo "[2/7] export all keys from ../.env"
eval "$(node -e 'const d=require("dotenv");const r=d.parse(require("fs").readFileSync("../.env"));for(const[k,v]of Object.entries(r))process.stdout.write("export "+k+"="+JSON.stringify(v??"")+"\n")')"

echo "[3/7] sanity (set|MISSING, no values)"
for key in PORT CATALOG_SOURCE TELEGRAM_PROVIDER_TOKEN CDEK_CLIENT_ID JWT_SECRET ADMIN_TELEGRAM_IDS; do
  if [ -n "${!key:-}" ]; then
    echo "  $key=set"
  else
    echo "  $key=MISSING"
  fi
done

echo "[4/7] pm2 delete + start --update-env + save"
cd "$MURU_ROOT"
pm2 delete muru-backend || true
pm2 start ecosystem.config.js --update-env
pm2 save

echo "[5/7] sleep 3"
sleep 3

echo "[6/7] curl health"
curl -sS http://127.0.0.1:4000/api/health

echo
echo "[7/7] recent logs (Listening / injected env / env-check)"
pm2 logs muru-backend --lines 15 --nostream | grep -iE 'Listening|injected env|\[env-check\]' || true

echo "=== golden restart complete ==="
