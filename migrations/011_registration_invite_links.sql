CREATE TABLE registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash)=64),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
  used_at timestamptz,
  revoked_at timestamptz,
  CHECK (used_at IS NULL OR revoked_at IS NULL)
);

CREATE TABLE telegram_registration_invite_drafts (
  telegram_id bigint PRIMARY KEY CHECK (telegram_id>0),
  invite_id uuid NOT NULL REFERENCES registration_invites(id)
);

ALTER TABLE registration_requests ADD COLUMN invite_id uuid UNIQUE REFERENCES registration_invites(id);
ALTER TABLE registration_requests ADD CONSTRAINT registration_invite_without_order
  CHECK (invite_id IS NULL OR (order_source IS NULL AND order_number IS NULL));
