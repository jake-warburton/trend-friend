# Architecture Guidelines

This file defines the engineering standards for this project.

The system should be designed for:

- maintainability
- testability
- extensibility
- legibility

A human should be able to read the codebase and reason about it quickly.

The MVP should remain simple, but it must not become messy.

---

# Core Principles

## 1. Prefer Simple Code Over Clever Code

Write code that is obvious.

Avoid:

- clever abstractions
- deep inheritance
- unnecessary metaprogramming
- hidden side effects
- tightly coupled modules

Prefer:

- small functions
- explicit data flow
- clear names
- predictable behavior

A future human reader should understand a module in minutes.

---

## 2. Keep Concerns Separated

Each part of the system should have one clear responsibility.

Recommended boundaries:

- `sources/` = fetch raw data from external systems
- `topics/` = extract and normalize topics
- `scoring/` = compute trend scores
- `data/` = persistence and repositories
- `jobs/` = orchestration and scheduled runs
- `ui/` = presentation only

Do not mix:

- API fetching with scoring logic
- database logic with UI rendering
- topic normalization with scheduling
- source-specific logic with generic business rules

---

## 3. Use Explicit Data Models

Use clear data structures for information passed between modules.

Prefer typed models such as:

- dataclasses
- pydantic models
- typed dictionaries

At minimum define models for:

- raw source item
- normalized signal
- topic aggregate
- trend score result

Example model ideas:

- `RawSourceItem`
- `NormalizedSignal`
- `TopicCluster`
- `TrendScore`

The same concepts should not appear in multiple incompatible shapes.

---

# Recommended Project Structure

```text
trend-intelligence/
  app/
    sources/
      base.py
      google_trends.py
      reddit.py
      github.py
      hacker_news.py
      wikipedia.py

    topics/
      extract.py
      normalize.py
      cluster.py

    scoring/
      weights.py
      calculator.py
      ranking.py

    data/
      models.py
      database.py
      repositories.py

    jobs/
      ingest.py
      compute_scores.py

    ui/
      dashboard.py

    config.py
    logging.py

  tests/
    test_topics.py
    test_scoring.py
    test_sources.py
    test_repositories.py

  scripts/
    run_ingestion.py
    run_dashboard.py

  README.md
  SPEC.md
  TASKS.md
  ARCHITECTURE.md
  .env.example
  requirements.txt

  This structure is preferred because it makes responsibilities easy to find.

Source Adapter Design

Each external source should be isolated behind a small adapter.

Every adapter should:

fetch data

normalize the response into a common internal format

avoid leaking source-specific details outside the adapter

Each adapter should expose a minimal interface like:

fetch() -> list[RawSourceItem]

or

fetch_trends() -> list[NormalizedSignal]

Adapters should not:

write directly to the UI

compute final trend scores

contain unrelated business logic

If a source breaks or changes, fixes should stay mostly inside that adapter.

Topic Pipeline Design

Topic extraction should be a pipeline with small steps.

Suggested flow:

clean text

tokenize

remove stop words

normalize casing

merge obvious duplicates

cluster similar topics

Each step should be implemented as a small function.

This makes it easier to:

test each step

swap strategies later

inspect where errors come from

Avoid one giant “magic” topic extraction function.

Scoring Design

Scoring should be transparent and inspectable.

The score must be explainable.

Given a topic, a human should be able to answer:

why did this topic rank highly?

which signals contributed most?

what weights were used?

Scoring logic should therefore:

live in one clear module

use explicit weights

produce component-level outputs, not just one opaque number

Preferred design:

raw metrics in

weighted component scores out

final score derived from components

Example output shape:

topic

search_score

social_score

developer_score

knowledge_score

total_score

This is much better than returning only 87.3.

Persistence Design

Keep storage simple.

Use SQLite for MVP.

Hide SQL and persistence details behind repository functions.

Examples:

save_signals(signals)

load_recent_signals()

save_trend_scores(scores)

get_top_trends(limit=20)

Business logic should not contain raw SQL queries everywhere.

This improves:

readability

testability

portability

UI Design

The UI should be thin.

The UI should:

read already-computed results

render tables or charts

avoid containing business logic

Do not compute trend scores in the UI layer.

Do not fetch external APIs directly from the UI.

The UI is for presentation, not intelligence.

Configuration Rules

All configurable values should live in one place.

Examples:

API keys

polling intervals

score weights

source enable/disable flags

database path

Put these in:

config.py

.env

Do not scatter constants across the codebase.

A reader should be able to understand runtime behavior from one config module.

Logging Rules

Use structured, minimal logging.

Log:

job start/end

source fetch success/failure

records fetched

scoring completion

major errors

Do not log excessively.

Logs should help answer:

what ran?

what failed?

where did bad data come from?

Error Handling Rules

Handle failures gracefully.

A single failing source should not crash the whole system.

Preferred behavior:

log the failure

continue with other sources

mark the source as failed in run metadata if useful

External APIs are unreliable.
Design for partial success.

Testing Strategy

Tests are required for core logic.

Priority test coverage:

Must Test

topic normalization

duplicate merging

scoring calculations

ranking order

repository read/write behavior

Should Test

source adapter normalization

error handling for malformed source data

Can Be Light

UI rendering

Focus tests on deterministic logic.

Avoid fragile tests that depend on live external APIs.

Use fixtures and sample responses for source adapters.

Testing Rules
1. Prefer Unit Tests for Business Logic

Unit test:

scoring

topic extraction

normalization

ranking

These modules should be easy to test without network calls.

2. Minimize Live API Tests

Do not rely heavily on real-time API responses in automated tests.

Instead:

store sample payloads

test normalization logic using fixtures

mock network calls

3. Test for Explainability

Include tests that verify scoring outputs contain enough detail to explain ranking.

Example:

total score exists

component scores exist

source evidence exists

Extensibility Rules

The codebase should make new sources easy to add.

Adding a new source should ideally require:

creating one new adapter file

mapping source data into the shared model

registering the adapter

It should not require rewriting the scoring or UI architecture.

Similarly, new scoring factors should be addable without rewriting unrelated modules.

Legibility Rules

Optimize for human understanding.

Use:

descriptive names

short files

short functions

docstrings on public functions

comments only where they add real value

Avoid:

vague names like process_data, handle_items, utils

giant utility files

functions longer than necessary

nested logic that is hard to scan

Good names are part of the architecture.

Naming Guidance

Prefer names like:

fetch_reddit_posts

normalize_topic_name

calculate_trend_score

rank_topics

save_signals

load_recent_scores

Avoid names like:

run

do_work

helper

misc

process

The code should read like a system description.

Dependency Rules

Keep dependencies minimal.

Before adding a package, ask:

does the standard library already handle this?

is this dependency reducing complexity meaningfully?

will this make the code harder to understand?

For MVP, prefer a smaller stack over a trendy stack.

Function Design Rules

Functions should:

do one thing

have explicit inputs

return explicit outputs

avoid hidden mutation where possible

Prefer pure functions for:

normalization

scoring

ranking

topic grouping

Pure functions are easier to test and reason about.

Documentation Rules

The repo should explain itself.

At minimum document:

how data flows through the system

where to add a new source

how scoring works

how to run tests

how to run ingestion

how to run the dashboard

A new developer should not need to reverse-engineer the architecture.

Code Review Standard

Every module should be understandable by a careful human reader.

Before accepting code, ask:

is this the simplest version that works?

can a human trace the data flow?

are responsibilities clear?

is this easy to test?

would adding a new source be straightforward?

are errors handled safely?

are names specific and descriptive?

If not, simplify.

Final Architectural Goal

The system should feel like a small, clean analytical engine.

It should be:

easy to run

easy to inspect

easy to test

easy to extend

easy to trust

The human reader must be able to reason about:

what the system is doing

why it produced a result

where to change behavior

how to add new capabilities
```
