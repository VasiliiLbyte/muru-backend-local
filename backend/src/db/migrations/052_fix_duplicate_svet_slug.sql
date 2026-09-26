-- 052: fix duplicate subcategory slug `svet`
-- The old interer/«Свет» row was renamed to «Вазы и кувшины» in the CRM but kept slug `svet`,
-- colliding with mebel-i-svet/«Свет». The storefront keys subcategories by slug, so vases
-- rendered under «Мебель и свет → Свет» and interer's listing went empty.
-- Idempotent: re-running finds nothing to change.

BEGIN;

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
