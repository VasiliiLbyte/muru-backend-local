-- 031: customer accounts (ЛК storefront) + additive orders/favorites columns
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  phone_verified_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  telegram_id BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  consent_accepted BOOLEAN NOT NULL DEFAULT false,
  consent_version TEXT,
  consent_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_telegram_id ON customers(telegram_id) WHERE telegram_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  cdek_city_code INTEGER,
  address TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_one_default
  ON customer_addresses (customer_id)
  WHERE is_default;

CREATE TABLE IF NOT EXISTS customer_auth_tokens (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email_verify', 'password_reset')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_auth_tokens_hash ON customer_auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_auth_tokens_customer ON customer_auth_tokens(customer_id);

CREATE TABLE IF NOT EXISTS customer_refresh_tokens (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_refresh_tokens_customer ON customer_refresh_tokens(customer_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id) WHERE customer_id IS NOT NULL;

ALTER TABLE favorites ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE;

DO $$
BEGIN
  ALTER TABLE favorites ALTER COLUMN telegram_user_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'favorites_telegram_user_id_product_sku_key'
  ) THEN
    ALTER TABLE favorites DROP CONSTRAINT favorites_telegram_user_id_product_sku_key;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'favorites'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%telegram_user_id%'
      AND pg_get_constraintdef(oid) LIKE '%product_sku%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE favorites DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'favorites'::regclass AND contype = 'u'
        AND pg_get_constraintdef(oid) LIKE '%telegram_user_id%'
        AND pg_get_constraintdef(oid) LIKE '%product_sku%'
      LIMIT 1
    );
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_telegram_sku
  ON favorites (telegram_user_id, product_sku)
  WHERE telegram_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_customer_sku
  ON favorites (customer_id, product_sku)
  WHERE customer_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favorites_identity_xor_check'
  ) THEN
    ALTER TABLE favorites ADD CONSTRAINT favorites_identity_xor_check
      CHECK (
        (telegram_user_id IS NOT NULL AND customer_id IS NULL)
        OR (telegram_user_id IS NULL AND customer_id IS NOT NULL)
      );
  END IF;
END$$;
