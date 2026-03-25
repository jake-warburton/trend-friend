"""Tests for the Twitter refresh workflow guardrails."""

from __future__ import annotations

import unittest

from scripts.run_twitter_once import validate_twitter_refresh_outputs


class TwitterRefreshGuardTests(unittest.TestCase):
    """The refresh workflow should fail loudly when trend rows are missing."""

    def test_validate_twitter_refresh_outputs_allows_non_empty_trends(self) -> None:
        validate_twitter_refresh_outputs(
            {"accounts_checked": 12, "new_tweets": 4, "skipped": 8, "errors": 0},
            {"categories_fetched": 5, "places_fetched": 10, "total_trends": 187, "errors": 0},
        )

    def test_validate_twitter_refresh_outputs_raises_for_zero_trends(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "without any trend rows"):
            validate_twitter_refresh_outputs(
                {"accounts_checked": 12, "new_tweets": 0, "skipped": 12, "errors": 0},
                {"categories_fetched": 0, "places_fetched": 0, "total_trends": 0, "errors": 3},
            )


if __name__ == "__main__":
    unittest.main()
