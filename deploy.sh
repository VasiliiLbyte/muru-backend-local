#!/bin/bash
set -e

echo "=== MURU Deploy ==="
echo "[1/4] Building backend..."
cd backend && npm run build && cd ..

echo "[2/4] Installing backend deps (prod only)..."
cd backend && npm ci --omit=dev && cd ..

echo "[3/4] Building frontend..."
cd frontend && npm run build && cd ..

echo "[4/4] Restarting PM2..."
pm2 reload ecosystem.config.js --update-env

echo "=== Deploy complete ==="
