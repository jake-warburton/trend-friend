import type {
  TrendHistoryResponse,
  TrendDetailIndexResponse,
  SourceSummaryResponse,
} from "@/lib/types";

export const OVERVIEW_POLL_INTERVAL_MS = 300_000; // 5 minutes
export const UPDATED_TRENDS_FLASH_MS = 5_000;
export const EMPTY_GENERATED_AT = new Date(0).toISOString();
export const EMPTY_HISTORY: TrendHistoryResponse = {
  generatedAt: EMPTY_GENERATED_AT,
  snapshots: [],
};
export const EMPTY_DETAIL_INDEX: TrendDetailIndexResponse = {
  generatedAt: EMPTY_GENERATED_AT,
  trends: [],
};
export const EMPTY_SOURCE_SUMMARY: SourceSummaryResponse = {
  generatedAt: EMPTY_GENERATED_AT,
  sources: [],
  familyHistory: [],
};

export const SOURCE_FILTER_OPTIONS = [
  { label: "All sources", value: "all" },
  { label: "arXiv", value: "arxiv" },
  { label: "Chrome Web Store", value: "chrome_web_store" },
  { label: "Curated Feeds", value: "curated_feeds" },
  { label: "DEV Community", value: "devto" },
  { label: "Hugging Face", value: "huggingface" },
  { label: "Lobsters", value: "lobsters" },
  { label: "npm", value: "npm" },
  { label: "Product Hunt", value: "producthunt" },
  { label: "PyPI", value: "pypi" },
  { label: "Stack Overflow", value: "stackoverflow" },
  { label: "Reddit", value: "reddit" },
  { label: "Hacker News", value: "hacker_news" },
  { label: "GitHub", value: "github" },
  { label: "Wikipedia", value: "wikipedia" },
  { label: "Google Trends", value: "google_trends" },
  { label: "Polymarket", value: "polymarket" },
  { label: "Twitter/X", value: "twitter" },
  { label: "YouTube", value: "youtube" },
] as const;

export const DEFAULT_CATEGORY_OPTION = {
  label: "All categories",
  value: "all",
} as const;
export const DEFAULT_AUDIENCE_OPTION = {
  label: "All audiences",
  value: "all",
} as const;
export const DEFAULT_MARKET_OPTION = {
  label: "All markets",
  value: "all",
} as const;
export const DEFAULT_LANGUAGE_OPTION = {
  label: "All languages",
  value: "all",
} as const;
export const DEFAULT_STAGE_OPTION = {
  label: "All stages",
  value: "all",
} as const;
export const DEFAULT_CONFIDENCE_OPTION = {
  label: "All confidence",
  value: "all",
} as const;
export const DEFAULT_META_TREND_OPTION = {
  label: "All meta trends",
  value: "all",
} as const;

export const STAGE_OPTIONS = [
  DEFAULT_STAGE_OPTION,
  { label: "Nascent", value: "nascent" },
  { label: "Rising", value: "rising" },
  { label: "Breakout", value: "breakout" },
  { label: "Validated", value: "validated" },
  { label: "Cooling", value: "cooling" },
  { label: "Steady", value: "steady" },
] as const;

export const CONFIDENCE_OPTIONS = [
  DEFAULT_CONFIDENCE_OPTION,
  { label: "High confidence", value: "high" },
  { label: "Medium confidence", value: "medium" },
  { label: "Low confidence", value: "low" },
] as const;

export const LENS_OPTIONS = [
  { label: "All lenses", value: "all" },
  { label: "Discovery", value: "discovery" },
  { label: "SEO", value: "seo" },
  { label: "Content", value: "content" },
  { label: "Product", value: "product" },
  { label: "Investment", value: "investment" },
] as const;

export const SORT_OPTIONS = [
  { label: "Rank", value: "rank" },
  { label: "Strength", value: "strength" },
  { label: "Date added", value: "dateAdded" },
  { label: "Latest activity", value: "latestActivity" },
  { label: "Sources", value: "sources" },
  { label: "Momentum", value: "momentum" },
] as const;

export const DEFAULT_SORT_DIRECTIONS: Record<string, "asc" | "desc"> = {
  rank: "asc",
  strength: "desc",
  dateAdded: "desc",
  latestActivity: "desc",
  sources: "desc",
  momentum: "desc",
};

export const DEFAULT_STATUS_OPTION = {
  label: "All statuses",
  value: "all",
} as const;

export const STATUS_OPTIONS = [
  DEFAULT_STATUS_OPTION,
  { label: "New", value: "new" },
  { label: "Breakout", value: "breakout" },
  { label: "Rising", value: "rising" },
  { label: "Cooling", value: "cooling" },
  { label: "Steady", value: "steady" },
] as const;

export const WATCHLISTS_ENABLED = false;

export const EXPLORER_PAGE_SIZE = 20;
