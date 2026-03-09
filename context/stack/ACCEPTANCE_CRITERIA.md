# Acceptance Criteria

This file defines the minimum standard for considering the MVP complete.

The purpose is to prevent partial implementation and ensure the system is:

- functional
- understandable
- testable
- maintainable

The project is only complete when the criteria below are met.

---

# 1. Core Product Acceptance Criteria

## 1.1 Trend Ingestion Works

The system must successfully ingest data from at least 3 free sources.

Preferred sources:

- Google Trends
- Reddit
- GitHub
- Hacker News
- Wikipedia Pageviews

### Done when:

- at least 3 source adapters are implemented
- each adapter returns normalized data in the shared internal format
- ingestion can run locally without paid services
- source failures do not crash the full ingestion pipeline

---

## 1.2 Topic Extraction Works

The system must extract and normalize candidate topics from ingested data.

### Done when:

- text is cleaned and normalized
- obvious duplicates are merged
- common stop words are removed
- extracted topics are usable in ranking output

This does not need to be perfect, but it must be functional and inspectable.

---

## 1.3 Trend Scoring Works

The system must compute a transparent momentum score for topics.

### Done when:

- each topic receives a total score
- the total score is composed of explicit score components
- at least 2–3 signal types contribute to scoring
- score logic is readable and configurable

A human must be able to inspect a result and understand why it ranked highly.

---

## 1.4 Trend Ranking Works

The system must produce a ranked list of topics.

### Done when:

- topics are sorted by score
- ordering is deterministic
- ties are handled consistently
- at least the top 10 trends can be displayed

---

## 1.5 Dashboard or Readable Output Exists

The system must display results in a usable format.

Acceptable options:

- simple web dashboard
- Streamlit app
- CLI table output

### Done when:

- top trends are visible
- total score is shown
- component scores or evidence are shown
- last updated time is shown

The UI may be minimal, but it must be usable.

---

# 2. Architecture Acceptance Criteria

## 2.1 Clear Separation of Concerns

The codebase must separate:

- source ingestion
- topic extraction
- scoring
- persistence
- presentation

### Done when:

- source-specific code lives in `sources/`
- topic logic lives in `topics/`
- scoring logic lives in `scoring/`
- persistence logic lives in `data/`
- presentation logic lives in `ui/`

---

## 2.2 Shared Data Models Exist

The codebase must use explicit shared data models.

### Done when:

- core entities are represented with typed models
- the same concept is not passed around in inconsistent shapes
- public functions have clear typed inputs and outputs

Preferred examples:

- `RawSourceItem`
- `NormalizedSignal`
- `TopicAggregate`
- `TrendScoreResult`

---

## 2.3 Config Is Centralized

Runtime behavior must be configurable from one place.

### Done when:

- environment variables are documented
- `.env.example` exists
- key runtime values are centralized in config
- no important constants are scattered across random files

---

# 3. Maintainability Acceptance Criteria

## 3.1 Code Is Readable

The code must be easy for a human to reason about.

### Done when:

- names are specific and descriptive
- functions are small and focused
- files are reasonably scoped
- responsibilities are easy to locate
- no giant mixed-purpose modules exist

---

## 3.2 Code Avoids Overengineering

The MVP must stay simple.

### Done when:

- there is no unnecessary framework complexity
- there are no premature abstractions
- there are no unnecessary layers
- dependencies are minimal and justified

---

## 3.3 New Sources Are Easy to Add

The architecture must be extensible.

### Done when:

- adding a new source mostly means adding one adapter module
- new sources map into the shared model
- existing scoring and UI layers do not need major rewrites for new sources

---

# 4. Testability Acceptance Criteria

## 4.1 Core Logic Is Tested

Tests must exist for the deterministic core of the system.

### Must-have tests:

- topic normalization
- duplicate merging
- score calculation
- topic ranking
- repository read/write behavior

### Done when:

- tests run locally
- tests do not rely on live external APIs
- sample payloads or mocks are used where appropriate

---

## 4.2 Source Normalization Is Tested

At least some source adapters must have normalization tests.

### Done when:

- sample source payloads are used
- adapter output matches shared internal models
- malformed data is handled safely

---

## 4.3 Tests Are Readable

The tests should help a human understand expected behavior.

### Done when:

- test names are explicit
- each test checks one main behavior
- tests are small and deterministic

---

# 5. Developer Experience Acceptance Criteria

## 5.1 README Is Complete

The project must include a useful README.

### README must explain:

- what the system does
- how to install dependencies
- how to configure environment variables
- how to run ingestion
- how to run the dashboard
- how to run tests
- how to add a new source
- how scoring works at a high level

### Done when:

- a new developer can run the project without guessing

---

## 5.2 Local Run Path Is Simple

The MVP must be easy to run locally.

### Done when:

- setup steps are minimal
- commands are documented
- common failure points are explained briefly
- there is a clear happy path from clone to running system

---

## 5.3 Fallback Behavior Exists

The project should still be demonstrable if a source is temporarily unavailable.

### Done when:

- sample data, fixtures, or mock fallback exists for at least part of the system
- the UI can still demonstrate ranking behavior without requiring perfect live API access

---

# 6. Output Quality Acceptance Criteria

## 6.1 Results Are Explainable

Trend results must not be opaque.

### Done when each trend result includes:

- topic name
- total score
- component scores or signal breakdown
- source evidence or metrics
- last updated timestamp

A user should be able to answer:

- why is this trending?
- what signals drove it?
- when was this computed?

---

## 6.2 Results Are Plausible

The output should look reasonable to a human reviewer.

### Done when:

- rankings are not obviously nonsensical
- duplicate topics are reduced
- component signals align with final ranking
- results are stable between runs unless source data changes

Perfect accuracy is not required for MVP, but outputs must be credible.

---

# 7. Non-Goal Acceptance Criteria

The MVP must not accidentally expand into a larger product.

The following should not be required for completion:

- authentication
- billing
- enterprise roles
- advanced ML
- distributed architecture
- paid APIs
- heavy cloud infrastructure

If these appear, they should be clearly optional and not block the MVP.

---

# 8. Definition of Done

The MVP is done when all of the following are true:

- at least 3 free data sources are ingested
- topics are extracted and normalized
- trend scores are computed transparently
- top trends are ranked deterministically
- results are displayed in a simple usable interface
- core logic has automated tests
- README explains setup and usage
- `.env.example` exists
- architecture is clean enough for a human to reason about quickly

If any of these are missing, the MVP is not done.

---

# 9. Final Review Questions

Before considering the project complete, answer yes to all of these:

- Can I run it locally without paid services?
- Can I see a ranked list of trends?
- Can I tell why a topic ranked highly?
- Can I read the code and understand the flow?
- Can I run tests successfully?
- Can I add a new source without rewriting the system?
- Can another developer understand the project from the README?

If any answer is no, the work is incomplete.
