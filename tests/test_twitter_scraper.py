"""Tests for Twitter scraper and repository."""

from __future__ import annotations

import pathlib
import unittest
from pathlib import Path

from app.data.database import connect_database, initialize_database
from app.data.connection import DatabaseConnection

_TEST_DB = Path("data/test_twitter_tweets.db")


def _make_connection() -> DatabaseConnection:
    if _TEST_DB.exists():
        _TEST_DB.unlink()
    connection = connect_database(_TEST_DB)
    initialize_database(connection)
    migration = pathlib.Path("app/data/sqlite_migrations/0015_twitter_tweets.sql").read_text()
    connection.executescript(migration)
    return connection


class TwitterTweetRepositoryTests(unittest.TestCase):

    def setUp(self) -> None:
        self.connection = _make_connection()
        from app.data.repositories import TwitterTweetRepository
        self.repo = TwitterTweetRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()
        if _TEST_DB.exists():
            _TEST_DB.unlink()

    def test_upsert_and_fetch(self) -> None:
        self.repo.upsert_tweets([
            ("testuser", "t1", "Hello world", "2026-03-15T10:00:00+00:00", 100.0, "2026-03-15T10:01:00+00:00", "{}"),
        ])
        tweets = self.repo.fetch_all_tweets()
        self.assertEqual(len(tweets), 1)
        self.assertEqual(tweets[0]["tweet_id"], "t1")

    def test_upsert_updates_engagement(self) -> None:
        self.repo.upsert_tweets([
            ("testuser", "t1", "Hello world", "2026-03-15T10:00:00+00:00", 100.0, "2026-03-15T10:01:00+00:00", "{}"),
        ])
        self.repo.upsert_tweets([
            ("testuser", "t1", "Hello world", "2026-03-15T10:00:00+00:00", 500.0, "2026-03-15T10:05:00+00:00", "{}"),
        ])
        tweets = self.repo.fetch_all_tweets()
        self.assertEqual(len(tweets), 1)
        self.assertAlmostEqual(tweets[0]["engagement"], 500.0)

    def test_latest_tweet_id_for_account(self) -> None:
        self.repo.upsert_tweets([
            ("testuser", "t1", "First", "2026-03-15T10:00:00+00:00", 50.0, "2026-03-15T10:01:00+00:00", "{}"),
            ("testuser", "t2", "Second", "2026-03-15T11:00:00+00:00", 80.0, "2026-03-15T11:01:00+00:00", "{}"),
        ])
        latest = self.repo.latest_tweet_id("testuser")
        self.assertEqual(latest, "t2")

    def test_latest_tweet_id_unknown_account(self) -> None:
        result = self.repo.latest_tweet_id("nobody")
        self.assertIsNone(result)

    def test_prune_keeps_limit(self) -> None:
        tweets = [
            ("testuser", f"t{i}", f"Tweet {i}", f"2026-03-15T{10 + i // 60:02d}:{i % 60:02d}:00+00:00", float(i), "2026-03-15T12:00:00+00:00", "{}")
            for i in range(105)
        ]
        self.repo.upsert_tweets(tweets)
        self.repo.prune_account("testuser", keep=100)
        count = self.connection.execute("SELECT COUNT(*) FROM twitter_tweets WHERE account_handle = ?", ("testuser",)).fetchone()[0]
        self.assertEqual(count, 100)

    def test_fetch_all_for_pipeline(self) -> None:
        self.repo.upsert_tweets([
            ("user1", "t1", "Tweet A", "2026-03-15T10:00:00+00:00", 100.0, "2026-03-15T10:01:00+00:00", "{}"),
            ("user2", "t2", "Tweet B", "2026-03-15T11:00:00+00:00", 200.0, "2026-03-15T11:01:00+00:00", "{}"),
        ])
        tweets = self.repo.fetch_all_tweets()
        self.assertEqual(len(tweets), 2)
