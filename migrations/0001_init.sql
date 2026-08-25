-- Everyone who is allowed to create an account. Registration checks this table,
-- so an address that is not listed can never see the shared library.
CREATE TABLE allowed_emails (
  email TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- Only the hash of a session token is stored, so a database dump cannot be
-- replayed as a login.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- Throttles password guessing per email address.
CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

-- The shared library. `position` keeps the order of the imported spreadsheet.
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  illustrator TEXT NOT NULL DEFAULT '',
  translator TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  age_range TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  channel TEXT NOT NULL DEFAULT '',
  price REAL,
  condition TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  isbn TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  extras TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX books_position_idx ON books (position);

-- One row per uploaded spreadsheet; the file itself is archived in R2.
CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL DEFAULT '',
  book_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL DEFAULT ''
);
