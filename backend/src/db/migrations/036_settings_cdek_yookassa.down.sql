ALTER TABLE site_settings DROP CONSTRAINT IF EXISTS site_settings_cdek_env_check;

ALTER TABLE site_settings
  DROP COLUMN IF EXISTS cdek_env,
  DROP COLUMN IF EXISTS cdek_sender_city_code,
  DROP COLUMN IF EXISTS cdek_sender_postal_code,
  DROP COLUMN IF EXISTS cdek_sender_address,
  DROP COLUMN IF EXISTS cdek_sender_name,
  DROP COLUMN IF EXISTS cdek_sender_phone,
  DROP COLUMN IF EXISTS cdek_tariff_door,
  DROP COLUMN IF EXISTS cdek_tariff_pvz,
  DROP COLUMN IF EXISTS cdek_default_weight_grams,
  DROP COLUMN IF EXISTS cdek_default_length_cm,
  DROP COLUMN IF EXISTS cdek_default_width_cm,
  DROP COLUMN IF EXISTS cdek_default_height_cm,
  DROP COLUMN IF EXISTS yookassa_vat_code,
  DROP COLUMN IF EXISTS yookassa_verify_ip;
