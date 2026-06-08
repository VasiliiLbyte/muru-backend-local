#!/bin/bash
# Sync deploy/nginx-murushop.{ru,online}.conf → /etc/nginx/sites-available/
# Run on VPS from repo root: sudo bash deploy/sync-nginx-murushop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sync_site() {
  local name="$1"
  local source="$ROOT/deploy/nginx-murushop.${name}.conf"
  local target="/etc/nginx/sites-available/murushop.${name}"
  local enabled="/etc/nginx/sites-enabled/murushop.${name}"

  if [[ ! -f "$source" ]]; then
    echo "Missing $source"
    exit 1
  fi

  if [[ -f "$target" ]]; then
    cp -a "$target" "${target}.bak.$(date +%Y%m%d%H%M%S)"
    echo "Backup: ${target}.bak.*"
  fi

  cp "$source" "$target"
  ln -sf "$target" "$enabled"
  echo "Synced: $target"
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/sync-nginx-murushop.sh"
  exit 1
fi

sync_site ru
sync_site online

nginx -t
systemctl reload nginx

echo ""
echo "OK: nginx synced (.ru site + .online redirect)."
echo "Verify:"
echo "  curl -sSI https://murushop.ru/api/health | head -3"
echo "  curl -sSI https://murushop.online/catalog | grep -i location"
echo "  curl -sS -o /dev/null -w 'webhook %{http_code}\n' -X POST https://murushop.ru/yookassa-webhook -H 'Content-Type: application/json' -d '{}'"
