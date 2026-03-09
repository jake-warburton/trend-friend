"""Tests for source adapter normalization behavior."""

from __future__ import annotations

import unittest

from app.config import load_settings
from app.sources.github import GitHubSourceAdapter
from app.sources.reddit import RedditSourceAdapter
from app.sources.wikipedia import WikipediaSourceAdapter


class SourceNormalizationTests(unittest.TestCase):
    """Source adapters should normalize sample payloads safely."""

    def setUp(self) -> None:
        self.settings = load_settings()

    def test_reddit_adapter_normalizes_sample_payload(self) -> None:
        adapter = RedditSourceAdapter(self.settings)
        items = adapter.normalize_items(adapter.sample_payload())
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].source, "reddit")
        self.assertGreater(items[0].engagement_score, 0)

    def test_github_adapter_handles_missing_description(self) -> None:
        adapter = GitHubSourceAdapter(self.settings)
        payload = {
            "items": [
                {
                    "id": 1,
                    "full_name": "example/project",
                    "description": None,
                    "html_url": "https://github.com/example/project",
                    "pushed_at": "2026-03-08T00:00:00Z",
                    "stargazers_count": 10,
                    "forks_count": 5,
                    "language": "Python",
                }
            ]
        }
        items = adapter.normalize_items(payload)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].title, "example/project")

    def test_wikipedia_adapter_skips_non_article_pages_and_uses_payload_date(self) -> None:
        adapter = WikipediaSourceAdapter(self.settings)
        payload = {
            "items": [
                {
                    "year": "2026",
                    "month": "03",
                    "day": "08",
                    "articles": [
                        {"article": "Main_Page", "views": 10, "rank": 1},
                        {"article": "File:Example.svg", "views": 20, "rank": 2},
                        {"article": "Artificial_intelligence", "views": 30, "rank": 3},
                    ],
                }
            ]
        }
        items = adapter.normalize_items(payload)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].title, "Artificial intelligence")
        self.assertEqual(items[0].timestamp.isoformat(), "2026-03-08T00:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
