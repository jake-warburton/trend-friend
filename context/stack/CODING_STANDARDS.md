# Coding Standards

This file defines implementation standards for the project.

The goal is to keep the codebase:

- readable
- predictable
- easy to test
- easy to change
- easy to review

This project should optimize for **human understanding first**.

---

# Primary Rule

Write code so that a careful human can understand it quickly.

When choosing between:

- shorter vs clearer
- clever vs obvious
- abstract vs explicit

Choose:

- clearer
- more obvious
- more explicit

---

# 1. File Size and Module Boundaries

Keep files reasonably small.

Guidelines:

- prefer files under 300 lines
- split files before they become hard to scan
- each module should have one main purpose

Good examples:

- one file for reddit adapter
- one file for score calculation
- one file for ranking
- one file for topic normalization

Bad examples:

- one giant `utils.py`
- one file mixing API calls, DB writes, and scoring

---

# 2. Function Design

Functions should be small and focused.

Each function should:

- do one thing
- have a clear name
- have explicit inputs
- return explicit outputs
- avoid hidden side effects when possible

Guidelines:

- prefer functions under 40 lines
- refactor deeply nested logic into helper functions
- avoid long parameter lists unless justified

Prefer:

- `fetch_reddit_posts()`
- `normalize_topic_name()`
- `calculate_component_scores()`
- `rank_topics_by_score()`

Avoid:

- `process()`
- `run()`
- `handle_data()`
- `do_everything()`

---

# 3. Naming Standards

Names must be specific.

## Variables

Use names that describe meaning, not implementation detail.

Prefer:

- `topic_name`
- `recent_mentions`
- `baseline_pageviews`
- `component_scores`
- `normalized_signals`

Avoid:

- `data`
- `value`
- `item`
- `obj`
- `temp`

## Functions

Function names should describe an action.

Prefer:

- `fetch_hacker_news_items`
- `extract_candidate_topics`
- `merge_similar_topics`
- `save_trend_scores`

Avoid:

- `work`
- `process_stuff`
- `helper_function`
- `handle`

## Classes

Class names should describe a concept.

Prefer:

- `RedditSourceAdapter`
- `TrendScoreCalculator`
- `SignalRepository`

Avoid:

- `Manager`
- `Processor`
- `Helper`
- `Util`

---

# 4. Type Hints

Use type hints everywhere practical.

All public functions should include:

- parameter types
- return types

Example:

```python
def calculate_trend_score(signals: list[NormalizedSignal]) -> TrendScore:
    ...
```

Why:

improves readability

improves editor support

makes refactoring safer

makes tests easier to reason about

If using Python, prefer modern built-in generic syntax where available.

5. Data Structures

Use explicit data models.

Do not pass around loose dictionaries when a real model would make the code clearer.

Prefer:

dataclasses

pydantic models

typed dictionaries

Recommended shared models:

RawSourceItem

NormalizedSignal

TopicAggregate

TrendScoreResult

The same concept should not have multiple inconsistent shapes across modules.

6. Docstrings

Add docstrings to:

public functions

public classes

modules where the purpose is not obvious

Docstrings should explain:

what the function does

key inputs

key outputs

important side effects

Docstrings should not repeat the function name.

Good example:

def rank_topics(scores: list[TrendScoreResult], limit: int = 20) -> list[TrendScoreResult]:
"""Return the highest scoring topics in descending order."""

Avoid long, noisy docstrings for trivial private helpers.

7. Comments

Use comments sparingly.

Comments should explain:

why something is done

non-obvious tradeoffs

external API quirks

temporary workarounds

Comments should not narrate obvious code.

Good:

explain why a Reddit metric is normalized a certain way

explain why a source adapter falls back to mock data

Bad:

# increment i

# fetch data

# return result

If code needs too many comments to be understandable, simplify the code.

8. Error Handling

Handle errors explicitly.

Do not swallow exceptions silently.

For external systems:

catch expected network and parsing failures

log useful context

return safe fallback behavior where appropriate

For internal logic:

fail loudly on invalid assumptions

validate required data early

Prefer:

try:
response = client.get(...)
except RequestException as error:
logger.warning("Reddit fetch failed: %s", error)
return []

Avoid:

broad except Exception without justification

empty except blocks

hidden fallback behavior without logging

9. Logging

Use logging to support debugging and operations.

Log:

start and end of ingestion jobs

source success/failure

number of records fetched

number of topics ranked

major scoring events

recoverable failures

Do not:

log every tiny step

log secrets

log excessively noisy debug output by default

Logs should help a human answer:

what happened?

what failed?

what data was processed?

10. Configuration

Keep configuration centralized.

Use:

.env

config.py

Configuration should include:

API keys

source toggles

polling intervals

scoring weights

database path

environment flags

Do not scatter constants across the codebase.

A human should be able to inspect one config area and understand runtime behavior.

11. Dependency Management

Minimize dependencies.

Before adding a package, ask:

is it necessary?

does it reduce complexity?

does the standard library already cover this?

will another developer understand why it exists?

Avoid adding libraries for trivial conveniences.

Prefer stable, well-known libraries over niche ones.

12. Testing Philosophy

Tests should make the system easier to trust.

Focus test coverage on:

topic normalization

topic merging

trend scoring

ranking

repository behavior

adapter normalization

Tests should be:

small

deterministic

easy to read

independent

Avoid tests that rely on live external APIs.

Use:

fixtures

mock responses

sample payloads

13. Test Structure

Each test should verify one behavior.

Prefer:

test_normalize_topic_lowercases_text

test_merge_topics_combines_simple_duplicates

test_calculate_trend_score_returns_component_scores

test_rank_topics_orders_by_total_score_descending

Avoid:

giant tests covering five behaviors

vague test names

hidden setup

Organize tests to mirror the app structure.

Example:

tests/
test_topics_extract.py
test_topics_normalize.py
test_scoring_calculator.py
test_scoring_ranking.py
test_sources_reddit.py
test_data_repositories.py 14. Pure Functions First

Prefer pure functions for logic-heavy code.

Use pure functions for:

text normalization

deduplication

score calculation

ranking

metric transformation

Benefits:

easier to test

easier to reason about

easier to reuse

fewer hidden bugs

Push side effects to the edges:

network access

file access

database writes

UI rendering

15. Avoid Utility Dump Files

Do not create vague shared modules like:

utils.py

helpers.py

common.py

Unless they are genuinely focused and small.

If code is shared, place it near the domain it belongs to.

Prefer:

topics/text_cleaning.py

scoring/weights.py

sources/http_client.py

This makes the codebase easier to navigate.

16. Keep Business Logic Out of the UI

The UI should only present information.

Do not place in the UI:

source fetching logic

scoring logic

topic clustering logic

raw SQL queries

The UI may:

call service functions

display tables

render charts

display metadata

This keeps the system easier to test and reason about.

17. Keep SQL and Persistence Isolated

Database logic should live behind repository functions.

Prefer:

save_signals(signals)

get_recent_signals(hours=24)

save_trend_scores(scores)

get_top_trends(limit=20)

Avoid inline SQL in unrelated modules.

This allows:

simpler testing

easier refactoring

clearer ownership of persistence behavior

18. External API Rules

Each source adapter should isolate source-specific behavior.

Adapters should:

fetch data

parse data

map into shared models

handle API-specific failure cases

Adapters should not:

compute final scores

render UI

write directly to unrelated systems unless explicitly part of ingestion flow

If an external API changes, the fix should mostly stay inside its adapter.

19. Maintainability Checks

Before finalizing any module, ask:

is the responsibility clear?

are the names specific?

is there hidden coupling?

can I test this without network calls?

could a new developer understand this quickly?

would I know where to add a new feature?

If not, simplify.

20. Extensibility Rules

The code should be easy to extend.

Adding a new source

Should require:

a new adapter

mapping into shared models

registration in ingestion flow

It should not require major changes elsewhere.

Adding a new score factor

Should require:

adding a metric

adjusting weights

updating score explanation output

It should not require rewriting the architecture.

21. Readability Over DRY

Do not over-abstract just to reduce duplication.

Some duplication is acceptable if it keeps code clearer.

Avoid abstracting too early.

Prefer duplication over confusing “generic” frameworks.

Only extract shared code when:

the shared behavior is truly stable

the abstraction makes the code easier to understand

22. One Level of Abstraction Per Function

Try to keep each function operating at one conceptual level.

Bad example:

a function that both parses raw JSON, computes scores, and writes SQL

Better:

parse JSON

normalize signals

compute scores

persist results

This makes debugging and review easier.

23. Return Rich Results for Explainability

When producing rankings or scores, do not return only a single opaque number.

Prefer structured outputs like:

topic

total_score

search_score

social_score

developer_score

evidence

last_updated

This improves:

debugging

trust

UX

future explainability

24. Default to Deterministic Behavior

Avoid unnecessary randomness.

For ranking, sorting, and grouping:

use stable ordering

define tiebreakers explicitly

keep outputs reproducible

This helps both debugging and tests.

25. README and Developer Experience

The repository should be easy to pick up.

README should clearly explain:

what the system does

how to run it locally

how to run tests

how data flows through the system

how to add a new source

how scoring works at a high level

A new developer should not need to guess where things belong.

26. Refactoring Rule

When code becomes hard to understand:

stop adding features

refactor first

Signs refactoring is needed:

repeated confusion while reading

long functions

vague naming

mixed responsibilities

brittle tests

hard-to-trace data flow

The MVP should stay small and clean.

27. Final Standard

This codebase should feel like a clean analytical engine.

A careful human should be able to understand:

where data comes from

how it is normalized

how scores are computed

where results are stored

how the dashboard reads them

how to add a new signal source

That is the standard.
