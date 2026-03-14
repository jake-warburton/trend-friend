CREATE TABLE IF NOT EXISTS trend_aliases (
    id BIGSERIAL PRIMARY KEY,
    topic_key TEXT NOT NULL,
    alias TEXT NOT NULL,
    UNIQUE (topic_key, alias)
);

CREATE TABLE IF NOT EXISTS trend_relationships (
    id BIGSERIAL PRIMARY KEY,
    topic_key TEXT NOT NULL,
    related_topic_key TEXT NOT NULL,
    strength DOUBLE PRECISION NOT NULL DEFAULT 0,
    UNIQUE (topic_key, related_topic_key)
);
