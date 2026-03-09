import { promises as fs } from "node:fs";
import path from "node:path";

import type { DashboardData, LatestTrendsResponse, TrendHistoryResponse } from "@/lib/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");

export async function loadDashboardData(): Promise<DashboardData> {
  const [latest, history] = await Promise.all([readLatestTrends(), readTrendHistory()]);
  return { latest, history };
}

async function readLatestTrends(): Promise<LatestTrendsResponse> {
  return readJsonFile<LatestTrendsResponse>("latest-trends.json", {
    generatedAt: new Date(0).toISOString(),
    trends: [],
  });
}

async function readTrendHistory(): Promise<TrendHistoryResponse> {
  return readJsonFile<TrendHistoryResponse>("trend-history.json", {
    generatedAt: new Date(0).toISOString(),
    snapshots: [],
  });
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(DATA_DIRECTORY, filename);
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    return fallback;
  }
}
