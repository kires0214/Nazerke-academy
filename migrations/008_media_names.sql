ALTER TABLE media ADD COLUMN file_name text CHECK(length(file_name) BETWEEN 1 AND 180);
