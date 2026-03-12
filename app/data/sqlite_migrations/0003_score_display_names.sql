ALTER TABLE trend_scores
ADD COLUMN display_name TEXT NULL;

ALTER TABLE trend_score_snapshots
ADD COLUMN display_name TEXT NULL;
