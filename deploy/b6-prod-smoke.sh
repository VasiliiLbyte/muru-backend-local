#!/bin/bash
# B6 prod smoke — run on VPS or any host with curl after deploy.
# Requires: ADMIN_EMAIL, ADMIN_PASSWORD (prod owner from A6 seed).
set -euo pipefail

BASE="${BASE:-https://murushop.ru}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/b6-cookies.txt}"
TEST_IMG="${TEST_IMG:-/tmp/b6-test.png}"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@muru.ru}"
if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "ERROR: set ADMIN_PASSWORD env var (prod admin seed password)"
  exit 1
fi

python3 - "$TEST_IMG" <<'PY'
import base64, pathlib, sys
pathlib.Path(sys.argv[1]).write_bytes(base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
))
PY

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

check_code() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label (HTTP $actual)"
  else
    fail "$label expected $expected got $actual"
  fi
}

echo "=== B6 prod smoke ==="
echo "BASE=$BASE"

# 1 login
LOGIN_CODE="$(curl -sS -c "$COOKIE_JAR" -o /tmp/b6-login.json -w "%{http_code}" \
  -X POST "$BASE/api/admin-auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
check_code "POST /api/admin-auth/login" "200" "$LOGIN_CODE"
grep -q admin_token "$COOKIE_JAR" || fail "admin_token cookie missing"

# 2 create page
CREATE_CODE="$(curl -sS -b "$COOKIE_JAR" -o /tmp/b6-page.json -w "%{http_code}" \
  -X POST "$BASE/api/crm/content/pages" \
  -H 'Content-Type: application/json' \
  -d '{"slug":"b6-smoke-test","title":"B6 Smoke","bodyHtml":"<p>B6 smoke body</p>","isVisible":true}')"
check_code "POST /api/crm/content/pages" "201" "$CREATE_CODE"
PAGE_ID="$(python3 -c "import json; print(json.load(open('/tmp/b6-page.json'))['data']['id'])")"
echo "  page id: $PAGE_ID"

# 3 public read
PUB_CODE="$(curl -sS -o /tmp/b6-pub.json -w "%{http_code}" "$BASE/api/content/pages/b6-smoke-test")"
check_code "GET /api/content/pages/b6-smoke-test" "200" "$PUB_CODE"
grep -q 'B6 smoke body' /tmp/b6-pub.json || fail "public page body missing"

# 4 upload
UPLOAD_CODE="$(curl -sS -b "$COOKIE_JAR" -o /tmp/b6-upload.json -w "%{http_code}" \
  -X POST "$BASE/api/crm/content/upload" \
  -F "file=@$TEST_IMG;type=image/png")"
check_code "POST /api/crm/content/upload" "200" "$UPLOAD_CODE"
UPLOAD_URL="$(python3 -c "import json; print(json.load(open('/tmp/b6-upload.json'))['data']['url'])")"
echo "  upload url: $UPLOAD_URL"

# 5 nginx serves upload
IMG_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "$BASE$UPLOAD_URL")"
check_code "GET $UPLOAD_URL via nginx" "200" "$IMG_CODE"
CT="$(curl -sSI "$BASE$UPLOAD_URL" | tr -d '\r' | grep -i '^content-type:' | head -1)"
echo "  $CT"

# 6 delete page
DEL_CODE="$(curl -sS -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" \
  -X DELETE "$BASE/api/crm/content/pages/$PAGE_ID")"
if [[ "$DEL_CODE" == "200" || "$DEL_CODE" == "204" ]]; then
  pass "DELETE /api/crm/content/pages/$PAGE_ID (HTTP $DEL_CODE)"
else
  fail "DELETE page expected 200|204 got $DEL_CODE"
fi

# 7 health
check_code "GET /api/health" "200" "$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/health")"

# 8 TG admin not regressed
check_code "GET /api/admin/me (no auth)" "401" "$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/admin/me")"

# 9 logout
check_code "POST /api/admin-auth/logout" "200" "$(curl -sS -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin-auth/logout")"

echo ""
echo "=== All B6 automated smoke checks passed ==="
