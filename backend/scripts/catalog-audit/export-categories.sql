-- SEO-015: read-only category + subcategory snapshot
-- Usage (VPS): sudo -u postgres psql -d muru_db -v ON_ERROR_STOP=1 \
--   -c "\copy ( ... query body without COPY wrapper ... ) TO STDOUT CSV HEADER"
-- Or use the COPY form below.

COPY (
  SELECT
    c.id,
    'category'::text AS kind,
    c.slug,
    NULL::int AS parent_id,
    NULL::text AS parent_slug,
    c.name,
    ('/catalog/' || c.slug || '/') AS live_path,
    (NULLIF(BTRIM(COALESCE(c.seo_title, '')), '') IS NOT NULL) AS has_seo_title,
    (NULLIF(BTRIM(COALESCE(c.seo_description, '')), '') IS NOT NULL) AS has_seo_description,
    (
      NULLIF(BTRIM(COALESCE(c.seo_intro_top, '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(c.seo_text_bottom, '')), '') IS NOT NULL
    ) AS has_seo_text,
    (NULLIF(BTRIM(COALESCE(c.seo_h1, '')), '') IS NOT NULL) AS has_seo_h1,
    c.sort_order
  FROM categories c

  UNION ALL

  SELECT
    s.id,
    'subcategory'::text AS kind,
    s.slug,
    s.category_id AS parent_id,
    c.slug AS parent_slug,
    s.name,
    ('/catalog/' || c.slug || '/' || s.slug || '/') AS live_path,
    (NULLIF(BTRIM(COALESCE(s.seo_title, '')), '') IS NOT NULL) AS has_seo_title,
    (NULLIF(BTRIM(COALESCE(s.seo_description, '')), '') IS NOT NULL) AS has_seo_description,
    (
      NULLIF(BTRIM(COALESCE(s.seo_intro_top, '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(s.seo_text_bottom, '')), '') IS NOT NULL
    ) AS has_seo_text,
    (NULLIF(BTRIM(COALESCE(s.seo_h1, '')), '') IS NOT NULL) AS has_seo_h1,
    s.sort_order
  FROM subcategories s
  INNER JOIN categories c ON c.id = s.category_id

  ORDER BY kind, parent_slug NULLS FIRST, sort_order, slug
) TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
