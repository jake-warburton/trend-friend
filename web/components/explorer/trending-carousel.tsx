"use client";

import { useEffect, useRef, useState } from "react";

interface TrendingTopic {
  name: string;
  category: string;
  location: string;
  tweet_volume: number | null;
  domain_context: string | null;
  fetched_at: string;
}

interface TrendingCarouselProps {
  trends: TrendingTopic[] | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  trending: "Trending",
  "for-you": "For You",
  news: "News",
  sports: "Sports",
  entertainment: "Entertainment",
  place: "By Location",
};

const LOCATION_FLAGS: Record<string, string> = {
  Worldwide: "\u{1F30D}",
  "United States": "\u{1F1FA}\u{1F1F8}",
  "United Kingdom": "\u{1F1EC}\u{1F1E7}",
  Australia: "\u{1F1E6}\u{1F1FA}",
  Canada: "\u{1F1E8}\u{1F1E6}",
  Germany: "\u{1F1E9}\u{1F1EA}",
  France: "\u{1F1EB}\u{1F1F7}",
  Japan: "\u{1F1EF}\u{1F1F5}",
  India: "\u{1F1EE}\u{1F1F3}",
  Brazil: "\u{1F1E7}\u{1F1F7}",
};

function formatVolume(volume: number | null): string | null {
  if (volume == null || volume === 0) return null;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(0)}K`;
  return String(volume);
}

function deduplicateTrends(trends: TrendingTopic[]): TrendingTopic[] {
  const seen = new Set<string>();
  return trends.filter((t) => {
    const key = t.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function TrendingCarousel({ trends }: TrendingCarouselProps) {
  const [activeFilter, setActiveFilter] = useState<string>("trending");
  const scrollRef = useRef<HTMLDivElement>(null);

  if (trends == null || trends.length === 0) return null;

  const categories = [...new Set(trends.map((t) => t.category))];
  const filtered = deduplicateTrends(
    trends.filter((t) => t.category === activeFilter),
  );

  if (filtered.length === 0) return null;

  return (
    <section className="trending-carousel">
      <div className="trending-carousel-header">
        <div className="trending-carousel-header-left">
          <span className="trending-carousel-icon" aria-hidden="true">𝕏</span>
          <h2 className="trending-carousel-title">Trending on X</h2>
          <span className="trending-carousel-count">{filtered.length}</span>
        </div>
        <div className="trending-carousel-tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`trending-carousel-tab${activeFilter === cat ? " active" : ""}`}
              onClick={() => {
                setActiveFilter(cat);
                scrollRef.current?.scrollTo({ left: 0, behavior: "instant" });
              }}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>
      <div className="trending-carousel-track" ref={scrollRef}>
        {filtered.map((trend, i) => (
          <a
            key={`${trend.name}-${i}`}
            className="trending-carousel-chip"
            href={`https://x.com/search?q=${encodeURIComponent(trend.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <span className="trending-chip-rank">{i + 1}</span>
            <span className="trending-chip-name">{trend.name}</span>
            {trend.category === "place" && LOCATION_FLAGS[trend.location] && (
              <span className="trending-chip-flag">{LOCATION_FLAGS[trend.location]}</span>
            )}
            {formatVolume(trend.tweet_volume) && (
              <span className="trending-chip-volume">{formatVolume(trend.tweet_volume)}</span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
