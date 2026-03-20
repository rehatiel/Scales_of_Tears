-- Admin-editable banner overrides
CREATE TABLE IF NOT EXISTS banners (
  key        TEXT PRIMARY KEY,
  lines      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
