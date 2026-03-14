CREATE TABLE IF NOT EXISTS trend_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_key TEXT NOT NULL,
    alias TEXT NOT NULL,
    UNIQUE (topic_key, alias)
);

CREATE TABLE IF NOT EXISTS trend_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_key TEXT NOT NULL,
    related_topic_key TEXT NOT NULL,
    strength REAL NOT NULL DEFAULT 0,
    UNIQUE (topic_key, related_topic_key)
);
