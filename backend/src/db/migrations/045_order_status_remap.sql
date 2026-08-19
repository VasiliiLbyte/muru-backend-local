-- 045: consolidate order statuses 9→7 (manager-facing 6 + Черновик)
-- Idempotent: safe to re-run.

UPDATE orders SET status = 'Собирается'
  WHERE status IN ('В обработке', 'Подтверждён');

UPDATE orders SET status = 'В пути'
  WHERE status = 'Передан в доставку';
