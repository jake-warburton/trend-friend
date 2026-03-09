# Global Trend Intelligence Tool — Specification

## Objective

Build a tool that detects **emerging global trends** by aggregating signals from across the internet.

The goal is to identify **what the world is becoming interested in early** so the user can respond with:

- social media content
- software products
- startup ideas
- investment strategies
- market positioning

The system should detect **momentum**, not just popularity.

---

# Core Concept

The platform aggregates multiple signals of **human attention** and ranks topics based on growth velocity.

Example output:

Trend: AI Agents
Search Growth: +420%
Reddit Mentions: +650%
GitHub Activity: +310%

Prediction: Breakout Trend

---

# MVP Constraints

The MVP must be **free for the creator to run**.

Rules:

- Prefer **free APIs**
- Prefer **public datasets**
- Avoid paid APIs
- Avoid expensive scraping infrastructure
- Avoid heavy compute
- Must run locally
- Must deploy cheaply (optional)

Focus on **proof of concept**.

---

# Core Features

## 1. Trend Detection

The system must identify topics gaining attention quickly.

Signals:

- Google Trends
- Reddit
- GitHub
- Hacker News
- Wikipedia Pageviews

Output:

- ranked list of emerging trends
- trend score
- explanation of signals

---

## 2. Momentum Scoring

Each topic should receive a **trend score**.

Signals may include:

- search growth
- mention growth
- discussion velocity
- repository star growth
- pageview spikes

The scoring system must be **simple and transparent**.

---

## 3. Topic Extraction

Automatically extract topics from:

- posts
- search queries
- repository names
- article titles

Handle:

- duplicates
- synonyms
- noise

Simple heuristics are acceptable for MVP.

---

## 4. Dashboard

Display trends in a simple UI.

Minimum features:

- list of top trends
- trend score
- signals used
- timestamp

CLI output is acceptable for early stages.

---

# Nice-to-Have Features

These should only be implemented after MVP works:

- historical trend charts
- alerts
- sector categorization
- opportunity scoring
- startup idea suggestions
- social content ideas

---

# Non-Goals for MVP

Do NOT build:

- authentication
- billing
- enterprise features
- advanced ML
- distributed infrastructure
- complicated microservices

---

# Data Sources (Free Only)

Preferred sources:

Google Trends
Reddit API
GitHub API
Hacker News API
Wikipedia Pageviews API

---

# Success Criteria

The MVP succeeds if it can:

- automatically ingest signals
- detect emerging topics
- compute a momentum score
- display trends in a simple dashboard
- run with free data sources

---

# Long-Term Vision

A system similar to a **Bloomberg Terminal for global attention**, combining signals from:

- search engines
- social platforms
- developer ecosystems
- financial markets
- startup ecosystems

The goal is to detect **important trends before they become obvious**.
