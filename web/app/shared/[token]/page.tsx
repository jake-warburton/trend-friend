import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { SharedWatchlistResponse, TrendGeoSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharedWatchlistPage({ params }: PageProps) {
  const { token } = await params;
  const payload = await loadSharedWatchlist(token);

  if (payload == null) {
    notFound();
  }
  if (payload === "expired") {
    return (
      <main className="shared-page">
        <section className="shared-hero">
          <p className="eyebrow">Shared Watchlist</p>
          <h1>Link expired</h1>
          <p className="source-summary-copy">This share link is no longer available.</p>
          <Link className="refresh-button shared-back-link" href="/">
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shared-page">
      <section className="shared-hero">
        <p className="eyebrow">Shared Watchlist</p>
        <h1>{payload.watchlist.name}</h1>
        <p className="source-summary-copy">
          {payload.watchlist.itemCount} tracked trends | {payload.public ? "Public link" : "Private token link"}
        </p>
        {payload.ownerDisplayName ? (
          <p className="source-summary-copy">Shared by {payload.ownerDisplayName}</p>
        ) : null}
        <p className="source-summary-copy">
          {payload.expiresAt ? `Expires ${formatTimestamp(payload.expiresAt)}` : "No expiry"}
        </p>
        <p className="source-summary-copy">Created {formatTimestamp(payload.createdAt)}</p>
        <Link className="refresh-button shared-back-link" href="/">
          Back to dashboard
        </Link>
      </section>

      <section className="shared-grid">
        {payload.watchlist.items.map((item) => {
          const geo = item.geoSummary ?? [];
          const contributions = item.sourceContributions ?? [];
          return (
            <article className="snapshot-card shared-item-card" key={item.trendId}>
              <header>
                <strong>
                  <Link className="trend-link" href={`/trends/${item.trendId}`}>
                    {item.trendName}
                  </Link>
                </strong>
                <span>{item.currentScore != null ? item.currentScore.toFixed(1) : "No score"}</span>
              </header>
              <div className="shared-item-meta">
                {item.rank != null && <span className="shared-rank">#{item.rank}</span>}
                {item.status && (
                  <span className={`trend-status-pill trend-status-pill-${item.status}`}>{item.status}</span>
                )}
                {item.rankChange != null && item.rankChange !== 0 && (
                  <span className={`movement-pill ${item.rankChange > 0 ? "movement-pill-up" : "movement-pill-down"}`}>
                    {item.rankChange > 0 ? "+" : ""}{item.rankChange}
                  </span>
                )}
                {item.category && <span className="shared-category">{item.category}</span>}
              </div>
              {item.sources.length > 0 && (
                <p className="source-summary-copy">{item.sources.map(formatSourceLabel).join(", ")}</p>
              )}
              {contributions[0] && (
                <p className="source-summary-copy">
                  {formatSourceContributionSummary(contributions[0])}
                </p>
              )}
              {geo.length > 0 && (
                <p className="source-summary-copy">
                  {geo.map((g: TrendGeoSummary) => g.label).join(", ")}
                </p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

export async function loadSharedWatchlist(token: string): Promise<SharedWatchlistResponse | "expired" | null> {
  const response = await fetch(`${await getBaseUrl()}/api/shared/${token}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }
  if (response.status === 410) {
    return "expired";
  }
  if (!response.ok) {
    throw new Error("Could not load shared watchlist");
  }
  return (await response.json()) as SharedWatchlistResponse;
}

export async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
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

function formatSourceContributionSummary(source: NonNullable<SharedWatchlistResponse["watchlist"]["items"][number]["sourceContributions"]>[number]) {
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
    return `${formatSourceLabel(source.source)} drove ${source.scoreSharePercent.toFixed(1)}% of the score`;
  }
  return `${formatSourceLabel(source.source)} drove ${source.scoreSharePercent.toFixed(1)}% · ${topComponents.join(" · ")}`;
}
