ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;
