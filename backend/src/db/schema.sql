CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

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
