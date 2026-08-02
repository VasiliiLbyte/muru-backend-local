-- PRICE-DISCOUNT-CANON: restore products.price as LIST (full) price.
-- Previously some rows stored sale (pay) price in `price` while discount_percent > 0.
-- Example: price=1440, discount=20 → after: price=1800 (sale becomes 1440 via formula).
-- Idempotent only if price is still the sale amount; do not re-run after already restored.

UPDATE products
SET price = ROUND(price / (1 - discount_percent / 100.0), 2),
    updated_at = NOW()
WHERE discount_percent > 0
  AND discount_percent < 100;
