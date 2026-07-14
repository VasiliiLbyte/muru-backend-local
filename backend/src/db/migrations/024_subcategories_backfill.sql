-- 024_subcategories_backfill.sql
-- Backfill subcategories and product_subcategories from denormalized subcategory text fields.
--
-- Source: COALESCE(web_subcategory_name, subcategory). "web_subcategory_name" is the
-- originally-intended primary source (migration 015, "Web catalog F/G/H"), but in
-- practice it is empty for all products (the sheet columns behind it were apparently
-- never filled in by the client). The legacy "subcategory" column (migration 019,
-- CRM catalog phase) is the one that actually holds real taxonomy data. Preferring
-- web_subcategory_name when present keeps this forward-compatible if that ever
-- changes, while the fallback makes the backfill actually populate real data today.

DO $$
DECLARE
  inserted_subcategories INT := 0;
  inserted_links INT := 0;
  rec RECORD;
BEGIN
  INSERT INTO subcategories (category_id, name, slug)
  SELECT DISTINCT
    p.category_id,
    COALESCE(NULLIF(TRIM(p.web_subcategory_name), ''), NULLIF(TRIM(p.subcategory), '')) AS name,
    regexp_replace(
      regexp_replace(
        lower(COALESCE(NULLIF(TRIM(p.web_subcategory_name), ''), NULLIF(TRIM(p.subcategory), ''))),
        '\s+', '-', 'g'
      ),
      '[^a-z0-9а-яё-]', '', 'gi'
    ) AS slug
  FROM products p
  WHERE p.is_archived = FALSE
    AND p.category_id IS NOT NULL
    AND COALESCE(NULLIF(TRIM(p.web_subcategory_name), ''), NULLIF(TRIM(p.subcategory), '')) IS NOT NULL
  ON CONFLICT (category_id, slug) DO NOTHING;

  GET DIAGNOSTICS inserted_subcategories = ROW_COUNT;
  RAISE NOTICE 'Created % subcategory row(s) from product web_subcategory_name/subcategory', inserted_subcategories;

  INSERT INTO product_subcategories (product_id, subcategory_id, position)
  SELECT p.id, s.id, 0
  FROM products p
  INNER JOIN subcategories s
    ON s.category_id = p.category_id
   AND s.slug = regexp_replace(
         regexp_replace(
           lower(COALESCE(NULLIF(TRIM(p.web_subcategory_name), ''), NULLIF(TRIM(p.subcategory), ''))),
           '\s+', '-', 'g'
         ),
         '[^a-z0-9а-яё-]', '', 'gi'
       )
  WHERE p.is_archived = FALSE
    AND COALESCE(NULLIF(TRIM(p.web_subcategory_name), ''), NULLIF(TRIM(p.subcategory), '')) IS NOT NULL
  ON CONFLICT (product_id, subcategory_id) DO NOTHING;

  GET DIAGNOSTICS inserted_links = ROW_COUNT;
  RAISE NOTICE 'Created % product_subcategories link(s)', inserted_links;

  FOR rec IN
    SELECT c.name AS category_name, COUNT(*)::int AS cnt
    FROM subcategories s
    JOIN categories c ON c.id = s.category_id
    GROUP BY c.name
    ORDER BY c.name
  LOOP
    RAISE NOTICE 'Subcategories in category %: %', rec.category_name, rec.cnt;
  END LOOP;
END $$;
