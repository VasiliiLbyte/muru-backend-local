-- CDEK integration fields on orders and webhook status history

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_tariff_code INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_to_city_code INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_to_city_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_pvz_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_pvz_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_recipient_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_recipient_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_uuid TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_track_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_status_updated_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_calc_payload JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_create_payload JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_create_response JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_create_error TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_sync_state TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_orders_cdek_uuid ON orders(cdek_uuid) WHERE cdek_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_cdek_sync_state ON orders(cdek_sync_state)
  WHERE cdek_sync_state IN ('pending', 'error');

CREATE TABLE IF NOT EXISTS cdek_status_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  cdek_uuid TEXT,
  code TEXT NOT NULL,
  name TEXT,
  city TEXT,
  happened_at TIMESTAMPTZ,
  raw JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdek_events_order ON cdek_status_events(order_id);
CREATE INDEX IF NOT EXISTS idx_cdek_events_uuid ON cdek_status_events(cdek_uuid);
