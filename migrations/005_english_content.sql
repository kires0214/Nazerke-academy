ALTER TABLE content DROP CONSTRAINT content_language_check;
ALTER TABLE content ADD CONSTRAINT content_language_check CHECK(language IN ('RU','EN','KZ'));
