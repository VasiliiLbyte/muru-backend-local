-- 040_backfill_product_subcategories_from_denorm.sql
-- Insert missing product_subcategories links from denormalized slug fields.
-- Prefer web_subcategory_slug; fallback subcategory_slug. Match subcategories by
-- slug within the product's category. Idempotent (ON CONFLICT DO NOTHING).

DO $$
DECLARE
  inserted_links INT := 0;
BEGIN
  INSERT INTO product_subcategories (product_id, subcategory_id, position)
  SELECT p.id, s.id, 0
  FROM products p
  INNER JOIN subcategories s
    ON s.category_id = p.category_id
   AND s.slug = COALESCE(
         NULLIF(TRIM(p.web_subcategory_slug), ''),
         NULLIF(TRIM(p.subcategory_slug), '')
       )
  WHERE p.is_archived = FALSE
    AND p.category_id IS NOT NULL
    AND COALESCE(
          NULLIF(TRIM(p.web_subcategory_slug), ''),
          NULLIF(TRIM(p.subcategory_slug), '')
        ) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM product_subcategories ps
      WHERE ps.product_id = p.id
        AND ps.subcategory_id = s.id
    )
  ON CONFLICT (product_id, subcategory_id) DO NOTHING;

  GET DIAGNOSTICS inserted_links = ROW_COUNT;
  RAISE NOTICE '040 backfill: inserted % product_subcategories link(s)', inserted_links;
END $$;
