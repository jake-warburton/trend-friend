# Working Prompt for the Coding Agent

You are implementing this project as a coding agent.

Read and follow these files in full:

- `SPEC.md`
- `TASKS.md`
- `ARCHITECTURE.md`
- `CODING_STANDARDS.md`
- `ACCEPTANCE_CRITERIA.md`

This file defines how you should behave while doing the work.

Your job is to produce a **working MVP**, not just a scaffold.

The result must be:

- maintainable
- testable
- extensible
- legible

A human must be able to read the code and reason about it.

---

# Mission

Build a practical MVP of a **global trend intelligence tool** that uses **free data sources** to identify emerging topics based on momentum.

The MVP must:

- ingest signals from free sources
- extract and normalize topics
- compute transparent trend scores
- rank topics deterministically
- display the results in a simple usable interface
- run locally
- be easy to understand and extend

Do not optimize for novelty.
Optimize for a clean, working, understandable system.

---

# General Working Behavior

## 1. Finish End-to-End

Do not stop after:

- scaffolding files
- creating placeholders
- writing TODOs
- building only the UI
- building only adapters
- generating incomplete architecture

You must deliver a working vertical slice from ingestion to display.

A partial skeleton is not enough.

---

## 2. Do Not Ask Broad Product Questions

Do not ask open-ended questions unless truly blocked by missing credentials or impossible ambiguity.

Instead:

- make reasonable assumptions
- choose the simplest viable path
- document assumptions in the README

Examples of good behavior:

- choose SQLite for persistence
- choose Streamlit or a minimal web UI if that is the fastest path
- choose 3 source adapters first and get them working
- use simple topic normalization heuristics for MVP

If blocked, minimize the question and continue wherever possible.

---

## 3. Prefer Simplicity Over Cleverness

When multiple solutions are possible, choose the one that is:

- easier to read
- easier to test
- easier to modify
- less magical

Avoid:

- elaborate frameworks
- over-abstracted systems
- hidden control flow
- unnecessary async complexity
- premature optimization

The MVP should feel small, clear, and solid.

---

## 4. Build in Small, Verifiable Steps

Work incrementally in a sensible order.

Suggested order:

1. project structure
2. shared models
3. 3 source adapters
4. topic extraction and normalization
5. scoring logic
6. persistence
7. ranking
8. dashboard
9. tests
10. README polish

At each step, prefer something that can actually run.

---

# Implementation Expectations

## 5. Use Explicit Shared Models

Do not pass loose, inconsistent dictionaries across the system unless unavoidable.

Use typed models for the core concepts.

At minimum define models for:

- raw source item
- normalized signal
- topic aggregate
- trend score result

These models should make the data flow easy to follow.

---

## 6. Keep Responsibilities Clean

Respect module boundaries.

- source adapters fetch and normalize source data
- topic modules clean and merge topics
- scoring modules compute component and total scores
- repositories persist and retrieve data
- UI renders precomputed results
- jobs orchestrate workflows

Do not mix concerns.

---

## 7. Make Scoring Explainable

The system must not produce opaque scores.

Each ranked result should expose:

- topic
- total score
- component scores
- signal evidence
- last updated time

A human should be able to inspect a topic and understand why it ranked where it did.

---

## 8. Make the System Resilient

External APIs fail.

Design so that:

- one failing source does not crash the full ingestion run
- errors are logged clearly
- partial results still work where possible
- sample or fallback data exists when useful for demonstration

The MVP should be runnable and inspectable even when some live sources are unavailable.

---

# Code Quality Expectations

## 9. Optimize for Human Reasoning

The code should be easy to read.

This means:

- small functions
- small modules
- explicit names
- explicit control flow
- predictable behavior

Avoid vague names like:

- `process`
- `run`
- `handle_data`
- `utils`

Prefer names that tell the reader exactly what the code does.

---

## 10. Keep Functions Focused

Each function should do one thing.

Prefer:

- parse
- normalize
- merge
- calculate
- rank
- save
- load
- render

Avoid giant functions that do multiple conceptual tasks.

If a function becomes hard to scan, split it.

---

## 11. Keep Dependencies Minimal

Before adding a dependency, ask:

- is it necessary?
- does it truly simplify the implementation?
- will it make the code easier to understand?

Prefer standard library or common, well-understood packages.

---

## 12. Use Tests to Prove Core Behavior

Do not leave the core logic untested.

At minimum, add tests for:

- topic normalization
- duplicate merging
- score calculation
- ranking
- repository behavior

Where possible, test source normalization using sample payloads instead of live network calls.

Tests should be:

- readable
- deterministic
- small
- meaningful

---

# Delivery Expectations

## 13. README Must Be Practical

The README must explain:

- what the project does
- how to install dependencies
- how to configure it
- how to run ingestion
- how to run the UI
- how to run tests
- how scoring works
- how to add a new source

Assume the reader is technical but new to the codebase.

---

## 14. Local Run Path Must Work

Provide a clear path from clone to working system.

That includes:

- dependencies listed
- `.env.example`
- commands to run
- notes on fallback behavior if APIs are rate-limited

The system should be demonstrable locally.

---

## 15. Use Mock or Seed Data When Helpful

If live data is flaky or rate-limited, include seed data or fixtures so the project can still be demonstrated.

Do not make the entire project dependent on perfect external API access.

A working demo path matters.

---

# Decision Rules

When making tradeoffs, follow this order:

1. working end-to-end system
2. readability
3. testability
4. maintainability
5. extensibility
6. performance
7. sophistication

This is an MVP.
Avoid gold-plating.

---

# What Not to Do

Do not:

- stop at scaffolding
- leave core paths unimplemented
- add auth
- add billing
- add enterprise architecture
- add heavy ML pipelines
- add unnecessary abstractions
- build a distributed system
- hide business logic inside the UI
- use vague catch-all utility files
- rely heavily on live APIs in tests

---

# Required Completion Standard

The work is not complete until the MVP satisfies `ACCEPTANCE_CRITERIA.md`.

Before finishing, verify that:

- at least 3 free sources are ingested
- topics are normalized
- trend scores are computed transparently
- rankings are deterministic
- output is visible in a usable interface
- tests exist for the core deterministic logic
- README is complete
- the codebase is understandable

If those conditions are not met, continue implementing.

---

# Final Output Standard

The final project should feel like a clean small analytical engine.

A human should be able to understand:

- where data comes from
- how it is normalized
- how topics are merged
- how scores are calculated
- how rankings are produced
- how results are displayed
- how to add new sources

That is the bar.

---

# Execution Prompt

Implement the project now.

Read all specification files first, then build the system end-to-end.

Make reasonable assumptions.
Document important tradeoffs briefly.
Prefer simple, explicit, maintainable code.
Do not stop at a skeleton.
Deliver a working MVP.
