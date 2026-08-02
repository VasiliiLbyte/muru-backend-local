-- Stock movements journal (STK-001 / POST-MIGRATION-1 P2).
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NULL REFERENCES products(id) ON DELETE SET NULL,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  delta INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'return', 'adjustment')),
  reason TEXT NOT NULL,
  order_id INTEGER NULL REFERENCES orders(id) ON DELETE SET NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'admin')),
  actor_admin_id INTEGER NULL,
  actor_label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON stock_movements (order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements (type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements (created_at DESC);
