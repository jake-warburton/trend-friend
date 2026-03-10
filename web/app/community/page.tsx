import Link from "next/link";

import type { PublicWatchlistSummary, PublicWatchlistsResponse } from "@/lib/types";
import { getBaseUrl } from "@/app/shared/[token]/page";

export const dynamic = "force-dynamic";

const COMMUNITY_PAGE_SIZE = 9;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CommunitySort = "recent" | "total" | "newest";
type CommunityFilterOption = {
  value: string;
  label: string;
};

export default async function CommunityPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const query = readSearchParam(params.q);
  const sort = readSortParam(params.sort);
  const category = readSearchParam(params.category);
  const status = readSearchParam(params.status);
  const source = readSearchParam(params.source);
  const location = readSearchParam(params.location);
  const popularOnly = readBooleanParam(params.popular);
  const page = readPageParam(params.page);
  const directory = await loadCommunityWatchlists();
  const categoryOptions = listCommunityCategoryOptions(directory.watchlists);
  const statusOptions = listCommunityStatusOptions(directory.watchlists);
  const sourceOptions = listCommunitySourceOptions(directory.watchlists);
  const locationOptions = listCommunityLocationOptions(directory.watchlists);
  const filteredWatchlists = filterAndSortCommunityWatchlists(directory.watchlists, {
    query,
    sort,
    category,
    status,
    source,
    location,
    popularOnly,
  });
  const pagination = paginateCommunityWatchlists(filteredWatchlists, page);
  const pageUrlBuilder = createCommunityUrlBuilder({
    q: query,
    sort,
    category,
    status,
    source,
    location,
    popular: popularOnly,
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
        <label className="filter-field">
          <span>Category</span>
          <select className="select-trigger community-select" defaultValue={category} name="category">
            <option value="">All categories</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Status</span>
          <select className="select-trigger community-select" defaultValue={status} name="status">
            <option value="">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Source</span>
          <select className="select-trigger community-select" defaultValue={source} name="source">
            <option value="">All sources</option>
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Location</span>
          <select className="select-trigger community-select" defaultValue={location} name="location">
            <option value="">All locations</option>
            {locationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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

      <section className="community-results-bar">
        <p className="source-summary-copy">
          Showing {pagination.pageItems.length === 0 ? 0 : pagination.startIndex + 1}-{pagination.endIndex} of{" "}
          {filteredWatchlists.length} public watchlists
        </p>
        {pagination.totalPages > 1 ? (
          <p className="source-summary-copy">
            Page {pagination.currentPage} of {pagination.totalPages}
          </p>
        ) : null}
      </section>

      <section className="community-grid">
        {pagination.pageItems.length === 0 ? (
          <div className="empty-state">
            <h3>No public watchlists match</h3>
            <p className="source-summary-copy">
              Try a broader query or remove one of the active filters.
            </p>
          </div>
        ) : (
          pagination.pageItems.map((watchlist) => (
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
              {watchlist.categories?.length ? (
                <p className="source-summary-copy">Categories: {watchlist.categories.join(", ")}</p>
              ) : null}
              {watchlist.statuses?.length ? (
                <p className="source-summary-copy">Statuses: {watchlist.statuses.map(formatStatusLabel).join(", ")}</p>
              ) : null}
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

      {pagination.totalPages > 1 ? (
        <nav aria-label="Community pagination" className="community-pagination">
          {pagination.currentPage > 1 ? (
            <Link className="mini-action-button" href={pageUrlBuilder(pagination.currentPage - 1)}>
              Previous
            </Link>
          ) : (
            <span className="mini-action-button is-disabled">Previous</span>
          )}
          <div className="community-page-list">
            {pagination.pages.map((pageNumber) => (
              <Link
                aria-current={pageNumber === pagination.currentPage ? "page" : undefined}
                className={`mini-action-button ${pageNumber === pagination.currentPage ? "is-active" : ""}`}
                href={pageUrlBuilder(pageNumber)}
                key={pageNumber}
              >
                {pageNumber}
              </Link>
            ))}
          </div>
          {pagination.currentPage < pagination.totalPages ? (
            <Link className="mini-action-button" href={pageUrlBuilder(pagination.currentPage + 1)}>
              Next
            </Link>
          ) : (
            <span className="mini-action-button is-disabled">Next</span>
          )}
        </nav>
      ) : null}
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
    category: string;
    status: string;
    source: string;
    location: string;
    popularOnly: boolean;
  },
) {
  const normalizedQuery = options.query.trim().toLowerCase();
  const normalizedCategory = options.category.trim().toLowerCase();
  const normalizedStatus = options.status.trim().toLowerCase();
  const normalizedSource = options.source.trim().toLowerCase();
  const normalizedLocation = options.location.trim().toLowerCase();
  return watchlists
    .filter((watchlist) => {
      if (options.popularOnly && !watchlist.popularThisWeek) {
        return false;
      }
      if (
        normalizedCategory.length > 0 &&
        !(watchlist.categories ?? []).some((value) => value.toLowerCase() === normalizedCategory)
      ) {
        return false;
      }
      if (
        normalizedStatus.length > 0 &&
        !(watchlist.statuses ?? []).some((value) => value.toLowerCase() === normalizedStatus)
      ) {
        return false;
      }
      if (
        normalizedSource.length > 0 &&
        !(watchlist.sourceContributions ?? []).some(
          (contribution) => contribution.source.toLowerCase() === normalizedSource,
        )
      ) {
        return false;
      }
      if (
        normalizedLocation.length > 0 &&
        !(watchlist.geoSummary ?? []).some((geo) => geo.label.toLowerCase() === normalizedLocation)
      ) {
        return false;
      }
      if (normalizedQuery.length === 0) {
        return true;
      }
      return [
        watchlist.name,
        watchlist.ownerDisplayName ?? "",
        ...(watchlist.categories ?? []),
        ...(watchlist.statuses?.map(formatStatusLabel) ?? []),
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

export function listCommunityCategoryOptions(watchlists: PublicWatchlistSummary[]): CommunityFilterOption[] {
  return Array.from(
    new Set(watchlists.flatMap((watchlist) => watchlist.categories ?? [])),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
}

export function listCommunityStatusOptions(watchlists: PublicWatchlistSummary[]): CommunityFilterOption[] {
  return Array.from(
    new Set(watchlists.flatMap((watchlist) => watchlist.statuses ?? [])),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: formatStatusLabel(value) }));
}

export function listCommunitySourceOptions(watchlists: PublicWatchlistSummary[]): CommunityFilterOption[] {
  return Array.from(
    new Map(
      watchlists
        .flatMap((watchlist) => watchlist.sourceContributions ?? [])
        .map((source) => [source.source, { value: source.source, label: formatSourceLabel(source.source) }]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));
}

export function listCommunityLocationOptions(watchlists: PublicWatchlistSummary[]): CommunityFilterOption[] {
  return Array.from(
    new Map(
      watchlists
        .flatMap((watchlist) => watchlist.geoSummary ?? [])
        .map((geo) => [geo.label, { value: geo.label, label: geo.label }]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));
}

export function paginateCommunityWatchlists(watchlists: PublicWatchlistSummary[], page: number) {
  const totalPages = Math.max(1, Math.ceil(watchlists.length / COMMUNITY_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * COMMUNITY_PAGE_SIZE;
  const pageItems = watchlists.slice(startIndex, startIndex + COMMUNITY_PAGE_SIZE);
  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex: pageItems.length === 0 ? 0 : startIndex + pageItems.length,
    pageItems,
    pages: Array.from({ length: totalPages }, (_, index) => index + 1),
  };
}

export function createCommunityUrlBuilder(filters: {
  q: string;
  sort: CommunitySort;
  category: string;
  status: string;
  source: string;
  location: string;
  popular: boolean;
}) {
  return (page: number) => {
    const params = new URLSearchParams();
    if (filters.q) {
      params.set("q", filters.q);
    }
    if (filters.sort !== "recent") {
      params.set("sort", filters.sort);
    }
    if (filters.category) {
      params.set("category", filters.category);
    }
    if (filters.status) {
      params.set("status", filters.status);
    }
    if (filters.source) {
      params.set("source", filters.source);
    }
    if (filters.location) {
      params.set("location", filters.location);
    }
    if (filters.popular) {
      params.set("popular", "true");
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    const query = params.toString();
    return query.length > 0 ? `/community?${query}` : "/community";
  };
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

function readPageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
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
