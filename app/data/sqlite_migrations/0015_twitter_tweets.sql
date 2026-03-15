CREATE TABLE IF NOT EXISTS twitter_tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_handle TEXT NOT NULL,
    tweet_id TEXT UNIQUE NOT NULL,
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    engagement REAL NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_account_ts
    ON twitter_tweets (account_handle, timestamp DESC);
