ALTER TABLE pipeline_runs
ADD COLUMN raw_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pipeline_runs
ADD COLUMN merged_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pipeline_runs
ADD COLUMN duplicate_topic_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pipeline_runs
ADD COLUMN duplicate_topic_rate REAL NOT NULL DEFAULT 0;

ALTER TABLE pipeline_runs
ADD COLUMN multi_source_trend_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pipeline_runs
ADD COLUMN low_evidence_trend_count INTEGER NOT NULL DEFAULT 0;
