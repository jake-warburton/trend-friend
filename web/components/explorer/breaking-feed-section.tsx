"use client";

import { useState } from "react";
import type { BreakingFeed } from "@/lib/types";

export function BreakingFeedSection({ feed }: { feed: BreakingFeed | null }) {
  const ITEMS_PER_PAGE = 4;
  const [page, setPage] = useState(0);

  if (feed == null) {
    return (
      <section className="breaking-feed-section breaking-feed-skeleton">
        <div className="breaking-feed-header">
          <div className="breaking-feed-header-left">
            <span className="breaking-feed-dot" aria-hidden="true" />
            <h2 className="breaking-feed-title">Breaking</h2>
          </div>
        </div>
        <div className="breaking-feed-items">
          {Array.from({ length: 4 }, (_, i) => (
            <article className="breaking-feed-item skeleton-pulse" key={i}>
              <div className="breaking-feed-item-header">
                <span className="skeleton-line" style={{ width: "40%" }} />
                <span className="skeleton-line" style={{ width: "15%" }} />
              </div>
              <div className="skeleton-line" style={{ width: "90%" }} />
              <div className="skeleton-line" style={{ width: "70%" }} />
            </article>
          ))}
        </div>
      </section>
    );
  }
  if (feed.items.length === 0) {
    return null;
  }
  const sorted = [...feed.items].sort((a, b) => b.breakingScore - a.breakingScore);
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const visible = sorted.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const updatedLabel = feed.updatedAt
    ? new Date(feed.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section className="breaking-feed-section">
      <div className="breaking-feed-header">
        <div className="breaking-feed-header-left">
          <span className="breaking-feed-dot" aria-hidden="true" />
          <h2 className="breaking-feed-title">Breaking</h2>
          <span className="breaking-feed-count">{sorted.length}</span>
        </div>
        <div className="breaking-feed-header-right">
          {updatedLabel && (
            <span className="breaking-feed-updated">{updatedLabel}</span>
          )}
          {totalPages > 1 && (
            <div className="breaking-feed-pager">
              <button
                className="breaking-feed-pager-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className="breaking-feed-pager-label">
                {page + 1}/{totalPages}
              </span>
              <button
                className="breaking-feed-pager-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="breaking-feed-items">
        {visible.map((item) => (
          <article className="breaking-feed-item" key={item.topic}>
            <div className="breaking-feed-item-header">
              <strong className="breaking-feed-topic">{item.topic}</strong>
              <span className="breaking-feed-meta">
                <span className="breaking-feed-score">{item.breakingScore.toFixed(1)}</span>
                {item.corroborated && (
                  <span className="breaking-feed-corroborated">Corroborated</span>
                )}
                {item.accountCount > 1 && (
                  <span className="breaking-feed-accounts">{item.accountCount} accounts</span>
                )}
              </span>
            </div>
            <ul className="breaking-feed-tweets">
              {item.tweets.slice(0, 3).map((tweet) => (
                <li className="breaking-feed-tweet" key={tweet.tweetId}>
                  <a
                    href={`https://x.com/i/status/${tweet.tweetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="breaking-feed-tweet-link"
                  >
                    <span className="breaking-feed-account">@{tweet.account}</span>
                    <span className="breaking-feed-tweet-text">{tweet.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
