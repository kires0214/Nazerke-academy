ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN archived_from text CHECK (archived_from IN ('pending','approved','blocked'));
ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending','approved','blocked','archived','deleted'));
ALTER TABLE users ADD CONSTRAINT users_account_lifecycle_check CHECK (
  (status = 'archived') = (archived_from IS NOT NULL)
  AND (status = 'deleted') = (telegram_id IS NULL)
);
