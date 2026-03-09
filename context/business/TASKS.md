# Build Tasks for Codex

Follow these steps in order.

Do not skip steps.

Prefer simple implementations over complex ones.

---

# Phase 1 — Project Setup

Create a minimal project structure.

Example structure:

/trend-intelligence
/sources
/topics
/scoring
/jobs
/ui
/data
main.py
requirements.txt
README.md
.env.example

Use Python unless another language is significantly simpler.

---

# Phase 2 — Data Source Adapters

Implement adapters for the following sources.

Each adapter should return normalized data objects.

Sources:

Google Trends
Reddit
GitHub
Hacker News
Wikipedia Pageviews

Adapters should return:

topic
timestamp
source
engagement metrics

Place adapters in:

/sources

---

# Phase 3 — Topic Extraction

Create a module that:

- extracts keywords from titles
- normalizes text
- removes stop words
- groups similar phrases

Place this logic in:

/topics

---

# Phase 4 — Trend Scoring

Create a simple scoring algorithm.

Example structure:

trend_score =
(search_growth \* weight)

- (mention_growth \* weight)
- (activity_growth \* weight)

Keep scoring modular and configurable.

Place logic in:

/scoring

---

# Phase 5 — Data Storage

Store collected signals and scores.

Use a lightweight option:

SQLite preferred.

Schema should store:

topic
source
metric
timestamp
score

---

# Phase 6 — Trend Ranking

Generate a ranked list of topics by score.

Output:

- top trends
- signals contributing to score
- timestamp

---

# Phase 7 — Dashboard

Build a simple UI.

Acceptable options:

Streamlit
Flask
Next.js
CLI output

Minimum requirements:

- top trends list
- trend score
- signal breakdown

---

# Phase 8 — Scheduled Jobs

Implement scheduled ingestion.

Possible methods:

cron
simple scheduler loop

Collection frequency:

every 30–60 minutes

---

# Development Rules

When implementing:

Prefer working code over perfect architecture.

Avoid unnecessary dependencies.

Keep modules small and readable.

Document assumptions in README.

---

# Output Requirements

The final project must include:

working MVP
clear README
.env.example
sample data fallback if APIs fail
simple dashboard
modular code

---

# Completion Criteria

The project is complete when:

signals are ingested
topics are extracted
trend scores are computed
top trends are displayed

The system must run locally using only free data sources.
