ALTER TABLE source_ingestion_runs
ADD COLUMN IF NOT EXISTS raw_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE source_ingestion_runs
ADD COLUMN IF NOT EXISTS merged_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE source_ingestion_runs
ADD COLUMN IF NOT EXISTS duplicate_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE source_ingestion_runs
ADD COLUMN IF NOT EXISTS duplicate_topic_rate DOUBLE PRECISION NOT NULL DEFAULT 0;
