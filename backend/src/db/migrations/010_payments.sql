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

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
