CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

-- Category cover from Drive (admin): filename in MURU_Images folder; URL after POST .../sync/category-covers
-- Apply on existing DB: ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_drive_filename TEXT;
-- ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_drive_filename TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  in_stock INTEGER NOT NULL DEFAULT 0,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- image_url_1: первое фото (обязательное)
  image_url_1 TEXT NOT NULL,
  -- image_url_2: второе фото (дублирует image_url_1 если фото одно)
  image_url_2 TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- image_urls: JSONB массив всех фото (основной источник)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS color VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS size VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER NOT NULL DEFAULT 500;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_length_cm INTEGER NOT NULL DEFAULT 20;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_width_cm INTEGER NOT NULL DEFAULT 20;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_height_cm INTEGER NOT NULL DEFAULT 20;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions_label TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS dims_source TEXT NOT NULL DEFAULT 'auto'
  CHECK (dims_source IN ('auto', 'manual'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_source TEXT NOT NULL DEFAULT 'auto'
  CHECK (weight_source IN ('auto', 'manual'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_color_tags ON products USING gin(color_tags);

UPDATE products
SET image_urls = (
  SELECT to_jsonb(array_remove(ARRAY[image_url_1, image_url_2], NULL))
)
WHERE (image_urls IS NULL OR image_urls = '[]'::jsonb);

CREATE TABLE IF NOT EXISTS variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT,
  size TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Черновик',
  delivery_mode TEXT NOT NULL DEFAULT 'delivery',
  delivery_option TEXT,
  delivery_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  delivery_eta TEXT,
  address TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  birth_date DATE,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_draft BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_comment TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manager_telegram_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  size TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_telegram_user_id ON orders(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_draft ON orders(is_draft);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  delivery_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_telegram_user_id ON user_profiles(telegram_user_id);

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  product_sku TEXT NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (telegram_user_id, product_sku)
);

CREATE INDEX IF NOT EXISTS idx_favorites_telegram_user_id ON favorites(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_sku ON favorites(product_sku);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  username VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

CREATE TABLE IF NOT EXISTS catalog_sync_log (
  id SERIAL PRIMARY KEY,
  admin_telegram_id BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  synced_products INTEGER NOT NULL DEFAULT 0,
  skipped_products INTEGER,
  total_rows INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_sync_log_finished_at ON catalog_sync_log (finished_at DESC);

CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12, 2) NOT NULL,
  min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_limit_per_user INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_usages (
  id SERIAL PRIMARY KEY,
  promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_usages_user ON promo_code_usages(telegram_user_id, promo_code_id);

CREATE TABLE IF NOT EXISTS bot_welcome_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  welcome_cover_drive_filename TEXT,
  welcome_image_url TEXT
);

INSERT INTO bot_welcome_settings (id, welcome_cover_drive_filename, welcome_image_url)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  yookassa_payment_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'waiting_for_capture', 'succeeded', 'canceled')),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  telegram_user_id BIGINT NOT NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  checkout_snapshot JSONB NOT NULL,
  idempotence_key TEXT NOT NULL,
  confirmation_url TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_yk_id ON payments(yookassa_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE status IN ('pending','waiting_for_capture');
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(telegram_user_id);
