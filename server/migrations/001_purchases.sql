CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT NULL CHECK (email IS NULL OR char_length(email) <= 320),
  unlock_code TEXT UNIQUE NULL,
  provider_ref TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded'))
);

CREATE INDEX IF NOT EXISTS purchases_status_created_at_idx
  ON purchases (status, created_at DESC);
