CREATE TABLE IF NOT EXISTS source_family_snapshots (
    id BIGSERIAL PRIMARY KEY,
    family TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    source_count INTEGER NOT NULL,
    healthy_source_count INTEGER NOT NULL,
    signal_count INTEGER NOT NULL,
    trend_count INTEGER NOT NULL,
    corroborated_trend_count INTEGER NOT NULL DEFAULT 0,
    top_ranked_trend_count INTEGER NOT NULL DEFAULT 0,
    average_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    average_yield_rate_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
    success_rate_percent DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_source_family_snapshots_family_captured_at
ON source_family_snapshots (family, captured_at DESC);
