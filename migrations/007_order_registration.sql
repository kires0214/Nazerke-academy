ALTER TABLE registration_requests ADD COLUMN order_source text CHECK(order_source IN ('kaspi','kenwood','braun'));
ALTER TABLE registration_requests ADD COLUMN order_number text CHECK(length(order_number) BETWEEN 1 AND 80);
ALTER TABLE registration_requests ADD CONSTRAINT registration_order_pair CHECK(
  (order_source IS NULL AND order_number IS NULL) OR
  (order_source IS NOT NULL AND order_number IS NOT NULL AND status='requested')
);
CREATE TABLE telegram_registration_drafts (
  telegram_id bigint PRIMARY KEY CHECK(telegram_id>0),
  phone text NOT NULL CHECK(phone ~ '^\+?[0-9]{7,15}$'),
  display_name text CHECK(length(display_name) BETWEEN 1 AND 120),
  order_source text CHECK(order_source IN ('kaspi','kenwood','braun')),
  expires_at timestamptz NOT NULL,
  CHECK(order_source IS NULL OR display_name IS NOT NULL)
);
CREATE INDEX telegram_registration_drafts_expiry ON telegram_registration_drafts(expires_at);
