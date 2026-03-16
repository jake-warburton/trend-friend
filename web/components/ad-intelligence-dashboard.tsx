"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useProfile } from "@/components/profile-provider";
import type { AdIntelligenceResponse, AdIntelligenceKeyword, AdIntelligenceAdvertiser, AdIntelligencePlatformSummary } from "@/lib/types";

/* ── platform identity ─────────────────────────────────────────── */

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  google_keyword_planner: { label: "Google", color: "#4285f4", icon: "G" },
  facebook_ad_library:    { label: "Meta",   color: "#0082fb", icon: "M" },
  google_ads_transparency:{ label: "Google Ads", color: "#34a853", icon: "A" },
  tiktok_ads:             { label: "TikTok", color: "#fe2c55", icon: "T" },
};

function platformLabel(source: string): string {
  return PLATFORM_META[source]?.label ?? source;
}
function platformColor(source: string): string {
  return PLATFORM_META[source]?.color ?? "var(--accent)";
}
function platformIcon(source: string): string {
  return PLATFORM_META[source]?.icon ?? "?";
}

/* ── helpers ────────────────────────────────────────────────────── */

function competitionColor(level: string): string {
  if (level === "HIGH") return "var(--danger-text, #ff6b6b)";
  if (level === "MEDIUM") return "var(--warning-text, #ffc56e)";
  if (level === "LOW") return "var(--success-text, #7fe0a7)";
  return "var(--muted)";
}

function competitionBarWidth(level: string): number {
  if (level === "HIGH") return 100;
  if (level === "MEDIUM") return 60;
  if (level === "LOW") return 30;
  return 10;
}

function cpcIntensity(cpc: number, maxCpc: number): number {
  if (maxCpc <= 0) return 0.4;
  return 0.4 + (cpc / maxCpc) * 0.6;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ── sub-components ─────────────────────────────────────────────── */

function PlatformBadge({ source, size = "sm" }: { source: string; size?: "sm" | "md" }) {
  const color = platformColor(source);
  const icon = platformIcon(source);
  const dim = size === "md" ? 22 : 16;
  return (
    <span
      className="adi-platform-badge"
      title={platformLabel(source)}
      style={{
        background: color,
        width: dim,
        height: dim,
        fontSize: size === "md" ? 11 : 9,
      }}
    >
      {icon}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="adi-stat-card">
      <span className="adi-stat-label">{label}</span>
      <span className="adi-stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      {sub && <span className="adi-stat-sub">{sub}</span>}
    </div>
  );
}

function CompetitionBar({ level }: { level: string }) {
  const w = competitionBarWidth(level);
  const color = competitionColor(level);
  return (
    <span className="adi-comp-bar-wrap">
      <span
        className="adi-comp-bar-fill"
        style={{ width: `${w}%`, background: color }}
      />
      <span className="adi-comp-bar-label" style={{ color }}>
        {level}
      </span>
    </span>
  );
}

/* ── keyword table ──────────────────────────────────────────────── */

function KeywordTable({ keywords, maxCpc }: { keywords: AdIntelligenceKeyword[]; maxCpc: number }) {
  if (!keywords.length) return null;
  return (
    <section className="adi-section">
      <div className="adi-section-head">
        <h2 className="adi-section-title">Keywords</h2>
        <span className="adi-section-count">{keywords.length}</span>
      </div>
      <div className="adi-table-wrap">
        <table className="adi-table">
          <thead>
            <tr>
              <th className="adi-th adi-th-left">Keyword</th>
              <th className="adi-th adi-th-right">CPC</th>
              <th className="adi-th adi-th-right">Volume</th>
              <th className="adi-th adi-th-left">Competition</th>
              <th className="adi-th adi-th-center">Platforms</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw, i) => (
              <tr
                key={kw.keyword}
                className="adi-row"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <td className="adi-td adi-td-keyword">
                  {kw.trendId ? (
                    <a href={`/trends/${kw.trendId}`} className="adi-keyword-link">
                      {kw.keyword}
                      <span className="adi-link-arrow">&rarr;</span>
                    </a>
                  ) : (
                    <span>{kw.keyword}</span>
                  )}
                </td>
                <td className="adi-td adi-td-mono adi-td-right">
                  <span
                    className="adi-cpc"
                    style={{ opacity: cpcIntensity(kw.cpc, maxCpc) }}
                  >
                    ${kw.cpc.toFixed(2)}
                  </span>
                </td>
                <td className="adi-td adi-td-mono adi-td-right">
                  {formatVolume(kw.searchVolume)}
                </td>
                <td className="adi-td">
                  <CompetitionBar level={kw.competitionLevel} />
                </td>
                <td className="adi-td adi-td-center">
                  <span className="adi-badge-row">
                    {kw.platforms.map((p) => (
                      <PlatformBadge key={p} source={p} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── advertiser table ───────────────────────────────────────────── */

function AdvertiserTable({ advertisers }: { advertisers: AdIntelligenceAdvertiser[] }) {
  if (!advertisers.length) return null;
  return (
    <section className="adi-section">
      <div className="adi-section-head">
        <h2 className="adi-section-title">Advertisers</h2>
        <span className="adi-section-count">{advertisers.length}</span>
      </div>
      <div className="adi-table-wrap">
        <table className="adi-table">
          <thead>
            <tr>
              <th className="adi-th adi-th-left">Advertiser</th>
              <th className="adi-th adi-th-center">Platform</th>
              <th className="adi-th adi-th-right">Ads</th>
              <th className="adi-th adi-th-left">Formats</th>
              <th className="adi-th adi-th-left">Regions</th>
            </tr>
          </thead>
          <tbody>
            {advertisers.map((adv, i) => (
              <tr
                key={`${adv.name}-${adv.platform}`}
                className="adi-row"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <td className="adi-td adi-td-advertiser">{adv.name}</td>
                <td className="adi-td adi-td-center">
                  <PlatformBadge source={adv.platform} size="md" />
                </td>
                <td className="adi-td adi-td-mono adi-td-right adi-td-ads">
                  {adv.adCount.toLocaleString()}
                </td>
                <td className="adi-td">
                  <span className="adi-tag-row">
                    {adv.adFormats.map((f) => (
                      <span key={f} className="adi-format-tag">{f}</span>
                    ))}
                  </span>
                </td>
                <td className="adi-td">
                  <span className="adi-tag-row">
                    {adv.regions.map((r) => (
                      <span key={r} className="adi-region-tag">{r}</span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── platform cards ─────────────────────────────────────────────── */

function PlatformCards({ platforms }: { platforms: AdIntelligencePlatformSummary[] }) {
  if (!platforms.length) return null;
  const maxAds = Math.max(...platforms.map((p) => p.adCount), 1);
  return (
    <section className="adi-section">
      <div className="adi-section-head">
        <h2 className="adi-section-title">Platforms</h2>
      </div>
      <div className="adi-platform-grid">
        {platforms.map((p, i) => {
          const color = platformColor(p.platform);
          const barPct = Math.round((p.adCount / maxAds) * 100);
          return (
            <div
              key={p.platform}
              className="adi-platform-card"
              style={{ animationDelay: `${i * 60}ms`, borderColor: `${color}22` }}
            >
              <div className="adi-platform-card-head">
                <PlatformBadge source={p.platform} size="md" />
                <span className="adi-platform-card-name">{platformLabel(p.platform)}</span>
              </div>
              <div className="adi-platform-card-bar">
                <div
                  className="adi-platform-card-bar-fill"
                  style={{ width: `${barPct}%`, background: color }}
                />
              </div>
              <div className="adi-platform-card-stats">
                <span><strong>{p.adCount}</strong> ads</span>
                <span><strong>{p.keywordCount}</strong> keywords</span>
                <span><strong>{p.advertiserCount}</strong> advertisers</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── paywall gate ───────────────────────────────────────────────── */

function ProGate() {
  return (
    <div className="adi-gate">
      <div className="adi-gate-inner">
        <div className="adi-gate-badge">PRO</div>
        <h1 className="adi-gate-title">Ad Intelligence</h1>
        <p className="adi-gate-copy">
          Keyword CPC data, advertiser breakdowns, and cross-platform ad activity — available on Pro.
        </p>
        <div className="adi-gate-preview">
          <div className="adi-gate-blur" />
          <table className="adi-table" style={{ opacity: 0.3 }}>
            <thead>
              <tr>
                <th className="adi-th adi-th-left">Keyword</th>
                <th className="adi-th adi-th-right">CPC</th>
                <th className="adi-th adi-th-right">Volume</th>
                <th className="adi-th adi-th-left">Competition</th>
              </tr>
            </thead>
            <tbody>
              {["AI automation", "cloud security", "low-code platform"].map((kw) => (
                <tr key={kw} className="adi-row">
                  <td className="adi-td">{kw}</td>
                  <td className="adi-td adi-td-right adi-td-mono">$--.--</td>
                  <td className="adi-td adi-td-right adi-td-mono">---,---</td>
                  <td className="adi-td"><CompetitionBar level="MEDIUM" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a href="/pricing" className="adi-gate-cta">
          Upgrade to Pro
        </a>
      </div>
    </div>
  );
}

/* ── skeleton ───────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="adi-wrap">
      <div className="adi-header">
        <div className="skeleton-pulse" style={{ width: 200, height: 26, borderRadius: 6 }} />
        <div className="skeleton-pulse" style={{ width: 300, height: 14, borderRadius: 4, marginTop: 8 }} />
      </div>
      <div className="adi-stats-row">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="adi-stat-card">
            <div className="skeleton-pulse" style={{ width: 60, height: 12, borderRadius: 4 }} />
            <div className="skeleton-pulse" style={{ width: 80, height: 28, borderRadius: 6, marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── main dashboard ─────────────────────────────────────────────── */

export function AdIntelligenceDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isPro, loading: profileLoading } = useProfile();
  const router = useRouter();
  const [data, setData] = useState<AdIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !isPro) {
      router.replace(user ? "/pricing" : "/login?next=/ad-intelligence");
      return;
    }
    fetch("/api/ad-intelligence")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isPro, profileLoading, authLoading, user, router]);

  if (authLoading || profileLoading || loading) return <Skeleton />;
  if (!isPro) return <ProGate />;

  if (!data) {
    return (
      <div className="adi-wrap">
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>
          No ad intelligence data available yet.
        </p>
      </div>
    );
  }

  const maxCpc = Math.max(...data.topKeywords.map((k) => k.cpc), 1);
  const totalAds = data.platformSummary.reduce((s, p) => s + p.adCount, 0);
  const avgCpc = data.topKeywords.length > 0
    ? (data.topKeywords.reduce((s, k) => s + k.cpc, 0) / data.topKeywords.length).toFixed(2)
    : "0.00";
  const topPlatform = data.platformSummary[0]
    ? platformLabel(data.platformSummary[0].platform)
    : "N/A";

  return (
    <div className="adi-wrap">
      <header className="adi-header">
        <div className="adi-header-top">
          <h1 className="adi-title">Ad Intelligence</h1>
          {data.generatedAt && (
            <span className="adi-updated">{timeAgo(data.generatedAt)}</span>
          )}
        </div>
        <p className="adi-subtitle">
          Keyword costs, advertiser activity, and platform distribution
        </p>
      </header>

      <div className="adi-stats-row">
        <StatCard label="Keywords" value={data.topKeywords.length} />
        <StatCard label="Avg CPC" value={`$${avgCpc}`} accent="var(--accent)" />
        <StatCard label="Advertisers" value={data.topAdvertisers.length} />
        <StatCard label="Total Ads" value={totalAds} />
        <StatCard label="Top Platform" value={topPlatform} />
      </div>

      <KeywordTable keywords={data.topKeywords} maxCpc={maxCpc} />
      <AdvertiserTable advertisers={data.topAdvertisers} />
      <PlatformCards platforms={data.platformSummary} />
    </div>
  );
}
