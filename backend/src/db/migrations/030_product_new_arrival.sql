ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS new_arrival_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_products_is_new_arrival
  ON products (is_new_arrival, new_arrival_at DESC) WHERE is_new_arrival = TRUE;
