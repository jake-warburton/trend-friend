CREATE TABLE IF NOT EXISTS signals (
    id BIGSERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    source TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    timestamp TEXT NOT NULL,
    evidence TEXT NOT NULL,
    evidence_url TEXT NULL,
    language_code TEXT NULL,
    audience_flags_json TEXT NOT NULL DEFAULT '[]',
    market_flags_json TEXT NOT NULL DEFAULT '[]',
    geo_flags_json TEXT NOT NULL DEFAULT '[]',
    geo_country_code TEXT NULL,
    geo_region TEXT NULL,
    geo_detection_mode TEXT NOT NULL DEFAULT 'unknown',
    geo_confidence DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS source_ingestion_runs (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    success INTEGER NOT NULL,
    raw_item_count INTEGER NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL,
    kept_item_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    used_fallback INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NULL
);

CREATE TABLE IF NOT EXISTS trend_scores (
    id BIGSERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    total_score DOUBLE PRECISION NOT NULL,
    search_score DOUBLE PRECISION NOT NULL,
    social_score DOUBLE PRECISION NOT NULL,
    developer_score DOUBLE PRECISION NOT NULL,
    knowledge_score DOUBLE PRECISION NOT NULL,
    diversity_score DOUBLE PRECISION NOT NULL,
    source_counts_json TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    latest_timestamp TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trend_runs (
    id BIGSERIAL PRIMARY KEY,
    captured_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id BIGSERIAL PRIMARY KEY,
    captured_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    source_count INTEGER NOT NULL,
    successful_source_count INTEGER NOT NULL,
    failed_source_count INTEGER NOT NULL,
    signal_count INTEGER NOT NULL,
    ranked_trend_count INTEGER NOT NULL,
    top_topic TEXT NULL,
    top_score DOUBLE PRECISION NULL
);

CREATE TABLE IF NOT EXISTS trend_score_snapshots (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES trend_runs (id),
    rank_position INTEGER NOT NULL,
    topic TEXT NOT NULL,
    total_score DOUBLE PRECISION NOT NULL,
    search_score DOUBLE PRECISION NOT NULL,
    social_score DOUBLE PRECISION NOT NULL,
    developer_score DOUBLE PRECISION NOT NULL,
    knowledge_score DOUBLE PRECISION NOT NULL,
    diversity_score DOUBLE PRECISION NOT NULL,
    source_counts_json TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    latest_timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlists (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner_user_id BIGINT NULL REFERENCES users (id) ON DELETE CASCADE,
    default_share_duration_days INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    id BIGSERIAL PRIMARY KEY,
    watchlist_id BIGINT NOT NULL REFERENCES watchlists (id) ON DELETE CASCADE,
    trend_id TEXT NOT NULL,
    trend_name TEXT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (watchlist_id, trend_id)
);

CREATE TABLE IF NOT EXISTS watchlist_shares (
    id BIGSERIAL PRIMARY KEY,
    watchlist_id BIGINT NOT NULL REFERENCES watchlists (id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    created_by BIGINT NULL REFERENCES users (id),
    is_public INTEGER NOT NULL DEFAULT 0,
    show_creator INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlist_share_events (
    id BIGSERIAL PRIMARY KEY,
    share_id BIGINT NULL REFERENCES watchlist_shares (id) ON DELETE SET NULL,
    watchlist_id BIGINT NOT NULL REFERENCES watchlists (id) ON DELETE CASCADE,
    actor_user_id BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlist_share_daily_access (
    id BIGSERIAL PRIMARY KEY,
    share_id BIGINT NOT NULL REFERENCES watchlist_shares (id) ON DELETE CASCADE,
    access_date TEXT NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (share_id, access_date)
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id BIGSERIAL PRIMARY KEY,
    watchlist_id BIGINT NOT NULL REFERENCES watchlists (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alert_events (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES alert_rules (id) ON DELETE CASCADE,
    watchlist_id BIGINT NOT NULL,
    trend_id TEXT NOT NULL,
    trend_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    current_value DOUBLE PRECISION NOT NULL,
    message TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notification_channels (
    id BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT NULL REFERENCES users (id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL,
    destination TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_log (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT NOT NULL REFERENCES notification_channels (id) ON DELETE CASCADE,
    sent_at TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status_code INTEGER NULL,
    error TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlists_owner_name ON watchlists (owner_user_id, name);
