import type { PublicWatchlistSummary } from "@/lib/types";

export function buildCommunitySpotlights(watchlists: PublicWatchlistSummary[]) {
  const spotlights: Array<{
    title: string;
    description: string;
    href: string;
    watchlist: PublicWatchlistSummary;
  }> = [];

  const popular = watchlists.find((watchlist) => watchlist.popularThisWeek);
  if (popular) {
    spotlights.push({
      title: "Popular this week",
      description: "The most-opened public watchlist right now.",
      href: "/community?popular=true",
      watchlist: popular,
    });
  }

  const searchDriven = watchlists.find((watchlist) =>
    (watchlist.sourceContributions ?? []).some(
      (contribution) => contribution.source === "google_trends",
    ),
  );
  if (searchDriven) {
    spotlights.push({
      title: "Search-driven",
      description: "Led by search demand and Google Trends signals.",
      href: "/community?source=google_trends",
      watchlist: searchDriven,
    });
  }

  const global = watchlists.find(
    (watchlist) => (watchlist.geoSummary?.length ?? 0) >= 2,
  );
  if (global) {
    spotlights.push({
      title: "Global interest",
      description: "Showing up across multiple regions at once.",
      href: "/community",
      watchlist: global,
    });
  }

  const developerAudience = watchlists.find((watchlist) =>
    (watchlist.audienceSummary ?? []).some(
      (segment) => segment.label === "developer",
    ),
  );
  if (developerAudience) {
    spotlights.push({
      title: "Developer audience",
      description: "Strongest with developers and technical builders.",
      href: "/community?audience=developer",
      watchlist: developerAudience,
    });
  }

  const businessAudience = watchlists.find((watchlist) =>
    (watchlist.audienceSummary ?? []).some(
      (segment) => segment.label === "b2b",
    ),
  );
  if (businessAudience) {
    spotlights.push({
      title: "B2B signal",
      description: "Leaning toward enterprise and business demand.",
      href: "/community?audience=b2b",
      watchlist: businessAudience,
    });
  }

  return spotlights;
}

export function buildCommunityExportHref() {
  return "/api/export/community";
}

export function buildSharedWatchlistExportHref(shareToken: string) {
  return `/api/export/shared/${encodeURIComponent(shareToken)}`;
}
