"""Tests for source adapter normalization behavior."""

from __future__ import annotations

import unittest
from dataclasses import replace

from app.config import load_settings
from app.sources.github import GitHubSourceAdapter
from app.sources.hacker_news import HackerNewsSourceAdapter
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

    def test_reddit_adapter_default_subreddit_scope_is_broader_but_curated(self) -> None:
        adapter = RedditSourceAdapter(self.settings)
        self.assertEqual(
            adapter.TREND_SUBREDDITS,
            [
                "technology",
                "programming",
                "MachineLearning",
                "artificial",
                "LocalLLaMA",
                "opensource",
                "startups",
                "entrepreneur",
            ],
        )

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

    def test_reddit_adapter_fetches_multiple_pages_with_dedupe(self) -> None:
        settings = replace(self.settings, max_items_per_source=4, reddit_page_limit=3)

        class TestAdapter(RedditSourceAdapter):
            def __init__(self, settings):
                super().__init__(settings)
                self.calls: list[str] = []

            def get_json(self, url: str, headers=None):
                self.calls.append(url)
                if "after=t3_page1" in url:
                    return {
                        "data": {
                            "after": None,
                            "children": [
                                {
                                    "data": {
                                        "id": "r2",
                                        "title": "Duplicate from page one",
                                        "permalink": "/r/technology/comments/r2",
                                        "created_utc": 1_709_203_600,
                                        "score": 50,
                                        "num_comments": 10,
                                        "subreddit": "technology",
                                    }
                                },
                                {
                                    "data": {
                                        "id": "r3",
                                        "title": "Third item",
                                        "permalink": "/r/technology/comments/r3",
                                        "created_utc": 1_709_204_000,
                                        "score": 60,
                                        "num_comments": 12,
                                        "subreddit": "technology",
                                    }
                                },
                            ],
                        }
                    }
                return {
                    "data": {
                        "after": "t3_page1",
                        "children": [
                            {
                                "data": {
                                    "id": "r1",
                                    "title": "First item",
                                    "permalink": "/r/technology/comments/r1",
                                    "created_utc": 1_709_200_000,
                                    "score": 40,
                                    "num_comments": 8,
                                    "subreddit": "technology",
                                }
                            },
                            {
                                "data": {
                                    "id": "r2",
                                    "title": "Second item",
                                    "permalink": "/r/technology/comments/r2",
                                    "created_utc": 1_709_203_600,
                                    "score": 50,
                                    "num_comments": 10,
                                    "subreddit": "technology",
                                }
                            },
                        ],
                    }
                }

        adapter = TestAdapter(settings)
        items = adapter.fetch()
        self.assertEqual([item.external_id for item in items], ["r1", "r2", "r3"])
        self.assertEqual(len(adapter.calls), 2)

    def test_hacker_news_adapter_respects_page_depth_limit(self) -> None:
        settings = replace(self.settings, max_items_per_source=35, hacker_news_page_limit=2)

        class TestAdapter(HackerNewsSourceAdapter):
            def __init__(self, settings):
                super().__init__(settings)
                self.item_calls = 0

            def get_json(self, url: str, headers=None):
                if url.endswith("/topstories.json"):
                    return list(range(1, 80))
                self.item_calls += 1
                story_id = int(url.rsplit("/", 1)[-1].split(".")[0])
                return {
                    "id": story_id,
                    "title": f"Story {story_id}",
                    "time": 1_709_202_200 + story_id,
                    "score": 100,
                    "descendants": 20,
                    "url": f"https://example.com/{story_id}",
                    "by": "hn-user",
                }

        adapter = TestAdapter(settings)
        items = adapter.fetch()
        self.assertEqual(len(items), 35)
        self.assertEqual(adapter.item_calls, 35)

    def test_github_adapter_fetches_multiple_pages_with_dedupe(self) -> None:
        settings = replace(self.settings, max_items_per_source=4, github_page_limit=3)

        class TestAdapter(GitHubSourceAdapter):
            def __init__(self, settings):
                super().__init__(settings)
                self.calls: list[str] = []

            def get_json(self, url: str, headers=None):
                self.calls.append(url)
                if "&page=2" in url:
                    return {
                        "items": [
                            {
                                "id": 2,
                                "full_name": "example/two",
                                "description": "Duplicate repo",
                                "html_url": "https://github.com/example/two",
                                "pushed_at": "2026-03-08T00:01:00Z",
                                "stargazers_count": 20,
                                "forks_count": 5,
                                "language": "Python",
                            },
                            {
                                "id": 3,
                                "full_name": "example/three",
                                "description": "Third repo",
                                "html_url": "https://github.com/example/three",
                                "pushed_at": "2026-03-08T00:02:00Z",
                                "stargazers_count": 30,
                                "forks_count": 5,
                                "language": "Python",
                            },
                        ]
                    }
                if "&page=3" in url:
                    return {"items": []}
                return {
                    "items": [
                        {
                            "id": 1,
                            "full_name": "example/one",
                            "description": "First repo",
                            "html_url": "https://github.com/example/one",
                            "pushed_at": "2026-03-08T00:00:00Z",
                            "stargazers_count": 10,
                            "forks_count": 5,
                            "language": "Python",
                        },
                        {
                            "id": 2,
                            "full_name": "example/two",
                            "description": "Second repo",
                            "html_url": "https://github.com/example/two",
                            "pushed_at": "2026-03-08T00:01:00Z",
                            "stargazers_count": 20,
                            "forks_count": 5,
                            "language": "Python",
                        },
                    ]
                }

        adapter = TestAdapter(settings)
        items = adapter.fetch()
        self.assertEqual([item.external_id for item in items], ["1", "2", "3"])
        self.assertEqual(len(adapter.calls), 3)


if __name__ == "__main__":
    unittest.main()
