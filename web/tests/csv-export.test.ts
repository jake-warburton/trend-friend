import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "@/app/api/export/route";

/**
 * The GET handler reads from loadTrendExplorer which falls back to an empty
 * JSON file. In tests there is no data directory, so it returns an empty
 * trend list. The CSV should still include a header row.
 */

test("export CSV route returns text/csv with a header row", async () => {
  const response = await GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/csv");

  const disposition = response.headers.get("Content-Disposition") ?? "";
  assert.ok(disposition.startsWith('attachment; filename="signal-eye-export-'));
  assert.ok(disposition.endsWith('.csv"'));

  const body = await response.text();
  const lines = body.trimEnd().split("\n");
  assert.ok(lines.length >= 1, "CSV must contain at least a header row");

  const header = lines[0];
  assert.ok(header.includes("rank"), "Header must include rank");
  assert.ok(header.includes("name"), "Header must include name");
  assert.ok(header.includes("category"), "Header must include category");
  assert.ok(header.includes("score"), "Header must include score");
  assert.ok(header.includes("sources"), "Header must include sources");
});

test("export CSV header has the expected columns", async () => {
  const response = await GET();
  const body = await response.text();
  const header = body.split("\n")[0];
  const columns = header.split(",");

  assert.deepEqual(columns, [
    "rank",
    "name",
    "category",
    "status",
    "volatility",
    "score",
    "social_score",
    "developer_score",
    "knowledge_score",
    "search_score",
    "diversity_score",
    "rank_change",
    "momentum_pct",
    "source_count",
    "signal_count",
    "sources",
    "audience_segments",
    "market_segments",
    "language_segments",
    "forecast_direction",
    "first_seen",
    "latest_signal",
  ]);
});
