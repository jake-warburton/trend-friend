CREATE TABLE IF NOT EXISTS trend_entities (
    id BIGSERIAL PRIMARY KEY,
    topic_key TEXT NOT NULL UNIQUE,
    canonical_name TEXT NOT NULL,
    category TEXT NOT NULL,
    meta_trend TEXT NOT NULL,
    stage TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    first_seen_at TEXT NULL,
    last_seen_at TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
