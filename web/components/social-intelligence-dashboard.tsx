"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

function ProGate() {
  return (
    <div className="adi-gate">
      <div className="adi-gate-inner">
        <div className="adi-gate-badge">PRO</div>
        <h1 className="adi-gate-title">Social Intelligence</h1>
        <p className="adi-gate-copy">
          Real-time trending topics, breaking news from curated X accounts, and hashtag tracking across 10+ countries — available on Pro.
        </p>
        <div className="adi-gate-preview">
          <div className="adi-gate-blur" />
          <div style={{ opacity: 0.3, padding: "16px 0" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {["#AI", "#Bitcoin", "#BreakingNews", "#Tech", "#Markets"].map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "8px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <a href="/pricing" className="adi-gate-cta">
          Upgrade to Pro
        </a>
      </div>
    </div>
  );
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
  const router = useRouter();
  const isScreenshot = useScreenshotMode();
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[] | null>(null);
  const [breakingFeed, setBreakingFeed] = useState<BreakingFeed | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = () =>
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

    if (isScreenshot) { fetchData(); return; }
    if (authLoading || profileLoading) return;
    if (!user || !isPro) {
      router.replace(user ? "/pricing" : "/login?next=/social-intelligence");
      return;
    }
    fetchData();
  }, [isPro, profileLoading, authLoading, user, router, isScreenshot]);

  if (!isScreenshot && (authLoading || profileLoading || loading)) return <Skeleton />;
  if (!isScreenshot && !isPro) return <ProGate />;
  if (loading) return <Skeleton />;

  return (
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
  );
}
