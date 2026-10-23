CREATE TABLE IF NOT EXISTS facturas_invoice_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER REFERENCES facturas_entries(id) ON DELETE SET NULL,
  sha256 TEXT NOT NULL UNIQUE,
  invoice_number TEXT,
  provider TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Agua', 'Luz', 'Calefacción')),
  property TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  original_name TEXT NOT NULL,
  archive_name TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  storage_status TEXT NOT NULL CHECK (storage_status IN ('uploaded', 'skipped_local')),
  extraction TEXT NOT NULL CHECK (json_valid(extraction)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facturas_invoice_documents_entry
ON facturas_invoice_documents(entry_id);

CREATE INDEX IF NOT EXISTS idx_facturas_invoice_documents_period
ON facturas_invoice_documents(property, category, start_date, end_date);
