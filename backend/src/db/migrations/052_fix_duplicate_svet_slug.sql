-- 052: fix duplicate subcategory slug `svet`
-- The old interer/«Свет» row was renamed to «Вазы и кувшины» in the CRM but kept slug `svet`,
-- colliding with mebel-i-svet/«Свет». The storefront keys subcategories by slug, so vases
-- rendered under «Мебель и свет → Свет» and interer's listing went empty.
-- Idempotent: re-running finds nothing to change.

BEGIN;

-- 0a) Free the slug from the retired, empty «Вазы и кувшины» under the old vazy-i-aksessuary
--     (no active products → invisible on the site; the row is kept, only its slug is parked).
UPDATE subcategories s SET slug = 'vazy-i-kuvshiny-old-' || s.id
FROM categories c
WHERE c.id = s.category_id
  AND c.slug <> 'interer'
  AND s.slug = 'vazy-i-kuvshiny'
  AND NOT EXISTS (
    SELECT 1 FROM product_subcategories ps
    JOIN products p ON p.id = ps.product_id AND p.is_archived = FALSE
    WHERE ps.subcategory_id = s.id
  );

-- 0b) Guard: the target slug must now be free outside `interer`, otherwise we'd create a new duplicate.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM subcategories s JOIN categories c ON c.id = s.category_id
    WHERE s.slug = 'vazy-i-kuvshiny' AND c.slug <> 'interer'
  ) THEN
    RAISE EXCEPTION 'slug vazy-i-kuvshiny is already used by a subcategory outside interer — resolve it first';
  END IF;
END $$;

-- 1) Product denorm copies (primary subcategory name/slug) for products linked to the vase row.
UPDATE products p SET
  web_subcategory_name = 'Вазы и кувшины',
  web_subcategory_slug = 'vazy-i-kuvshiny',
  subcategory = 'Вазы и кувшины',
  subcategory_slug = 'vazy-i-kuvshiny',
  updated_at = NOW()
FROM subcategories s
JOIN categories c ON c.id = s.category_id
WHERE c.slug = 'interer'
  AND s.name = 'Вазы и кувшины'
  AND s.slug = 'svet'
  AND (p.web_subcategory_slug = 'svet' OR p.subcategory_slug = 'svet')
  AND EXISTS (
    SELECT 1 FROM product_subcategories ps
    WHERE ps.product_id = p.id AND ps.subcategory_id = s.id
  );

-- 2) The subcategory itself.
UPDATE subcategories s SET slug = 'vazy-i-kuvshiny'
FROM categories c
WHERE c.id = s.category_id
  AND c.slug = 'interer'
  AND s.name = 'Вазы и кувшины'
  AND s.slug = 'svet';

COMMIT;

-- Diagnostic (expected: 0 rows) — subcategory slugs shared across categories.
SELECT slug, array_agg(category_id) AS category_ids
FROM subcategories
GROUP BY slug
HAVING COUNT(DISTINCT category_id) > 1;
