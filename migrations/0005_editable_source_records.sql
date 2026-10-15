CREATE TABLE IF NOT EXISTS facturas_source_changes (
  source_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('vehicle')),
  action TEXT NOT NULL CHECK (action IN ('update', 'delete')),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facturas_source_changes_kind
ON facturas_source_changes(kind);
