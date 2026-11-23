CREATE TABLE registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE CHECK (telegram_id > 0),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  phone text CHECK (phone ~ '^\+?[0-9]{7,15}$'),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','invited','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CHECK ((status = 'requested' AND phone IS NOT NULL AND reviewed_at IS NULL)
    OR (status <> 'requested' AND phone IS NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE telegram_login_codes (
  telegram_id bigint PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  expires_at timestamptz NOT NULL
);
CREATE INDEX telegram_login_codes_expiry ON telegram_login_codes(expires_at);
