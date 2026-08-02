-- Reverse of 039_price_list_restore: list → sale.
-- Not perfectly idempotent for float edge cases; prefer restore from backup on prod.

UPDATE products
SET price = ROUND(price * (1 - discount_percent / 100.0), 2),
    updated_at = NOW()
WHERE discount_percent > 0
  AND discount_percent < 100;
