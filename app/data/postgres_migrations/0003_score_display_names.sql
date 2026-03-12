ALTER TABLE trend_scores
ADD COLUMN IF NOT EXISTS display_name TEXT NULL;

ALTER TABLE trend_score_snapshots
ADD COLUMN IF NOT EXISTS display_name TEXT NULL;
