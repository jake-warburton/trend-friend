CREATE TABLE IF NOT EXISTS twitter_tweets (
    id SERIAL PRIMARY KEY,
    account_handle TEXT NOT NULL,
    tweet_id TEXT UNIQUE NOT NULL,
    text TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    engagement DOUBLE PRECISION NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_account_ts
    ON twitter_tweets (account_handle, timestamp DESC);
