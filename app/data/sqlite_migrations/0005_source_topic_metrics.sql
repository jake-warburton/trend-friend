ALTER TABLE source_ingestion_runs
ADD COLUMN raw_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE source_ingestion_runs
ADD COLUMN merged_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE source_ingestion_runs
ADD COLUMN duplicate_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE source_ingestion_runs
ADD COLUMN duplicate_topic_rate REAL NOT NULL DEFAULT 0;
