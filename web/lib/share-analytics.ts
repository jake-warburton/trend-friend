import type { WatchlistShare } from "@/lib/types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ShareAnalyticsSummary = {
  totalOpens: number;
  activeShares: number;
  dormantShares: number;
  topShare: WatchlistShare | null;
};

export function summarizeShareUsage(
  shares: WatchlistShare[],
  now = Date.now(),
): ShareAnalyticsSummary {
  const totalOpens = shares.reduce((sum, share) => sum + share.accessCount, 0);
  const activeShares = shares.filter((share) => wasOpenedRecently(share.lastAccessedAt, now)).length;
  const dormantShares = shares.filter((share) => share.accessCount === 0 || !wasOpenedRecently(share.lastAccessedAt, now)).length;
  const topShare = [...shares].sort((left, right) => {
    return right.accessCount - left.accessCount || compareAccessDates(right.lastAccessedAt, left.lastAccessedAt);
  })[0] ?? null;

  return {
    totalOpens,
    activeShares,
    dormantShares,
    topShare,
  };
}

export function wasOpenedRecently(lastAccessedAt: string | null, now = Date.now()) {
  if (lastAccessedAt == null) {
    return false;
  }
  return now - new Date(lastAccessedAt).getTime() <= SEVEN_DAYS_MS;
}

function compareAccessDates(left: string | null, right: string | null) {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  return new Date(left).getTime() - new Date(right).getTime();
}
