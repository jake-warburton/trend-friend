"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useScreenshotMode } from "@/lib/use-screenshot-mode";
import { useAuth } from "@/components/auth-provider";
import { useProfile } from "@/components/profile-provider";
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

export function SocialIntelligenceDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isPro, loading: profileLoading } = useProfile();
  const isScreenshot = useScreenshotMode();
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[] | null>(null);
  const [breakingFeed, setBreakingFeed] = useState<BreakingFeed | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const shouldShow = isScreenshot || (isPro && !authLoading && !profileLoading);

  useEffect(() => {
    if (!shouldShow) { setLoading(false); return; }
    Promise.all([
      fetch("/api/trends/hashtags").then((r) => r.ok ? r.json() : null),
      fetch("/api/breaking").then((r) => r.ok ? r.json() : null),
    ])
      .then(([hashtagData, feedData]) => {
        setTrendingTopics(hashtagData?.trends ?? []);
        setBreakingFeed(feedData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shouldShow]);

  if (!shouldShow) return null;
  if (loading) return <Skeleton />;

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
