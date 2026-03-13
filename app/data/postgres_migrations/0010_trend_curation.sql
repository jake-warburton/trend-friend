CREATE TABLE IF NOT EXISTS trend_curation_overrides (
    id BIGSERIAL PRIMARY KEY,
    topic_key TEXT NOT NULL,
    suppress BOOLEAN NOT NULL DEFAULT FALSE,
    canonical_topic_key TEXT NULL,
    preferred_name TEXT NULL,
    preferred_meta_trend TEXT NULL,
    preferred_stage TEXT NULL,
    preferred_summary TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (topic_key)
);

CREATE TABLE IF NOT EXISTS trend_duplicate_candidates (
    id BIGSERIAL PRIMARY KEY,
    topic_key TEXT NOT NULL,
    duplicate_topic_key TEXT NOT NULL,
    similarity DOUBLE PRECISION NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    UNIQUE (topic_key, duplicate_topic_key)
);
