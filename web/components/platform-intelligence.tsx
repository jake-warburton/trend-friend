"use client";

import { useState } from "react";
import type {
  TrendSourceContribution,
  TrendMarketMetric,
  TrendEvidenceItem,
  TrendSourceBreakdown,
} from "@/lib/types";
import type { SourceContributionInsight } from "@/lib/source-health";

type PlatformDossier = {
  source: string;
  label: string;
  family: string;
  signalType: string;
  contribution: SourceContributionInsight | null;
  breakdown: TrendSourceBreakdown | null;
  metrics: TrendMarketMetric[];
  evidence: TrendEvidenceItem[];
  totalSignals: number;
  scoreShare: number;
  estimatedScore: number;
};

type PlatformIntelligenceProps = {
  sourceContributions: TrendSourceContribution[];
  sourceBreakdown: TrendSourceBreakdown[];
  marketFootprint: TrendMarketMetric[];
  evidenceItems: TrendEvidenceItem[];
  sourceInsights: SourceContributionInsight[];
  showEstimatedMetrics: boolean;
};

const SOURCE_FAMILIES: Record<string, string> = {
  github: "developer",
  npm: "developer",
  pypi: "developer",
  stackoverflow: "developer",
  huggingface: "research",
  reddit: "community",
  hacker_news: "community",
  lobsters: "community",
  devto: "community",
  mastodon: "community",
  youtube: "social",
  twitter: "social",
  google_trends: "search",
  google_news: "news",
  curated_feeds: "news",
  arxiv: "research",
  wikipedia: "knowledge",
  producthunt: "launch",
  chrome_web_store: "launch",
  apple_charts: "launch",
  polymarket: "market",
  coingecko: "market",
  tiktok: "social",
  pinterest: "social",
  google_search: "search",
  score_history: "analytics",
};

const SIGNAL_TYPES: Record<string, string> = {
  github: "developer",
  npm: "developer",
  pypi: "developer",
  stackoverflow: "developer",
  huggingface: "developer",
  reddit: "social",
  hacker_news: "social",
  lobsters: "social",
  devto: "social",
  mastodon: "social",
  youtube: "social",
  twitter: "social",
  google_trends: "search",
  google_news: "knowledge",
  curated_feeds: "knowledge",
  arxiv: "knowledge",
  wikipedia: "knowledge",
  producthunt: "social",
  chrome_web_store: "social",
  apple_charts: "social",
  polymarket: "search",
  coingecko: "search",
  tiktok: "social",
  pinterest: "social",
  google_search: "search",
  score_history: "analytics",
};

const FAMILY_COLORS: Record<string, string> = {
  developer: "var(--platform-developer, #58a6ff)",
  community: "var(--platform-community, #f0883e)",
  social: "var(--platform-social, #db61a2)",
  search: "var(--platform-search, #3fb950)",
  news: "var(--platform-news, #d2a8ff)",
  research: "var(--platform-research, #79c0ff)",
  knowledge: "var(--platform-knowledge, #8b949e)",
  launch: "var(--platform-launch, #f778ba)",
  market: "var(--platform-market, #56d364)",
  analytics: "var(--platform-analytics, #8b949e)",
};

const FAMILY_ICONS: Record<string, string> = {
  developer: "⌘",
  community: "◉",
  social: "◈",
  search: "⊕",
  news: "◆",
  research: "△",
  knowledge: "□",
  launch: "★",
  market: "◇",
  analytics: "◎",
};

function formatSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    github: "GitHub",
    npm: "npm",
    pypi: "PyPI",
    stackoverflow: "Stack Overflow",
    huggingface: "Hugging Face",
    reddit: "Reddit",
    hacker_news: "Hacker News",
    lobsters: "Lobsters",
    devto: "Dev.to",
    mastodon: "Mastodon",
    youtube: "YouTube",
    twitter: "X / Twitter",
    google_trends: "Google Trends",
    google_news: "Google News",
    curated_feeds: "News Feeds",
    arxiv: "arXiv",
    wikipedia: "Wikipedia",
    producthunt: "Product Hunt",
    chrome_web_store: "Chrome Web Store",
    apple_charts: "App Store",
    polymarket: "Polymarket",
    coingecko: "CoinGecko",
    tiktok: "TikTok",
    pinterest: "Pinterest",
    google_search: "Google Search",
    score_history: "Score History",
  };
  return labels[source] ?? source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeEvidenceUrl(url: string): string {
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function buildPlatformDossiers(props: PlatformIntelligenceProps): PlatformDossier[] {
  const { sourceContributions, sourceBreakdown, marketFootprint, evidenceItems, sourceInsights, showEstimatedMetrics } = props;

  // Collect all unique sources
  const allSources = new Set<string>();
  sourceContributions.forEach((c) => allSources.add(c.source));
  sourceBreakdown.forEach((b) => allSources.add(b.source));
  marketFootprint.forEach((m) => allSources.add(m.source));
  evidenceItems.forEach((e) => allSources.add(e.source));

  const dossiers: PlatformDossier[] = [];

  for (const source of allSources) {
    const contribution = sourceContributions.find((c) => c.source === source) ?? null;
    const breakdown = sourceBreakdown.find((b) => b.source === source) ?? null;
    const insight = sourceInsights.find((i) => i.source === source) ?? null;
    const metrics = marketFootprint.filter((m) => {
      if (m.source !== source) return false;
      if (!showEstimatedMetrics && m.isEstimated) return false;
      return true;
    });
    const evidence = evidenceItems.filter((e) => e.source === source);
    const totalSignals = contribution?.signalCount ?? breakdown?.signalCount ?? evidence.length;

    dossiers.push({
      source,
      label: formatSourceLabel(source),
      family: SOURCE_FAMILIES[source] ?? "other",
      signalType: SIGNAL_TYPES[source] ?? "social",
      contribution: insight,
      breakdown,
      metrics,
      evidence,
      totalSignals,
      scoreShare: contribution?.scoreSharePercent ?? 0,
      estimatedScore: contribution?.estimatedScore ?? 0,
    });
  }

  // Sort: highest signal count first, then by score share
  dossiers.sort((a, b) => {
    if (b.scoreShare !== a.scoreShare) return b.scoreShare - a.scoreShare;
    return b.totalSignals - a.totalSignals;
  });

  return dossiers;
}

function PlatformCard({ dossier, rank }: { dossier: PlatformDossier; rank: number }) {
  const [expanded, setExpanded] = useState(rank < 3);
  const familyColor = FAMILY_COLORS[dossier.family] ?? "var(--muted)";
  const familyIcon = FAMILY_ICONS[dossier.family] ?? "·";
  const hasContent = dossier.metrics.length > 0 || dossier.evidence.length > 0;

  return (
    <article className="pi-card" data-family={dossier.family}>
      <button
        className="pi-card-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        type="button"
      >
        <div className="pi-card-identity">
          <span className="pi-card-icon" style={{ color: familyColor }}>
            {familyIcon}
          </span>
          <div className="pi-card-title-group">
            <strong className="pi-card-name">{dossier.label}</strong>
            <span className="pi-card-family">{dossier.family}</span>
          </div>
        </div>

        <div className="pi-card-stats">
          {dossier.totalSignals > 0 && (
            <span className="pi-stat">
              <span className="pi-stat-value">{dossier.totalSignals}</span>
              <span className="pi-stat-label">signals</span>
            </span>
          )}
          {dossier.scoreShare > 0 && (
            <span className="pi-stat">
              <span className="pi-stat-value">{dossier.scoreShare.toFixed(0)}%</span>
              <span className="pi-stat-label">score</span>
            </span>
          )}
          {dossier.metrics.length > 0 && (
            <span className="pi-stat">
              <span className="pi-stat-value">{dossier.metrics.length}</span>
              <span className="pi-stat-label">metrics</span>
            </span>
          )}
          <span className="pi-expand-indicator" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </button>

      {expanded && hasContent && (
        <div className="pi-card-body">
          {/* Score contribution bar */}
          {dossier.scoreShare > 0 && (
            <div className="pi-score-bar-container">
              <div
                className="pi-score-bar"
                style={{
                  width: `${Math.min(dossier.scoreShare, 100)}%`,
                  background: familyColor,
                }}
              />
              <span className="pi-score-bar-label">
                {dossier.estimatedScore.toFixed(1)} pts estimated contribution
              </span>
            </div>
          )}

          {/* Market metrics */}
          {dossier.metrics.length > 0 && (
            <div className="pi-metrics">
              {dossier.metrics.map((metric) => (
                <div className="pi-metric" key={`${metric.source}-${metric.metricKey}`}>
                  <div className="pi-metric-value">
                    {metric.provenanceUrl ? (
                      <a href={metric.provenanceUrl} target="_blank" rel="noreferrer" className="pi-metric-link">
                        {metric.valueDisplay}
                      </a>
                    ) : (
                      metric.valueDisplay
                    )}
                  </div>
                  <div className="pi-metric-label">{metric.label}</div>
                  <div className="pi-metric-meta">
                    {metric.period}
                    {metric.isEstimated && <span className="pi-estimated-tag">est.</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Evidence items */}
          {dossier.evidence.length > 0 && (
            <div className="pi-evidence">
              <div className="pi-evidence-header">
                Evidence ({dossier.evidence.length})
              </div>
              {dossier.evidence.map((item, index) => (
                <div className="pi-evidence-item" key={`${item.timestamp}-${index}`}>
                  <div className="pi-evidence-text">
                    {item.evidenceUrl ? (
                      <a href={normalizeEvidenceUrl(item.evidenceUrl)} target="_blank" rel="noreferrer" className="pi-evidence-link">
                        {item.evidence}
                      </a>
                    ) : (
                      item.evidence
                    )}
                  </div>
                  <div className="pi-evidence-meta">
                    {item.signalType} · value {item.value.toFixed(1)} ·{" "}
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(item.timestamp))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contribution details */}
          {dossier.contribution && (
            <div className="pi-contribution-detail">
              <span>{dossier.contribution.mixSummary}</span>
              {dossier.contribution.fetchSummary && (
                <span>{dossier.contribution.fetchSummary}</span>
              )}
              {dossier.contribution.warning && (
                <span className="pi-warning">{dossier.contribution.warning}</span>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function PlatformIntelligence(props: PlatformIntelligenceProps) {
  const dossiers = buildPlatformDossiers(props);

  if (dossiers.length === 0) {
    return (
      <div className="pi-empty">
        No platform signals detected yet.
      </div>
    );
  }

  // Group by family for the family summary bar
  const familyTotals = new Map<string, { signals: number; sources: number; share: number }>();
  for (const d of dossiers) {
    const existing = familyTotals.get(d.family) ?? { signals: 0, sources: 0, share: 0 };
    existing.signals += d.totalSignals;
    existing.sources += 1;
    existing.share += d.scoreShare;
    familyTotals.set(d.family, existing);
  }

  const sortedFamilies = [...familyTotals.entries()].sort((a, b) => b[1].share - a[1].share);
  const totalShare = sortedFamilies.reduce((sum, [, f]) => sum + f.share, 0);

  return (
    <div className="pi-container">
      {/* Family composition bar */}
      <div className="pi-composition">
        <div className="pi-composition-bar">
          {sortedFamilies.map(([family, data]) => {
            const width = totalShare > 0 ? (data.share / totalShare) * 100 : 0;
            if (width < 1) return null;
            return (
              <div
                key={family}
                className="pi-composition-segment"
                style={{
                  width: `${width}%`,
                  background: FAMILY_COLORS[family] ?? "var(--muted)",
                }}
                title={`${family}: ${data.share.toFixed(0)}% score share`}
              />
            );
          })}
        </div>
        <div className="pi-composition-legend">
          {sortedFamilies.map(([family, data]) => (
            <span key={family} className="pi-composition-legend-item">
              <span
                className="pi-composition-dot"
                style={{ background: FAMILY_COLORS[family] ?? "var(--muted)" }}
              />
              {family} ({data.sources})
            </span>
          ))}
        </div>
      </div>

      {/* Platform cards */}
      <div className="pi-cards">
        {dossiers.map((dossier, index) => (
          <PlatformCard key={dossier.source} dossier={dossier} rank={index} />
        ))}
      </div>
    </div>
  );
}
