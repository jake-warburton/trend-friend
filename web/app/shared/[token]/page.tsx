import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { SharedWatchlistResponse } from "@/lib/types";

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

  return (
    <main className="shared-page">
      <section className="shared-hero">
        <p className="eyebrow">Shared Watchlist</p>
        <h1>{payload.watchlist.name}</h1>
        <p className="source-summary-copy">
          {payload.watchlist.itemCount} tracked trends | {payload.public ? "Public link" : "Private token link"}
        </p>
        <p className="source-summary-copy">Created {formatTimestamp(payload.createdAt)}</p>
        <Link className="refresh-button shared-back-link" href="/">
          Back to dashboard
        </Link>
      </section>

      <section className="shared-grid">
        {payload.watchlist.items.map((item) => (
          <article className="snapshot-card shared-item-card" key={item.trendId}>
            <header>
              <strong>
                <Link className="trend-link" href={`/trends/${item.trendId}`}>
                  {item.trendName}
                </Link>
              </strong>
              <span>{item.currentScore != null ? item.currentScore.toFixed(1) : "No score"}</span>
            </header>
            <p className="source-summary-copy">Added {formatTimestamp(item.addedAt)}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export async function loadSharedWatchlist(token: string): Promise<SharedWatchlistResponse | null> {
  const response = await fetch(`${await getBaseUrl()}/api/shared/${token}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
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
