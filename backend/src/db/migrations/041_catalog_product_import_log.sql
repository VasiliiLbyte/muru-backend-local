-- 041_catalog_product_import_log.sql
-- Persistent log for clean product XLSX import (IMPORT-001 Phase 1).

CREATE TABLE IF NOT EXISTS catalog_product_import_log (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_id INTEGER NULL,
  admin_email TEXT NULL,
  filename TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL CHECK (mode IN ('new', 'upsert')),
  to_create INTEGER NOT NULL DEFAULT 0,
  to_update INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_product_import_log_created_at
  ON catalog_product_import_log (created_at DESC);
