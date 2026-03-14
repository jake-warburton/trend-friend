export const ESTIMATED_METRICS_COOKIE = "signal_eye_show_estimated_metrics";
export const THEME_COOKIE = "signal_eye_theme";
export const LIGHT_THEME = "tech-light";
export const DARK_THEME = "soft-charcoal";

export type ThemeOption = {
  key: string;
  label: string;
  className: string;
  swatches: [string, string, string, string];
};

export type EnrichmentProviderStatus = {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
};

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    key: "tech-light",
    label: "Tech Light",
    className: "theme-tech-light",
    swatches: ["#f7f8fa", "#dfe1e6", "#0052cc", "#172b4d"],
  },
  {
    key: "soft-charcoal",
    label: "Soft Charcoal",
    className: "theme-soft-charcoal",
    swatches: ["#1e232b", "#2d3641", "#78c2ad", "#f4f7fb"],
  },
  {
    key: "ocean",
    label: "Ocean",
    className: "theme-ocean",
    swatches: ["#24415d", "#385678", "#6aa3d9", "#eef5fb"],
  },
] as const;

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
  return value === "true";
}

export function readThemePreference(value: string | undefined): string | null {
  return THEME_OPTIONS.some((theme) => theme.key === value) ? (value as string) : null;
}

export function getThemeClass(themeKey: string): string {
  return THEME_OPTIONS.find((theme) => theme.key === themeKey)?.className ?? THEME_OPTIONS[0].className;
}

export function getDefaultThemeForScheme(prefersDark: boolean): string {
  return prefersDark ? DARK_THEME : LIGHT_THEME;
}
