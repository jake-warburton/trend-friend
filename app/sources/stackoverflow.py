"""Stack Overflow source adapter for trending developer questions.

Fetches the highest-voted questions from the past week via the
Stack Exchange API v2.3.  These surface real developer pain points
and emerging technology issues (Docker breakage, new browser APIs,
library migrations, etc.) that other sources miss.
"""

from __future__ import annotations

import html
from datetime import datetime, timezone, timedelta

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOOKBACK_DAYS = 7


class StackOverflowSourceAdapter(SourceAdapter):
    """Fetch top-voted recent Stack Overflow questions."""

    source_name = "stackoverflow"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_api()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_api(self) -> list[RawSourceItem]:
        """Query the Stack Exchange API for top-voted questions from the past week."""

        from_date = datetime.now(tz=timezone.utc) - timedelta(days=LOOKBACK_DAYS)
        from_epoch = int(from_date.timestamp())
        limit = min(self.settings.max_items_per_source, 100)

        url = (
            f"https://api.stackexchange.com/2.3/questions"
            f"?order=desc&sort=votes&site=stackoverflow"
            f"&filter=default&pagesize={limit}"
            f"&fromdate={from_epoch}"
        )

        payload = self.get_json(url)
        questions = payload.get("items", [])
        self.raw_item_count = len(questions)

        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()

        for question in questions:
            qid = str(question.get("question_id", ""))
            title = html.unescape(str(question.get("title", "")).strip())
            score = int(question.get("score", 0))
            view_count = int(question.get("view_count", 0))
            answer_count = int(question.get("answer_count", 0))
            creation_date = int(question.get("creation_date", 0))
            link = str(question.get("link", f"https://stackoverflow.com/questions/{qid}"))
            tags = question.get("tags", [])

            if not title or not qid or score < 1:
                continue
            if qid in seen_ids:
                continue
            seen_ids.add(qid)

            # Engagement combines votes, views, and answers
            engagement = float(score * 10) + float(view_count * 0.01) + float(answer_count * 5)

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=qid,
                    title=title,
                    url=link,
                    timestamp=self.parse_unix_timestamp(creation_date) if creation_date else datetime.now(tz=timezone.utc),
                    engagement_score=engagement,
                    metadata={"tags": tags[:5]},
                )
            )
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break

        return items

    def _fallback_items(self) -> list[RawSourceItem]:
        """Return deterministic sample data for local fallback runs."""

        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="90000001",
                title="Sudden Docker error about client API version",
                url="https://stackoverflow.com/questions/90000001",
                timestamp=now,
                engagement_score=1200.0,
                metadata={"tags": ["docker", "ubuntu", "testcontainers"]},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="90000002",
                title="How to handle breaking changes in Python 3.13 type system",
                url="https://stackoverflow.com/questions/90000002",
                timestamp=now,
                engagement_score=800.0,
                metadata={"tags": ["python", "typing", "python-3.13"]},
            ),
        ]
