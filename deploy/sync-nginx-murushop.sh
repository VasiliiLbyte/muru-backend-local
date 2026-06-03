#!/bin/bash
# Sync deploy/nginx-murushop.online.conf → /etc/nginx/sites-available/murushop.online
# Run on VPS from repo root: sudo bash deploy/sync-nginx-murushop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/deploy/nginx-murushop.online.conf"
TARGET="/etc/nginx/sites-available/murushop.online"
ENABLED="/etc/nginx/sites-enabled/murushop.online"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/sync-nginx-murushop.sh"
  exit 1
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing $SOURCE"
  exit 1
fi

if [[ -f "$TARGET" ]]; then
  cp -a "$TARGET" "${TARGET}.bak.$(date +%Y%m%d%H%M%S)"
  echo "Backup: ${TARGET}.bak.*"
fi

cp "$SOURCE" "$TARGET"
ln -sf "$TARGET" "$ENABLED"

nginx -t
systemctl reload nginx

echo "OK: nginx synced. Verify webhook:"
echo "  curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://murushop.online/yookassa-webhook -H 'Content-Type: application/json' -d '{}'"
