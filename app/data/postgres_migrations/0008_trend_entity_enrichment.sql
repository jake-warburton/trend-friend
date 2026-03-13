ALTER TABLE trend_entities ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE trend_entities ADD COLUMN why_now_json TEXT NOT NULL DEFAULT '[]';
