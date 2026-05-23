-- Last catalog sync runs (admin audit log, keep 3 rows via app prune)
CREATE TABLE IF NOT EXISTS catalog_sync_log (
  id SERIAL PRIMARY KEY,
  admin_telegram_id BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  synced_products INTEGER NOT NULL DEFAULT 0,
  skipped_products INTEGER,
  total_rows INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_sync_log_finished_at ON catalog_sync_log (finished_at DESC);
