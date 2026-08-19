-- 043 down: remove search_document, indexes, pg_trgm extension

DROP TRIGGER IF EXISTS trg_products_search_document ON products;
DROP FUNCTION IF EXISTS muru_refresh_product_search_document();
DROP FUNCTION IF EXISTS muru_build_product_search_document(
  TEXT, TEXT, TEXT, JSONB, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT
);

DROP INDEX IF EXISTS idx_products_search_document_trgm;
DROP INDEX IF EXISTS idx_products_name_trgm;

ALTER TABLE products DROP COLUMN IF EXISTS search_document;

DROP EXTENSION IF EXISTS pg_trgm;
