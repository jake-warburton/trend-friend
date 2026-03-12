CREATE TABLE IF NOT EXISTS published_payloads (
    payload_key TEXT PRIMARY KEY,
    generated_at TIMESTAMPTZ NOT NULL,
    payload_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
