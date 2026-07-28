-- 033: products.slug constraints (run AFTER backfill-product-slugs.ts)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE slug IS NULL) THEN
    RAISE EXCEPTION
      'products.slug still has NULL rows — run: npm run backfill:product-slugs before 033';
  END IF;
END $$;

ALTER TABLE products ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_slug_unique'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_slug_unique UNIQUE (slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_slug_latin_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_slug_latin_check
      CHECK (slug ~ '^[a-z0-9-]+$');
  END IF;
END $$;
