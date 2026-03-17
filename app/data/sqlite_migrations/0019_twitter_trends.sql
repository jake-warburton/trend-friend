CREATE TABLE IF NOT EXISTS twitter_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'global',
    woeid INTEGER,
    tweet_volume INTEGER,
    domain_context TEXT,
    grouped_trends TEXT,
    query TEXT,
    url TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_twitter_trends_category
    ON twitter_trends (category, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_twitter_trends_location
    ON twitter_trends (location, fetched_at DESC);
