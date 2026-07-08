CREATE TABLE IF NOT EXISTS content_pages (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_pages_slug ON content_pages(slug);

CREATE TABLE IF NOT EXISTS content_collections (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  hero_image JSONB,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_collections_slug ON content_collections(slug);

CREATE TABLE IF NOT EXISTS content_collection_products (
  collection_id INTEGER NOT NULL REFERENCES content_collections(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_content_collection_products_collection_id
  ON content_collection_products(collection_id);

CREATE TABLE IF NOT EXISTS content_lookbooks (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image JSONB,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_lookbooks_slug ON content_lookbooks(slug);

CREATE TABLE IF NOT EXISTS content_lookbook_images (
  id SERIAL PRIMARY KEY,
  lookbook_id INTEGER NOT NULL REFERENCES content_lookbooks(id) ON DELETE CASCADE,
  image JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_content_lookbook_images_lookbook_id
  ON content_lookbook_images(lookbook_id);

CREATE TABLE IF NOT EXISTS content_banners (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  href TEXT,
  image JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
