ALTER TABLE telegram_registration_drafts
  ADD COLUMN last_name text CHECK (length(last_name) BETWEEN 1 AND 60),
  ADD COLUMN first_name text CHECK (length(first_name) BETWEEN 1 AND 60),
  ADD CHECK (first_name IS NULL OR last_name IS NOT NULL);

ALTER TABLE registration_requests
  ADD COLUMN last_name text CHECK (length(last_name) BETWEEN 1 AND 60),
  ADD COLUMN first_name text CHECK (length(first_name) BETWEEN 1 AND 60),
  ADD CHECK ((first_name IS NULL)=(last_name IS NULL));

ALTER TABLE users
  ADD COLUMN last_name text CHECK (length(last_name) BETWEEN 1 AND 60),
  ADD COLUMN first_name text CHECK (length(first_name) BETWEEN 1 AND 60),
  ADD CHECK ((first_name IS NULL)=(last_name IS NULL));
