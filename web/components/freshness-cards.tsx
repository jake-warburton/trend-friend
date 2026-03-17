"use client";

import { useEffect, useState } from "react";

type FreshnessItem = {
  key: string;
  label: string;
  timestamp: string | null;
  description: string;
};

function formatAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatAbsolute(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function FreshnessCards({ items }: { items: FreshnessItem[] }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="settings-provider-grid">
      {items.map((item) => {
        const ago = item.timestamp ? formatAgo(item.timestamp) : "No data";
        const absolute = item.timestamp
          ? `Generated at ${formatAbsolute(item.timestamp)} UTC`
          : "Dataset has not been generated yet.";

        return (
          <div className="settings-provider-card" key={item.key}>
            <div className="settings-provider-header">
              <strong>{item.label}</strong>
              <span className={item.timestamp ? "status-pill status-pill-success" : "status-pill"}>
                {ago}
              </span>
            </div>
            <p className="settings-copy">
              <strong>{absolute}</strong>
            </p>
            <p className="settings-copy">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}
