CREATE TABLE IF NOT EXISTS trend_theses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    lens TEXT NOT NULL DEFAULT 'all',
    keyword_query TEXT NULL,
    source TEXT NULL,
    category TEXT NULL,
    stage TEXT NULL,
    confidence TEXT NULL,
    meta_trend TEXT NULL,
    audience TEXT NULL,
    market TEXT NULL,
    language TEXT NULL,
    geo_country TEXT NULL,
    minimum_score REAL NOT NULL DEFAULT 0,
    hide_recurring INTEGER NOT NULL DEFAULT 0,
    notify_on_match INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trend_theses_watchlist_name
    ON trend_theses (watchlist_id, name);

CREATE TABLE IF NOT EXISTS trend_thesis_matches (
    thesis_id INTEGER NOT NULL,
    trend_id TEXT NOT NULL,
    trend_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    first_matched_at TEXT NOT NULL,
    last_matched_at TEXT NOT NULL,
    lens_score REAL NOT NULL DEFAULT 0,
    total_score REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (thesis_id, trend_id),
    FOREIGN KEY (thesis_id) REFERENCES trend_theses (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trend_thesis_matches_active
    ON trend_thesis_matches (thesis_id, active, last_matched_at DESC);

ALTER TABLE alert_rules ADD COLUMN thesis_id INTEGER NULL REFERENCES trend_theses (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_rules_thesis_id
    ON alert_rules (thesis_id)
    WHERE thesis_id IS NOT NULL;
