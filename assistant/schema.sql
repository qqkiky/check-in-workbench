-- Encrypted single-owner state. Do not put private content in columns or logs.
CREATE TABLE IF NOT EXISTS assistant_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  ciphertext TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_lease (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
