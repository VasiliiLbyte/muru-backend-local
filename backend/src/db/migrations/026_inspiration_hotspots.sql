-- 026_inspiration_hotspots.sql
-- Hotspots on lookbook hero cover, linked to products.

CREATE TABLE IF NOT EXISTS content_lookbook_hotspots (
  id SERIAL PRIMARY KEY,
  lookbook_id INTEGER NOT NULL REFERENCES content_lookbooks(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  x_percent NUMERIC(5,2) NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
  y_percent NUMERIC(5,2) NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_lookbook_hotspots_lookbook_id
  ON content_lookbook_hotspots(lookbook_id);

CREATE INDEX IF NOT EXISTS idx_content_lookbook_hotspots_product_id
  ON content_lookbook_hotspots(product_id);

DO $$
DECLARE
  hotspot_count INT := 0;
BEGIN
  SELECT COUNT(*)::int INTO hotspot_count FROM content_lookbook_hotspots;
  RAISE NOTICE 'content_lookbook_hotspots row count: %', hotspot_count;
END $$;
