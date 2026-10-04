ALTER TABLE pairing_codes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE pairing_codes
SET expires_at = NOW() + INTERVAL '24 hours'
WHERE expires_at IS NULL;

ALTER TABLE pairing_codes
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours'),
  ALTER COLUMN expires_at SET NOT NULL;
