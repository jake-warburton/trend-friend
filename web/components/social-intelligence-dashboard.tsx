"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BreakingFeedSection } from "@/components/explorer/breaking-feed-section";
import { TrendingCarousel } from "@/components/explorer/trending-carousel";
import type { BreakingFeed } from "@/lib/types";

const SocialGeoMap = dynamic(
  () => import("@/components/social-geo-map").then((mod) => mod.SocialGeoMap),
  { ssr: false, loading: () => <div className="skeleton-pulse" style={{ width: "100%", height: 280, borderRadius: 12 }} /> },
);

interface TrendingTopic {
  name: string;
  category: string;
  location: string;
  tweet_volume: number | null;
  domain_context: string | null;
  fetched_at: string;
}

interface HashtagResponse {
  trends?: TrendingTopic[];
  latestFetchedAt?: string | null;
}

function Skeleton() {
  return (
    <div className="social-intel-wrap">
      <div className="social-intel-header">
        <div className="skeleton-pulse" style={{ width: 240, height: 26, borderRadius: 6 }} />
        <div className="skeleton-pulse" style={{ width: 340, height: 14, borderRadius: 4, marginTop: 8 }} />
      </div>
      <div className="skeleton-pulse" style={{ width: "100%", height: 120, borderRadius: 12, marginTop: 24 }} />
      <div className="skeleton-pulse" style={{ width: "100%", height: 200, borderRadius: 12, marginTop: 16 }} />
    </div>
  );
}

export function formatSocialTimestamp(timestamp: string | null | undefined): string | null {
  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function SocialIntelligenceDashboard() {
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[] | null>(null);
  const [breakingFeed, setBreakingFeed] = useState<BreakingFeed | null>(null);
  const [latestFetchedAt, setLatestFetchedAt] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/trends/hashtags").then((r) => r.ok ? r.json() : null),
      fetch("/api/breaking").then((r) => r.ok ? r.json() : null),
    ])
      .then(([hashtagData, feedData]: [HashtagResponse | null, BreakingFeed | null]) => {
        setTrendingTopics(hashtagData?.trends ?? []);
        setLatestFetchedAt(hashtagData?.latestFetchedAt ?? null);
        setBreakingFeed(feedData);
        setHasError(false);
      })
      .catch(() => {
        setHasError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <style>{`.social-intel-teaser { display: none !important; }`}</style>
        <Skeleton />
      </>
    );
  }

  const hasTrendingTopics = (trendingTopics?.length ?? 0) > 0;
  const hasBreakingItems = (breakingFeed?.items?.length ?? 0) > 0;
  const lastUpdatedLabel = formatSocialTimestamp(latestFetchedAt ?? breakingFeed?.updatedAt ?? null);

  if (hasError) {
    return (
      <>
        <style>{`.social-intel-teaser { display: none !important; }`}</style>
        <div className="social-intel-wrap">
          <div className="social-intel-header">
            <h1>Social Intelligence</h1>
            <p>Real-time trending topics and breaking news from curated X accounts.</p>
          </div>
          <section className="adi-gate" style={{ marginTop: 24 }}>
            <div className="adi-gate-inner">
              <div className="adi-gate-badge">Data unavailable</div>
              <p className="adi-gate-copy">
                The social feeds could not be loaded from Supabase right now.
              </p>
            </div>
          </section>
        </div>
      </>
    );
  }

  if (!hasTrendingTopics && !hasBreakingItems) {
    return (
      <>
        <style>{`.social-intel-teaser { display: none !important; }`}</style>
        <div className="social-intel-wrap">
          <div className="social-intel-header">
            <h1>Social Intelligence</h1>
            <p>Real-time trending topics and breaking news from curated X accounts.</p>
          </div>
          <section className="adi-gate" style={{ marginTop: 24 }}>
            <div className="adi-gate-inner">
              <div className="adi-gate-badge">No live items</div>
              <p className="adi-gate-copy">
                No recent social trend rows or breaking items are currently published.
                {lastUpdatedLabel ? ` Last checked ${lastUpdatedLabel}.` : ""}
              </p>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`.social-intel-teaser { display: none !important; }`}</style>
      <div className="social-intel-wrap">
        <div className="social-intel-header">
          <h1>Social Intelligence</h1>
          <p>Real-time trending topics and breaking news from curated X accounts.</p>
        </div>
        <SocialGeoMap
          trends={trendingTopics ?? []}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
        />
        <TrendingCarousel trends={trendingTopics} selectedLocation={selectedLocation} />
        <BreakingFeedSection feed={breakingFeed} />
      </div>
    </>
  );
}
