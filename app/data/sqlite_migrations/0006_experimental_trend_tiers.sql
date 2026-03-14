ALTER TABLE trend_scores
ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1;

ALTER TABLE trend_score_snapshots
ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1;
