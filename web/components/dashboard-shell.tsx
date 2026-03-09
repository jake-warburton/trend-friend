"use client";

import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { DashboardData, TrendRecord } from "@/lib/types";

type DashboardShellProps = {
  initialData: DashboardData;
};

const SOURCE_FILTER_OPTIONS = [
  { label: "All sources", value: "all" },
  { label: "Reddit", value: "reddit" },
  { label: "Hacker News", value: "hacker_news" },
  { label: "GitHub", value: "github" },
  { label: "Wikipedia", value: "wikipedia" },
] as const;

export function DashboardShell({ initialData }: DashboardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [minimumScore, setMinimumScore] = useState<number | null>(0);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const deferredKeyword = useDeferredValue(keyword);

  const filteredTrends = useMemo(() => {
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();
    const minimum = minimumScore ?? 0;
    return initialData.latest.trends.filter((trend) => {
      const matchesSource =
        selectedSource === "all" || trend.sources.includes(selectedSource);
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        trend.name.toLowerCase().includes(normalizedKeyword) ||
        trend.evidence.some((item) => item.toLowerCase().includes(normalizedKeyword));
      const matchesScore = trend.score.total >= minimum;
      return matchesSource && matchesKeyword && matchesScore;
    });
  }, [deferredKeyword, initialData.latest.trends, minimumScore, selectedSource]);

  function handleRefresh() {
    setRefreshError(null);
    startTransition(async () => {
      const response = await fetch("/api/refresh", { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setRefreshError(payload.error ?? "Refresh failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="dashboard-page">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Trend Friend</p>
          <h1>Emerging signals, ranked for a browser workflow.</h1>
          <p className="hero-copy">
            Local Python ingestion powers the ranking engine. This dashboard reads the exported
            contract that will later become the product API.
          </p>
        </div>
        <div className="hero-meta">
          <div className="stat-card">
            <span>Latest snapshot</span>
            <strong>{formatTimestamp(initialData.latest.generatedAt)}</strong>
          </div>
          <div className="stat-card">
            <span>Stored snapshots</span>
            <strong>{initialData.history.snapshots.length}</strong>
          </div>
          <Button className="refresh-button" disabled={isPending} onClick={handleRefresh}>
            {isPending ? "Refreshing..." : "Refresh trends"}
          </Button>
        </div>
      </section>

      <section className="filters-panel">
        <label className="filter-field">
          <span>Keyword</span>
          <Input
            className="text-input"
            placeholder="AI agents, robotics, battery..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>

        <label className="filter-field">
          <span>Source</span>
          <Select.Root value={selectedSource} onValueChange={(value) => setSelectedSource(value ?? "all")}>
            <Select.Trigger className="select-trigger">
              <Select.Value />
              <Select.Icon className="select-icon">+</Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className="select-positioner" sideOffset={8}>
                <Select.Popup className="select-popup">
                  <Select.List className="select-list">
                    {SOURCE_FILTER_OPTIONS.map((option) => (
                      <Select.Item className="select-item" key={option.value} value={option.value}>
                        <Select.ItemText>{option.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </label>

        <label className="filter-field">
          <span>Minimum score</span>
          <NumberField.Root
            className="number-field"
            min={0}
            value={minimumScore}
            onValueChange={setMinimumScore}
          >
            <NumberField.Group className="number-group">
              <NumberField.Decrement className="number-button">-</NumberField.Decrement>
              <NumberField.Input className="number-input" />
              <NumberField.Increment className="number-button">+</NumberField.Increment>
            </NumberField.Group>
          </NumberField.Root>
        </label>
      </section>

      {refreshError ? <p className="error-banner">{refreshError}</p> : null}

      <section className="content-grid">
        <div className="ranking-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Latest ranking</p>
              <h2>{filteredTrends.length} trends match the current filters</h2>
            </div>
          </div>

          <div className="trend-list">
            {filteredTrends.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
            {filteredTrends.length === 0 ? (
              <div className="empty-state">
                <h3>No trends match these filters.</h3>
                <p>Lower the minimum score or broaden the keyword and source filters.</p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="history-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent runs</p>
              <h2>Snapshot history</h2>
            </div>
          </div>

          <div className="snapshot-list">
            {initialData.history.snapshots.map((snapshot) => (
              <section className="snapshot-card" key={snapshot.capturedAt}>
                <header>
                  <strong>{formatTimestamp(snapshot.capturedAt)}</strong>
                  <span>{snapshot.trends.length} stored ranks</span>
                </header>
                <ol>
                  {snapshot.trends.slice(0, 3).map((trend) => (
                    <li key={trend.id}>
                      <span>{trend.name}</span>
                      <strong>{trend.score.total.toFixed(1)}</strong>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function TrendCard({ trend }: { trend: TrendRecord }) {
  return (
    <article className="trend-card">
      <div className="trend-header">
        <div>
          <p className="trend-rank">#{trend.rank}</p>
          <h3>{trend.name}</h3>
        </div>
        <div className="score-pill">{trend.score.total.toFixed(1)}</div>
      </div>

      <div className="score-grid">
        <ScoreColumn label="Social" value={trend.score.social} />
        <ScoreColumn label="Developer" value={trend.score.developer} />
        <ScoreColumn label="Knowledge" value={trend.score.knowledge} />
        <ScoreColumn label="Diversity" value={trend.score.diversity} />
      </div>

      <div className="source-row">
        {trend.sources.map((source) => (
          <span className="source-badge" key={source}>
            {formatSourceLabel(source)}
          </span>
        ))}
      </div>

      <p className="evidence-copy">{trend.evidence[0] ?? "No evidence available."}</p>
      <p className="signal-time">Latest signal: {formatTimestamp(trend.latestSignalAt)}</p>
    </article>
  );
}

function ScoreColumn({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-column">
      <span>{label}</span>
      <strong>{value.toFixed(1)}</strong>
    </div>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSourceLabel(source: string) {
  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
