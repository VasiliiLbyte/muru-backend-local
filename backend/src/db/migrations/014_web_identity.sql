-- 014_web_identity.sql
-- Веб-канал: orders/payments без telegram_user_id + признак channel.
ALTER TABLE orders   ALTER COLUMN telegram_user_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN telegram_user_id DROP NOT NULL;

ALTER TABLE orders   ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'telegram';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'telegram';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_channel_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_channel_check CHECK (channel IN ('telegram','web'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_channel_check') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_channel_check CHECK (channel IN ('telegram','web'));
  END IF;
END$$;
