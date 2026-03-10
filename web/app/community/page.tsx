import Link from "next/link";

import type { PublicWatchlistSummary, PublicWatchlistsResponse } from "@/lib/types";
import { getBaseUrl } from "@/app/shared/[token]/page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CommunitySort = "recent" | "total" | "newest";

export default async function CommunityPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const query = readSearchParam(params.q);
  const sort = readSortParam(params.sort);
  const popularOnly = readBooleanParam(params.popular);
  const directory = await loadCommunityWatchlists();
  const watchlists = filterAndSortCommunityWatchlists(directory.watchlists, {
    query,
    sort,
    popularOnly,
  });

  return (
    <main className="community-page">
      <section className="community-hero">
        <div>
          <p className="eyebrow">Community Directory</p>
          <h1>Browse shared watchlists</h1>
          <p className="source-summary-copy">
            Discover public collections ranked by recent interest instead of creation date.
          </p>
        </div>
        <Link className="refresh-button shared-back-link" href="/">
          Back to dashboard
        </Link>
      </section>

      <form className="community-controls" method="GET">
        <label className="filter-field">
          <span>Search</span>
          <input
            className="text-input"
            defaultValue={query}
            name="q"
            placeholder="AI agents, climate, robotics..."
            type="search"
          />
        </label>
        <label className="filter-field">
          <span>Sort</span>
          <select className="select-trigger community-select" defaultValue={sort} name="sort">
            <option value="recent">Recent opens</option>
            <option value="total">Total opens</option>
            <option value="newest">Newest</option>
          </select>
        </label>
        <label className="community-toggle">
          <input defaultChecked={popularOnly} name="popular" type="checkbox" value="true" />
          <span>Popular this week only</span>
        </label>
        <button className="mini-action-button community-apply-button" type="submit">
          Apply
        </button>
      </form>

      <section className="community-grid">
        {watchlists.length === 0 ? (
          <div className="empty-state">
            <h3>No public watchlists match</h3>
            <p className="source-summary-copy">
              Try a broader query or remove the popularity filter.
            </p>
          </div>
        ) : (
          watchlists.map((watchlist) => (
            <article className="snapshot-card community-card" key={watchlist.shareToken}>
              <header>
                <strong>
                  <Link className="trend-link" href={`/shared/${watchlist.shareToken}`}>
                    {watchlist.name}
                  </Link>
                </strong>
                <span>{watchlist.popularThisWeek ? "Popular this week" : `${watchlist.itemCount} tracked`}</span>
              </header>
              <div className="community-meta">
                <div>
                  <span className="watchlist-share-label">7 day opens</span>
                  <strong>{watchlist.recentOpenCount ?? 0}</strong>
                </div>
                <div>
                  <span className="watchlist-share-label">Total opens</span>
                  <strong>{watchlist.accessCount ?? 0}</strong>
                </div>
                <div>
                  <span className="watchlist-share-label">Last opened</span>
                  <strong>{watchlist.lastAccessedAt ? formatTimestamp(watchlist.lastAccessedAt) : "No opens yet"}</strong>
                </div>
                <div>
                  <span className="watchlist-share-label">Created</span>
                  <strong>{formatTimestamp(watchlist.createdAt)}</strong>
                </div>
              </div>
              {watchlist.sourceContributions?.[0] ? (
                <p className="source-summary-copy">
                  {formatSourceContributionSummary(watchlist.sourceContributions[0])}
                </p>
              ) : null}
              {watchlist.ownerDisplayName ? (
                <p className="source-summary-copy">Shared by {watchlist.ownerDisplayName}</p>
              ) : null}
              <p className="source-summary-copy">
                {watchlist.expiresAt ? `Expires ${formatTimestamp(watchlist.expiresAt)}` : "No expiry"}
              </p>
              {watchlist.geoSummary?.length ? (
                <p className="source-summary-copy">{watchlist.geoSummary.map((geo) => geo.label).join(", ")}</p>
              ) : null}
            </article>
          ))
        )}
      </section>
    </main>
  );
}

export async function loadCommunityWatchlists(): Promise<PublicWatchlistsResponse> {
  const response = await fetch(`${await getBaseUrl()}/api/community/watchlists`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Could not load community watchlists");
  }
  return (await response.json()) as PublicWatchlistsResponse;
}

export function filterAndSortCommunityWatchlists(
  watchlists: PublicWatchlistSummary[],
  options: {
    query: string;
    sort: CommunitySort;
    popularOnly: boolean;
  },
) {
  const normalizedQuery = options.query.trim().toLowerCase();
  return watchlists
    .filter((watchlist) => {
      if (options.popularOnly && !watchlist.popularThisWeek) {
        return false;
      }
      if (normalizedQuery.length === 0) {
        return true;
      }
      return [
        watchlist.name,
        watchlist.ownerDisplayName ?? "",
        ...(watchlist.geoSummary?.map((geo) => geo.label) ?? []),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .sort((left, right) => {
      if (options.sort === "total") {
        return (right.accessCount ?? 0) - (left.accessCount ?? 0);
      }
      if (options.sort === "newest") {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
      return (right.recentOpenCount ?? 0) - (left.recentOpenCount ?? 0) || (right.accessCount ?? 0) - (left.accessCount ?? 0);
    });
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function readSortParam(value: string | string[] | undefined): CommunitySort {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "total" || raw === "newest") {
    return raw;
  }
  return "recent";
}

function readBooleanParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "true";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSourceLabel(source: string) {
  const labels: Record<string, string> = {
    reddit: "Reddit",
    hacker_news: "Hacker News",
    github: "GitHub",
    wikipedia: "Wikipedia",
    google_trends: "Google Trends",
    twitter: "Twitter/X",
  };
  return labels[source] ?? source;
}

function formatSourceContributionSummary(source: NonNullable<PublicWatchlistSummary["sourceContributions"]>[number]) {
  const components: Array<[string, number]> = [
    ["Social", source.score.social],
    ["Developer", source.score.developer],
    ["Knowledge", source.score.knowledge],
    ["Search", source.score.search],
    ["Diversity", source.score.diversity],
  ];
  const topComponents = components
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label, value]) => `${label} ${value.toFixed(1)}`);

  if (topComponents.length === 0) {
    return `${formatSourceLabel(source.source)} drove ${source.scoreSharePercent.toFixed(1)}%`;
  }
  return `${formatSourceLabel(source.source)} drove ${source.scoreSharePercent.toFixed(1)}% · ${topComponents.join(" · ")}`;
}
