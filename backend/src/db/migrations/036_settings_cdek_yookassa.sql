-- CDEK / YooKassa non-secret business settings on site_settings singleton (EPIC Settings Part 4A).
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS cdek_env TEXT,
  ADD COLUMN IF NOT EXISTS cdek_sender_city_code INT,
  ADD COLUMN IF NOT EXISTS cdek_sender_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS cdek_sender_address TEXT,
  ADD COLUMN IF NOT EXISTS cdek_sender_name TEXT,
  ADD COLUMN IF NOT EXISTS cdek_sender_phone TEXT,
  ADD COLUMN IF NOT EXISTS cdek_tariff_door INT,
  ADD COLUMN IF NOT EXISTS cdek_tariff_pvz INT,
  ADD COLUMN IF NOT EXISTS cdek_default_weight_grams INT,
  ADD COLUMN IF NOT EXISTS cdek_default_length_cm INT,
  ADD COLUMN IF NOT EXISTS cdek_default_width_cm INT,
  ADD COLUMN IF NOT EXISTS cdek_default_height_cm INT,
  ADD COLUMN IF NOT EXISTS yookassa_vat_code INT,
  ADD COLUMN IF NOT EXISTS yookassa_verify_ip BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_cdek_env_check'
  ) THEN
    ALTER TABLE site_settings
      ADD CONSTRAINT site_settings_cdek_env_check
      CHECK (cdek_env IS NULL OR cdek_env IN ('test', 'production'));
  END IF;
END $$;
