import type { TrendHistoryPoint, TrendHistoryResponse } from "@/lib/types";

const MAX_BUCKET_POINTS = 60;

export type TrendHistoryGranularity = "day" | "week" | "month" | "year";

type TrendHistoryBucket = {
  bucketStart: string;
  scoreTotalSum: number;
  rankSum: number;
  count: number;
};

export function buildTrendChartHistory(
  slug: string,
  snapshotHistory: TrendHistoryResponse,
  detailHistory: TrendHistoryPoint[] = [],
): TrendHistoryPoint[] {
  const pointsByTimestamp = new Map<string, TrendHistoryPoint>();

  for (const point of detailHistory) {
    pointsByTimestamp.set(point.capturedAt, point);
  }

  for (const snapshot of snapshotHistory.snapshots) {
    const record = snapshot.trends.find((trend) => trend.id === slug);
    if (record == null) {
      continue;
    }

    pointsByTimestamp.set(snapshot.capturedAt, {
      capturedAt: snapshot.capturedAt,
      rank: record.rank,
      scoreTotal: record.score.total,
    });
  }

  return [...pointsByTimestamp.values()].sort(
    (left, right) =>
      new Date(left.capturedAt).getTime() -
      new Date(right.capturedAt).getTime(),
  );
}

export function determineTrendHistoryGranularity(
  history: TrendHistoryPoint[],
  maxBucketPoints: number = MAX_BUCKET_POINTS,
): TrendHistoryGranularity {
  const sortedHistory = sortHistory(history);
  if (sortedHistory.length <= 1) {
    return "day";
  }

  const granularities: TrendHistoryGranularity[] = [
    "day",
    "week",
    "month",
    "year",
  ];

  for (const granularity of granularities) {
    if (countDistinctBuckets(sortedHistory, granularity) <= maxBucketPoints) {
      return granularity;
    }
  }

  return "year";
}

export function compressTrendChartHistory(
  history: TrendHistoryPoint[],
  maxBucketPoints: number = MAX_BUCKET_POINTS,
): TrendHistoryPoint[] {
  if (history.length <= 2) {
    return sortHistory(history);
  }

  const sortedHistory = sortHistory(history);
  const granularity = determineTrendHistoryGranularity(
    sortedHistory,
    maxBucketPoints,
  );
  const buckets = new Map<string, TrendHistoryBucket>();

  for (const point of sortedHistory) {
    const bucketStart = buildBucketStart(point.capturedAt, granularity);
    const bucket = buckets.get(bucketStart) ?? {
      bucketStart,
      scoreTotalSum: 0,
      rankSum: 0,
      count: 0,
    };

    bucket.scoreTotalSum += point.scoreTotal;
    bucket.rankSum += point.rank;
    bucket.count += 1;
    buckets.set(bucketStart, bucket);
  }

  return [...buckets.values()]
    .sort(
      (left, right) =>
        new Date(left.bucketStart).getTime() -
        new Date(right.bucketStart).getTime(),
    )
    .map((bucket) => ({
      capturedAt: bucket.bucketStart,
      rank: Math.round(bucket.rankSum / bucket.count),
      scoreTotal: roundToSingleDecimal(bucket.scoreTotalSum / bucket.count),
    }));
}

function countDistinctBuckets(
  history: TrendHistoryPoint[],
  granularity: TrendHistoryGranularity,
): number {
  const bucketStarts = new Set(
    history.map((point) => buildBucketStart(point.capturedAt, granularity)),
  );
  return bucketStarts.size;
}

function buildBucketStart(
  timestamp: string,
  granularity: TrendHistoryGranularity,
): string {
  const date = new Date(timestamp);
  const utcDate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  if (granularity === "day") {
    return utcDate.toISOString();
  }

  if (granularity === "week") {
    const day = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
    return utcDate.toISOString();
  }

  if (granularity === "month") {
    utcDate.setUTCDate(1);
    return utcDate.toISOString();
  }

  utcDate.setUTCMonth(0, 1);
  return utcDate.toISOString();
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function sortHistory(history: TrendHistoryPoint[]): TrendHistoryPoint[] {
  return [...history].sort(
    (left, right) =>
      new Date(left.capturedAt).getTime() -
      new Date(right.capturedAt).getTime(),
  );
}
