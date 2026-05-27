-- Raw size string from xlsx (display in product card)
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions_label TEXT NOT NULL DEFAULT '';

-- Source of dimensions: auto = parsed from xlsx, manual = set by manager in admin
ALTER TABLE products ADD COLUMN IF NOT EXISTS dims_source TEXT NOT NULL DEFAULT 'auto'
  CHECK (dims_source IN ('auto', 'manual'));

-- Source of weight: same semantics
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_source TEXT NOT NULL DEFAULT 'auto'
  CHECK (weight_source IN ('auto', 'manual'));

-- Normalized color tags for filtering
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_products_color_tags ON products USING gin(color_tags);
