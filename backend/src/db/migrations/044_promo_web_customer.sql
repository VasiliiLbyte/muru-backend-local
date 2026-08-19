-- 044: promo_code_usages web identity support — customer_id + nullable telegram_user_id
-- Idempotent-ish: safe to re-run in dev.

ALTER TABLE promo_code_usages
  ALTER COLUMN telegram_user_id DROP NOT NULL;

ALTER TABLE promo_code_usages
  ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pcu_customer_id
  ON promo_code_usages (customer_id)
  WHERE customer_id IS NOT NULL;

ALTER TABLE promo_code_usages
  DROP CONSTRAINT IF EXISTS chk_pcu_identity;

ALTER TABLE promo_code_usages
  ADD CONSTRAINT chk_pcu_identity
  CHECK (telegram_user_id IS NOT NULL OR customer_id IS NOT NULL);

