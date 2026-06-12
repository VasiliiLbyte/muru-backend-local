CREATE TABLE IF NOT EXISTS sync_schedule_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  hour_msk INTEGER NOT NULL DEFAULT 4 CHECK (hour_msk BETWEEN 0 AND 23),
  last_auto_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sync_schedule_settings (id, enabled, hour_msk)
VALUES (1, FALSE, 4)
ON CONFLICT (id) DO NOTHING;
