-- Singleton site settings: contacts, socials, requisites (Part 1A / EPIC Settings).
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- contacts
  contact_phone_display TEXT,
  contact_phone_href TEXT,
  contact_email TEXT,
  contact_address TEXT,
  contact_hours TEXT,
  contact_map_lat DOUBLE PRECISION,
  contact_map_lng DOUBLE PRECISION,
  contact_map_zoom INT,
  -- socials (nullable)
  social_telegram TEXT,
  social_whatsapp TEXT,
  social_vk TEXT,
  -- requisites (Part 3 UI; columns now)
  req_full_name TEXT,
  req_short_name TEXT,
  req_inn TEXT,
  req_ogrnip TEXT,
  req_legal_address TEXT,
  req_actual_address TEXT,
  req_phone TEXT,
  req_email TEXT,
  req_site TEXT,
  req_bank_details TEXT
);

INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
