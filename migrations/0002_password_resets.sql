-- One row per password reset request. Only the hash of the token is stored, so
-- a database dump cannot be used to take over an account.
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);
CREATE INDEX password_resets_expires_idx ON password_resets (expires_at);
