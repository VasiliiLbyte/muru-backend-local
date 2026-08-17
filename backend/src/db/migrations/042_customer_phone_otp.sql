-- 042: dual auth (phone OR email) + customer OTP codes for flash-call login
-- Idempotent: safe to re-run.

-- customers: email and password_hash optional (phone-only accounts)
DO $$
BEGIN
  ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE customers ALTER COLUMN password_hash DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'customers'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%email%'
      AND pg_get_constraintdef(oid) NOT LIKE '%WHERE%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE customers DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'customers'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) LIKE '%email%'
        AND pg_get_constraintdef(oid) NOT LIKE '%WHERE%'
      LIMIT 1
    );
  END IF;
END$$;

DROP INDEX IF EXISTS customers_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique
  ON customers (email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
  ON customers (phone)
  WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_otp_codes (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  attempts INT NOT NULL DEFAULT 0,
  request_ip TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_otp_codes_phone_created
  ON customer_otp_codes (phone, created_at DESC);
