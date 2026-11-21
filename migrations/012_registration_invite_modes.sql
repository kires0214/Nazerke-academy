ALTER TABLE registration_invites
  ADD COLUMN mode text NOT NULL DEFAULT 'single' CHECK (mode IN ('single','multi')),
  ALTER COLUMN expires_at SET DEFAULT (now()+interval '3 days'),
  ADD CONSTRAINT registration_invites_multi_unused CHECK (mode='single' OR used_at IS NULL);

UPDATE registration_invites SET expires_at=created_at+interval '3 days'
WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at>now()
  AND expires_at>created_at+interval '3 days';

ALTER TABLE registration_requests DROP CONSTRAINT registration_requests_invite_id_key;
CREATE INDEX registration_requests_invite_id_idx ON registration_requests(invite_id) WHERE invite_id IS NOT NULL;

-- Preserve earlier applications and enforce the requirements on new writes.
ALTER TABLE registration_requests
  ADD CONSTRAINT registration_request_requires_order_or_invite
    CHECK (status<>'requested' OR invite_id IS NOT NULL OR order_source IS NOT NULL) NOT VALID,
  ADD CONSTRAINT registration_order_alphanumeric
    CHECK (order_number IS NULL OR order_number !~ '[^[:alnum:]]') NOT VALID;
