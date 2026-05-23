-- Admin order management fields and list indexes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_comment TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manager_telegram_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
