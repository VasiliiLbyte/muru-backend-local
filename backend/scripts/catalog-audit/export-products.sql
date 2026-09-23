-- SEO-015: read-only product snapshot (public catalog only)
-- Filter: is_archived = FALSE (same as SEO-004 public export)

COPY (
  SELECT
    p.id,
    p.sku,
    p.slug,
    p.name,
    c.slug AS category_slug,
    COALESCE(
      NULLIF(BTRIM(p.web_subcategory_slug), ''),
      NULLIF(BTRIM(p.subcategory_slug), '')
    ) AS subcategory_slug,
    CASE
      WHEN c.slug IS NOT NULL AND p.slug IS NOT NULL THEN
        '/catalog/' || c.slug || '/' ||
        COALESCE(
          NULLIF(BTRIM(p.web_subcategory_slug), ''),
          NULLIF(BTRIM(p.subcategory_slug), ''),
          '_'
        ) || '/' || p.slug || '/'
      ELSE NULL
    END AS live_path,
    (NULLIF(BTRIM(COALESCE(p.seo_title, '')), '') IS NOT NULL) AS has_seo_title,
    (NULLIF(BTRIM(COALESCE(p.seo_description, '')), '') IS NOT NULL) AS has_seo_description,
    (NULLIF(BTRIM(COALESCE(p.description, '')), '') IS NOT NULL) AS has_description,
    (NULLIF(BTRIM(COALESCE(p.seo_h1, '')), '') IS NOT NULL) AS has_seo_h1
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.is_archived = FALSE
  ORDER BY c.slug NULLS LAST, p.sku
) TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
