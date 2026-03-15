ALTER TABLE trend_scores ADD COLUMN advertising_score REAL NOT NULL DEFAULT 0;

ALTER TABLE trend_score_snapshots ADD COLUMN advertising_score REAL NOT NULL DEFAULT 0;
