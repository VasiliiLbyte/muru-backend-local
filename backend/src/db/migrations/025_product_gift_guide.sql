ALTER TABLE products ADD COLUMN IF NOT EXISTS is_gift_guide BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_is_gift_guide ON products (is_gift_guide) WHERE is_gift_guide = TRUE;
