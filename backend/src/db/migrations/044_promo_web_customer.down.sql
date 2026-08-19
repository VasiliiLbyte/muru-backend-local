-- 044 down: rollback promo web identity support

ALTER TABLE promo_code_usages
  DROP CONSTRAINT IF EXISTS chk_pcu_identity;

DROP INDEX IF EXISTS idx_pcu_customer_id;

ALTER TABLE promo_code_usages
  DROP COLUMN IF EXISTS customer_id;

ALTER TABLE promo_code_usages
  ALTER COLUMN telegram_user_id SET NOT NULL;

