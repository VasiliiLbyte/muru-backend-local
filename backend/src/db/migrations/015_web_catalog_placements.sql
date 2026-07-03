-- 015_web_catalog_placements.sql
-- Web-only catalog columns F (primary sub) and G/H (cross placement).

ALTER TABLE products ADD COLUMN IF NOT EXISTS web_subcategory_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS web_subcategory_slug TEXT;

CREATE TABLE IF NOT EXISTS product_web_cross_placements (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  subcategory_name TEXT,
  subcategory_slug TEXT
);

CREATE INDEX IF NOT EXISTS idx_pwcp_category_id ON product_web_cross_placements(category_id);
