CREATE TABLE IF NOT EXISTS trend_metric_snapshots (
    topic_key TEXT NOT NULL REFERENCES trend_entities (topic_key) ON DELETE CASCADE,
    source TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    label TEXT NOT NULL,
    value_numeric DOUBLE PRECISION NOT NULL DEFAULT 0,
    value_display TEXT NOT NULL,
    unit TEXT NOT NULL,
    period TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    provenance_url TEXT NULL,
    is_estimated INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (topic_key, source, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_trend_metric_snapshots_topic_key
    ON trend_metric_snapshots (topic_key, captured_at DESC);
