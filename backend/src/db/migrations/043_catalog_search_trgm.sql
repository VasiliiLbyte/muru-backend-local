-- 043: pg_trgm search — search_document (trigger-maintained) + GIN indexes
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE products ADD COLUMN IF NOT EXISTS search_document TEXT;

CREATE OR REPLACE FUNCTION muru_build_product_search_document(
  p_name TEXT,
  p_sku TEXT,
  p_description TEXT,
  p_specs JSONB,
  p_color TEXT,
  p_color_tags TEXT[],
  p_subcategory TEXT,
  p_subcategory_slug TEXT,
  p_web_subcategory_name TEXT,
  p_web_subcategory_slug TEXT,
  p_dimensions_label TEXT
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(
    trim(
      concat_ws(
        ' ',
        coalesce(p_name, ''),
        coalesce(p_sku, ''),
        coalesce(p_description, ''),
        (
          SELECT coalesce(string_agg(s.value, ' '), '')
          FROM jsonb_each_text(coalesce(p_specs, '{}'::jsonb)) AS s(key, value)
        ),
        coalesce(p_color, ''),
        coalesce(array_to_string(p_color_tags, ' '), ''),
        coalesce(p_subcategory, ''),
        coalesce(p_subcategory_slug, ''),
        coalesce(p_web_subcategory_name, ''),
        coalesce(p_web_subcategory_slug, ''),
        coalesce(p_dimensions_label, '')
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION muru_refresh_product_search_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_document := muru_build_product_search_document(
    NEW.name,
    NEW.sku,
    NEW.description,
    NEW.specs,
    NEW.color,
    NEW.color_tags,
    NEW.subcategory,
    NEW.subcategory_slug,
    NEW.web_subcategory_name,
    NEW.web_subcategory_slug,
    NEW.dimensions_label
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_search_document ON products;
CREATE TRIGGER trg_products_search_document
  BEFORE INSERT OR UPDATE OF
    name, sku, description, specs, color, color_tags,
    subcategory, subcategory_slug, web_subcategory_name,
    web_subcategory_slug, dimensions_label
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION muru_refresh_product_search_document();

UPDATE products
SET search_document = muru_build_product_search_document(
  name,
  sku,
  description,
  specs,
  color,
  color_tags,
  subcategory,
  subcategory_slug,
  web_subcategory_name,
  web_subcategory_slug,
  dimensions_label
)
WHERE search_document IS NULL
   OR search_document = '';

CREATE INDEX IF NOT EXISTS idx_products_search_document_trgm
  ON products USING gin (search_document gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (lower(name) gin_trgm_ops);
