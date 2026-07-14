-- 023_product_subcategories.sql
CREATE TABLE IF NOT EXISTS product_subcategories (
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  subcategory_id INT NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, subcategory_id)
);

CREATE INDEX IF NOT EXISTS idx_product_subcategories_subcategory_id ON product_subcategories(subcategory_id);
