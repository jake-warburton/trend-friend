CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    source TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    value REAL NOT NULL,
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
    geo_confidence REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS source_ingestion_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    total_score REAL NOT NULL,
    search_score REAL NOT NULL,
    social_score REAL NOT NULL,
    developer_score REAL NOT NULL,
    knowledge_score REAL NOT NULL,
    diversity_score REAL NOT NULL,
    source_counts_json TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    latest_timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trend_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    captured_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    captured_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    source_count INTEGER NOT NULL,
    successful_source_count INTEGER NOT NULL,
    failed_source_count INTEGER NOT NULL,
    signal_count INTEGER NOT NULL,
    ranked_trend_count INTEGER NOT NULL,
    top_topic TEXT NULL,
    top_score REAL NULL
);

CREATE TABLE IF NOT EXISTS trend_score_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    rank_position INTEGER NOT NULL,
    topic TEXT NOT NULL,
    total_score REAL NOT NULL,
    search_score REAL NOT NULL,
    social_score REAL NOT NULL,
    developer_score REAL NOT NULL,
    knowledge_score REAL NOT NULL,
    diversity_score REAL NOT NULL,
    source_counts_json TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    latest_timestamp TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES trend_runs (id)
);

CREATE TABLE IF NOT EXISTS watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_user_id INTEGER NULL,
    default_share_duration_days INTEGER NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER NOT NULL,
    trend_id TEXT NOT NULL,
    trend_name TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (watchlist_id, trend_id),
    FOREIGN KEY (watchlist_id) REFERENCES watchlists (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    created_by INTEGER NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    show_creator INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS watchlist_share_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id INTEGER NULL,
    watchlist_id INTEGER NOT NULL,
    actor_user_id INTEGER NULL,
    event_type TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (share_id) REFERENCES watchlist_shares (id) ON DELETE SET NULL,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists (id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS watchlist_share_daily_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id INTEGER NOT NULL,
    access_date TEXT NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (share_id, access_date),
    FOREIGN KEY (share_id) REFERENCES watchlist_shares (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    threshold REAL NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlists_owner_name ON watchlists (owner_user_id, name);

CREATE TABLE IF NOT EXISTS alert_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    watchlist_id INTEGER NOT NULL,
    trend_id TEXT NOT NULL,
    trend_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    threshold REAL NOT NULL,
    current_value REAL NOT NULL,
    message TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (rule_id) REFERENCES alert_rules (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NULL,
    channel_type TEXT NOT NULL,
    destination TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    sent_at TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status_code INTEGER NULL,
    error TEXT NULL,
    FOREIGN KEY (channel_id) REFERENCES notification_channels (id) ON DELETE CASCADE
);
