-- 042 down: revert dual auth + drop OTP table

DROP TABLE IF EXISTS customer_otp_codes;

DROP INDEX IF EXISTS idx_customers_phone_unique;
DROP INDEX IF EXISTS idx_customers_email_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'customers'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%email%'
      AND pg_get_constraintdef(oid) NOT LIKE '%WHERE%'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_email_key UNIQUE (email);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END$$;

ALTER TABLE customers ALTER COLUMN email SET NOT NULL;
ALTER TABLE customers ALTER COLUMN password_hash SET NOT NULL;
