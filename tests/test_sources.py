"""Tests for source adapter normalization behavior."""

from __future__ import annotations

import unittest
from dataclasses import replace

from app.config import load_settings
from app.sources.devto import DevToSourceAdapter
from app.sources.curated_rss import CuratedRssSourceAdapter, FeedSpec
from app.sources.chrome_web_store import ChromeWebStoreSourceAdapter
from app.sources.github import GitHubSourceAdapter
from app.sources.google_news import GoogleNewsSourceAdapter, _TOPICS as GOOGLE_NEWS_TOPICS
from app.sources.hacker_news import HackerNewsSourceAdapter
from app.sources.huggingface import HuggingFaceSourceAdapter
from app.sources.lobsters import LobstersSourceAdapter
from app.sources.npm import NpmSourceAdapter
from app.sources.pypi import PyPISourceAdapter
from app.sources.polymarket import PolymarketSourceAdapter
from app.sources.reddit import RedditSourceAdapter
from app.sources.twitter import TwitterSourceAdapter
from app.sources.wikipedia import WikipediaSourceAdapter
from app.sources.youtube import YouTubeSourceAdapter


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
                "news",
                "worldnews",
                "politics",
                "geopolitics",
                "sports",
                "nba",
                "nfl",
                "soccer",
                "games",
                "pcgaming",
                "movies",
                "television",
                "popculturechat",
                "programming",
                "MachineLearning",
                "artificial",
                "LocalLLaMA",
                "opensource",
                "startups",
                "entrepreneur",
                "SaaS",
                "singularity",
                "sideproject",
                "indiehackers",
            ],
        )
        self.assertEqual(adapter.FEED_SPECS, (("hot", None), ("new", None), ("top", "day"), ("top", "week")))

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

    def test_google_news_adapter_normalizes_sample_payload(self) -> None:
        adapter = GoogleNewsSourceAdapter(self.settings)
        items = adapter._normalize_items(adapter.sample_payload())
        self.assertEqual(len(items), 4)
        self.assertEqual(items[0].source, "google_news")
        self.assertEqual(items[0].metadata["section"], "world")
        self.assertEqual(items[1].metadata["publisher"], "Bloomberg")
        self.assertEqual(items[-1].metadata["section"], "entertainment")

    def test_google_news_adapter_parses_rss_and_strips_publisher_suffix(self) -> None:
        adapter = GoogleNewsSourceAdapter(self.settings)
        rss_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Ceasefire talks intensify in Gaza - Reuters</title>
              <link>https://news.google.com/articles/world-1</link>
              <pubDate>Thu, 12 Mar 2026 12:00:00 GMT</pubDate>
              <source url="https://www.reuters.com">Reuters</source>
            </item>
            <item>
              <title>Premier League title race tightens - ESPN</title>
              <link>https://news.google.com/articles/sports-1</link>
              <pubDate>Thu, 12 Mar 2026 13:00:00 GMT</pubDate>
              <source url="https://www.espn.com">ESPN</source>
            </item>
          </channel>
        </rss>"""
        items = adapter._parse_rss(rss_xml, section="world", limit=5)
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].title, "Ceasefire talks intensify in Gaza")
        self.assertEqual(items[0].metadata["publisher"], "Reuters")
        self.assertEqual(items[0].metadata["section"], "world")

    def test_google_news_adapter_covers_sports_and_entertainment_sections(self) -> None:
        self.assertIn(("SPORTS", "sports"), GOOGLE_NEWS_TOPICS)
        self.assertIn(("ENTERTAINMENT", "entertainment"), GOOGLE_NEWS_TOPICS)
        self.assertIn(("NATION", "nation"), GOOGLE_NEWS_TOPICS)

    def test_curated_rss_adapter_parses_rss_and_atom_feeds(self) -> None:
        adapter = CuratedRssSourceAdapter(self.settings)
        rss_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AI coding assistants accelerate in startup teams - TechCrunch</title>
              <link>https://techcrunch.com/example-ai-coding</link>
              <pubDate>Thu, 12 Mar 2026 12:00:00 GMT</pubDate>
              <description><![CDATA[New developer workflows are emerging around AI coding tools.]]></description>
            </item>
          </channel>
        </rss>"""
        rss_items = adapter._parse_feed(
            rss_xml,
            feed=FeedSpec("TechCrunch AI", "TechCrunch", "https://techcrunch.com/category/artificial-intelligence/feed/"),
            limit=3,
        )
        self.assertEqual(len(rss_items), 1)
        self.assertEqual(rss_items[0].source, "curated_feeds")
        self.assertEqual(rss_items[0].metadata["publisher"], "TechCrunch")
        self.assertIn("developer workflows", rss_items[0].title.lower())

        atom_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>OpenAI launches new agent tooling</title>
            <link rel="alternate" href="https://openai.com/news/example-agent-tooling" />
            <updated>2026-03-12T13:00:00Z</updated>
            <summary>Agent workflows are becoming easier to ship.</summary>
          </entry>
        </feed>"""
        atom_items = adapter._parse_feed(
            atom_xml,
            feed=FeedSpec("OpenAI News", "OpenAI", "https://openai.com/news/rss.xml", kind="atom"),
            limit=3,
        )
        self.assertEqual(len(atom_items), 1)
        self.assertEqual(atom_items[0].metadata["feed"], "OpenAI News")
        self.assertIn("agent workflows", atom_items[0].title.lower())

    def test_chrome_web_store_adapter_parses_search_cards(self) -> None:
        adapter = ChromeWebStoreSourceAdapter(self.settings)
        html = """
        <div class="Cb7Kte" data-item-id="ngammciiefcamimjfmbjbhijplgiankh">
          <a class="q6LNgd" href="./detail/ai-productivity-suite/ngammciiefcamimjfmbjbhijplgiankh"></a>
          <div class="IcZnBc" id="i6"><h2 class="CiI2if">AI Productivity Suite</h2></div>
          <span class="GvZmud" aria-label="Average rating 5 out of 5 stars." id="i8"></span>
          <div id="i9">Enhanced AI prompt management with ChatGPT and powerful organization features.</div>
        </div>
        """
        items = adapter._parse_search_page(html, query_family="ai")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].source, "chrome_web_store")
        self.assertEqual(items[0].external_id, "ngammciiefcamimjfmbjbhijplgiankh")
        self.assertIn("AI Productivity Suite", items[0].title)
        self.assertGreater(items[0].engagement_score, 0)

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

    def test_pypi_adapter_parses_rss_and_normalizes_package_json(self) -> None:
        adapter = PyPISourceAdapter(self.settings)
        rss_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>agent-observability 0.4.0</title>
              <link>https://pypi.org/project/agent-observability/0.4.0/</link>
              <pubDate>Thu, 12 Mar 2026 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>"""
        entries = adapter._parse_rss(rss_xml)
        self.assertEqual(entries[0][0], "agent-observability")

        payload = {
            "info": {
                "summary": "Tracing toolkit for AI agent workflows",
                "keywords": "ai,agents,observability",
                "classifiers": ["Topic :: Software Development", "Programming Language :: Python"],
                "package_url": "https://pypi.org/project/agent-observability/",
                "project_urls": {"Homepage": "https://example.com"},
            },
            "urls": [{"upload_time_iso_8601": "2026-03-12T11:30:00Z"}],
        }
        item = adapter._normalize_package(payload, "agent-observability", entries[0][1], entries[0][2])
        self.assertIsNotNone(item)
        assert item is not None
        self.assertEqual(item.source, "pypi")
        self.assertIn("agents", item.metadata["keywords"])
        self.assertGreater(item.engagement_score, 0)

    def test_youtube_adapter_normalizes_video_statistics(self) -> None:
        adapter = YouTubeSourceAdapter(self.settings)
        payload = {
            "items": [
                {
                    "id": "video-1",
                    "snippet": {
                        "title": "AI agents for operator workflows",
                        "publishedAt": "2026-03-12T12:00:00Z",
                        "channelTitle": "Builder Signals",
                        "tags": ["ai", "agents", "workflow"],
                    },
                    "statistics": {"viewCount": "10000", "likeCount": "800", "commentCount": "90"},
                }
            ]
        }
        items = adapter._normalize_videos(payload, query_family="agents")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].source, "youtube")
        self.assertEqual(items[0].metadata["channel_title"], "Builder Signals")
        self.assertGreater(items[0].engagement_score, 0)

    def test_polymarket_adapter_normalizes_sample_payload(self) -> None:
        adapter = PolymarketSourceAdapter(self.settings)
        items = adapter.normalize_items(adapter.sample_payload())
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].source, "polymarket")
        self.assertTrue(items[0].title.endswith("?"))
        self.assertIn("polymarket.com/event/", items[0].url)
        self.assertGreater(items[0].engagement_score, 0)

    def test_polymarket_adapter_prefers_market_question_and_volume(self) -> None:
        adapter = PolymarketSourceAdapter(self.settings)
        payload = [
            {
                "title": "AI event wrapper",
                "slug": "ai-event-wrapper",
                "createdAt": "2026-03-12T08:00:00Z",
                "category": "technology",
                "markets": [
                    {
                        "id": "pm-1",
                        "question": "Will OpenAI release GPT-5 by June 2026?",
                        "slug": "gpt-5-june-2026",
                        "volume24hr": "1000",
                        "liquidity": "500",
                        "endDate": "2026-06-30T23:59:59Z",
                    }
                ],
            }
        ]
        items = adapter.normalize_items(payload)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].external_id, "pm-1")
        self.assertEqual(items[0].title, "Will OpenAI release GPT-5 by June 2026? AI event wrapper")
        self.assertEqual(items[0].engagement_score, 1050.0)
        self.assertEqual(items[0].metadata["category"], "technology")
        self.assertEqual(items[0].metadata["volume24hr"], "1000.0")
        self.assertEqual(items[0].metadata["liquidity"], "500.0")

    def test_polymarket_adapter_filters_politics_and_sports_markets(self) -> None:
        adapter = PolymarketSourceAdapter(self.settings)
        payload = [
            {
                "title": "Republican Presidential Nominee 2028",
                "slug": "republican-presidential-nominee-2028",
                "createdAt": "2026-03-12T08:00:00Z",
                "markets": [
                    {
                        "id": "pm-politics",
                        "question": "Will Donald Trump win the 2028 Republican presidential nomination?",
                        "slug": "trump-2028",
                        "volume24hr": "1000",
                        "liquidity": "500",
                        "endDate": "2028-06-30T23:59:59Z",
                    }
                ],
            },
            {
                "title": "Will OpenAI release GPT-5 by June 2026?",
                "slug": "openai-release-gpt-5-by-june-2026",
                "createdAt": "2026-03-12T08:00:00Z",
                "markets": [
                    {
                        "id": "pm-tech",
                        "question": "Will OpenAI release GPT-5 by June 2026?",
                        "slug": "gpt-5-june-2026",
                        "volume24hr": "1000",
                        "liquidity": "500",
                        "endDate": "2026-06-30T23:59:59Z",
                    }
                ],
            },
        ]
        items = adapter.normalize_items(payload)
        self.assertEqual([item.external_id for item in items], ["pm-tech"])

    def test_polymarket_adapter_keeps_only_highest_signal_market_per_event(self) -> None:
        adapter = PolymarketSourceAdapter(self.settings)
        payload = [
            {
                "title": "Fed decision in March?",
                "slug": "fed-decision-in-march",
                "createdAt": "2026-03-12T08:00:00Z",
                "markets": [
                    {
                        "id": "pm-fed-low",
                        "question": "Will there be no change in Fed interest rates after the March 2026 meeting?",
                        "slug": "fed-no-change",
                        "volume24hr": "1000",
                        "liquidity": "500",
                        "endDate": "2026-03-31T23:59:59Z",
                    },
                    {
                        "id": "pm-fed-high",
                        "question": "Will the Fed decrease interest rates by 25 bps after the March 2026 meeting?",
                        "slug": "fed-cut-25",
                        "volume24hr": "2000",
                        "liquidity": "600",
                        "endDate": "2026-03-31T23:59:59Z",
                    },
                ],
            }
        ]
        items = adapter.normalize_items(payload)
        self.assertEqual([item.external_id for item in items], ["pm-fed-high"])

    def test_polymarket_adapter_filters_celebrity_activity_count_markets(self) -> None:
        adapter = PolymarketSourceAdapter(self.settings)
        payload = [
            {
                "title": "Elon Musk # tweets March 6 - March 13, 2026?",
                "slug": "elon-musk-tweets-march-6-13-2026",
                "createdAt": "2026-03-12T08:00:00Z",
                "markets": [
                    {
                        "id": "pm-musk",
                        "question": "Will Elon Musk post 80-99 tweets from March 6 to March 13, 2026?",
                        "slug": "elon-musk-tweets-80-99",
                        "volume24hr": "2000",
                        "liquidity": "500",
                        "endDate": "2026-03-13T23:59:59Z",
                    }
                ],
            },
            {
                "title": "Bitcoin above ___ on March 12?",
                "slug": "bitcoin-above-on-march-12",
                "createdAt": "2026-03-12T08:00:00Z",
                "markets": [
                    {
                        "id": "pm-btc",
                        "question": "Will the price of Bitcoin be above $62,000 on March 12?",
                        "slug": "bitcoin-above-62000",
                        "volume24hr": "3000",
                        "liquidity": "800",
                        "endDate": "2026-03-12T23:59:59Z",
                    }
                ],
            },
        ]
        items = adapter.normalize_items(payload)
        self.assertEqual([item.external_id for item in items], ["pm-btc"])

    def test_reddit_adapter_parses_rss_and_deduplicates(self) -> None:
        settings = replace(self.settings, max_items_per_source=4)

        rss_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>First item</title>
            <link href="https://www.reddit.com/r/technology/comments/r1"/>
            <updated>2024-02-29T10:00:00+00:00</updated>
            <id>t3_r1</id>
            <category term="technology"/>
          </entry>
          <entry>
            <title>Second item</title>
            <link href="https://www.reddit.com/r/programming/comments/r2"/>
            <updated>2024-02-29T11:00:00+00:00</updated>
            <id>t3_r2</id>
            <category term="programming"/>
          </entry>
          <entry>
            <title>Duplicate</title>
            <link href="https://www.reddit.com/r/technology/comments/r1"/>
            <updated>2024-02-29T10:00:00+00:00</updated>
            <id>t3_r1</id>
            <category term="technology"/>
          </entry>
          <entry>
            <title>Third item</title>
            <link href="https://www.reddit.com/r/startups/comments/r3"/>
            <updated>2024-02-29T12:00:00+00:00</updated>
            <id>t3_r3</id>
            <category term="startups"/>
          </entry>
        </feed>"""

        class TestAdapter(RedditSourceAdapter):
            FEED_SPECS = (("hot", None),)
            TREND_SUBREDDITS = ["technology", "programming", "startups"]
            SUBREDDITS_PER_FEED = 3

            def get_url(self, url: str, headers=None):
                return rss_xml

        adapter = TestAdapter(settings)
        items = adapter.fetch()
        self.assertEqual([item.external_id for item in items], ["t3_r1", "t3_r2", "t3_r3"])
        self.assertEqual(adapter.raw_item_count, 4)
        self.assertEqual(adapter.kept_item_count, 3)
        self.assertEqual(items[0].metadata["subreddit"], "technology")
        self.assertEqual(items[0].metadata["feed"], "hot")
        # Position-based engagement: first item gets highest score
        self.assertGreater(items[0].engagement_score, items[2].engagement_score)

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
            QUERY_FAMILIES = (("recent", "stars:>80 archived:false"),)

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
        self.assertEqual(items[0].metadata["query_family"], "recent")

    def test_twitter_adapter_uses_multiple_query_families(self) -> None:
        adapter = TwitterSourceAdapter(self.settings)
        self.assertGreater(len(adapter.QUERY_FAMILIES), 1)
        self.assertEqual(adapter.QUERY_FAMILIES[0][0], "ai")

    def test_google_news_adapter_expands_topic_coverage(self) -> None:
        self.assertEqual(
            [section for _topic, section in GOOGLE_NEWS_TOPICS],
            ["world", "nation", "business", "technology", "science", "health", "sports", "entertainment"],
        )

    def test_devto_adapter_fallback_items_include_tags(self) -> None:
        adapter = DevToSourceAdapter(self.settings)
        items = adapter._fallback_items()
        self.assertEqual(items[0].source, "devto")
        self.assertIn("ai", items[0].metadata["tags"])

    def test_huggingface_adapter_fallback_items_include_kind_and_tags(self) -> None:
        adapter = HuggingFaceSourceAdapter(self.settings)
        items = adapter._fallback_items()
        self.assertEqual(items[0].source, "huggingface")
        self.assertEqual(items[0].metadata["kind"], "models")
        self.assertIn("llm", items[0].metadata["tags"])

    def test_npm_adapter_fallback_items_include_keywords(self) -> None:
        adapter = NpmSourceAdapter(self.settings)
        items = adapter._fallback_items()
        self.assertEqual(items[0].source, "npm")
        self.assertIn("workflow", items[0].metadata["keywords"])

    def test_lobsters_adapter_fallback_items_include_tags(self) -> None:
        adapter = LobstersSourceAdapter(self.settings)
        items = adapter._fallback_items()
        self.assertEqual(items[0].source, "lobsters")
        self.assertIn("mcp", items[0].metadata["tags"])


if __name__ == "__main__":
    unittest.main()
