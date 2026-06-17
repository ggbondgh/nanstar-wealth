CREATE TABLE IF NOT EXISTS wealth_state (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wealth_state_updated_at
  ON wealth_state (updated_at);
