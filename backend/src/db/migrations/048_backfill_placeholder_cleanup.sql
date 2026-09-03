-- One-time backfill: clear stale placeholder URL baked into products without real photos.
-- The current placeholder is applied dynamically via getCatalogPlaceholderImageUrl().
UPDATE products
SET image_url_1 = NULL,
    image_url_2 = NULL,
    image_urls = '{}'
WHERE image_url_1 = '/uploads/2843e507-19d3-412c-b727-6955f194daf5.webp'
  AND (image_urls IS NULL
       OR image_urls = ARRAY['/uploads/2843e507-19d3-412c-b727-6955f194daf5.webp']::text[]
       OR image_urls = '{}');
