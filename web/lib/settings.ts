export const ESTIMATED_METRICS_COOKIE = "signal_eye_show_estimated_metrics";

export type EnrichmentProviderStatus = {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
};

export function buildEnrichmentProviderStatuses(env: NodeJS.ProcessEnv): EnrichmentProviderStatus[] {
  return [
    {
      key: "market-enrichment",
      label: "Market enrichment job",
      configured: env.SIGNAL_EYE_MARKET_ENRICHMENT_ENABLED !== "false",
      detail:
        env.SIGNAL_EYE_MARKET_ENRICHMENT_ENABLED === "false"
          ? "External market enrichment is disabled."
          : "External market enrichment is enabled for ranked trends.",
    },
    {
      key: "google-search",
      label: "Google search provider",
      configured: Boolean(env.SIGNAL_EYE_GOOGLE_SEARCH_METRICS_URL),
      detail: env.SIGNAL_EYE_GOOGLE_SEARCH_METRICS_URL
        ? "Live monthly searches and search-interest metrics can be fetched."
        : "Using estimated fallback values until a provider endpoint is configured.",
    },
    {
      key: "youtube",
      label: "YouTube API",
      configured: Boolean(env.YOUTUBE_API_KEY),
      detail: env.YOUTUBE_API_KEY
        ? "Live YouTube search and video statistics are available."
        : "Using estimated YouTube footprint values until an API key is configured.",
    },
    {
      key: "tiktok",
      label: "TikTok provider",
      configured: Boolean(env.SIGNAL_EYE_TIKTOK_METRICS_URL),
      detail: env.SIGNAL_EYE_TIKTOK_METRICS_URL
        ? "Live TikTok footprint metrics can be fetched from the configured provider."
        : "Using estimated TikTok footprint values until a provider endpoint is configured.",
    },
  ];
}

export function readEstimatedMetricsPreference(value: string | undefined): boolean {
  return value !== "false";
}
