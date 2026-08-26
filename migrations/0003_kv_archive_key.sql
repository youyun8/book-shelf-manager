-- Uploaded spreadsheets moved from R2 to Workers KV, so the column no longer
-- names a bucket key. Existing values stay valid: they were never read back.
ALTER TABLE imports RENAME COLUMN r2_key TO archive_key;
