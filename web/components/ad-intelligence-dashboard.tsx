"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useProfile } from "@/components/profile-provider";
import type { AdIntelligenceResponse, AdIntelligenceKeyword, AdIntelligenceAdvertiser, AdIntelligencePlatformSummary } from "@/lib/types";

/* ── platform identity ─────────────────────────────────────────── */

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  google_keyword_planner: { label: "YouTube", color: "#ff0000", icon: "Y" },
  facebook_ad_library:    { label: "Meta",    color: "#0082fb", icon: "M" },
  google_ads_transparency:{ label: "Google Ads", color: "#34a853", icon: "A" },
  tiktok_ads:             { label: "TikTok",  color: "#fe2c55", icon: "T" },
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

function formatCategory(raw: string): string {
  // Already formatted (e.g. "AI/ML", "Tech")
  if (!raw.includes("-")) return raw;
  // Slug like "developer-tools" → "Developer Tools"
  return raw.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
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

function KeywordTable({ keywords }: { keywords: AdIntelligenceKeyword[] }) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [advertiserFilter, setAdvertiserFilter] = useState("");
  if (!keywords.length) return null;

  const categories = Array.from(new Set(keywords.map((k) => k.category).filter(Boolean))).sort();
  const allAdvertisers = Array.from(new Set(keywords.flatMap((k) => k.topAdvertisers))).sort();

  let filtered = keywords;
  if (categoryFilter) {
    filtered = filtered.filter((k) => k.category === categoryFilter);
  }
  if (advertiserFilter) {
    filtered = filtered.filter((k) => k.topAdvertisers.includes(advertiserFilter));
  }
  const hasCpc = filtered.some((k) => k.cpc > 0);

  return (
    <section className="adi-section">
      <div className="adi-section-head">
        <h2 className="adi-section-title">Keywords</h2>
        <span className="adi-section-count">{filtered.length}</span>
        {categories.length > 1 && (
          <select
            className="adi-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c!}>{formatCategory(c!)}</option>
            ))}
          </select>
        )}
        {allAdvertisers.length > 1 && (
          <select
            className="adi-filter-select"
            value={advertiserFilter}
            onChange={(e) => setAdvertiserFilter(e.target.value)}
          >
            <option value="">All advertisers</option>
            {allAdvertisers.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>
      <div className="adi-table-wrap">
        <table className="adi-table">
          <thead>
            <tr>
              <th className="adi-th adi-th-left">Keyword</th>
              <th className="adi-th adi-th-left">Category</th>
              {hasCpc && <th className="adi-th adi-th-right">CPC</th>}
              {hasCpc && <th className="adi-th adi-th-right">Volume</th>}
              <th className="adi-th adi-th-left">Competition</th>
              <th className="adi-th adi-th-right">YT Ads</th>
              <th className="adi-th adi-th-left">Top Advertisers</th>
              <th className="adi-th adi-th-center">Platforms</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((kw, i) => (
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
                <td className="adi-td">
                  {kw.category ? (
                    <span className="adi-format-tag">{formatCategory(kw.category)}</span>
                  ) : (
                    <span style={{ color: "var(--muted)", opacity: 0.5 }}>--</span>
                  )}
                </td>
                {hasCpc && (
                  <td className="adi-td adi-td-mono adi-td-right">
                    <span className="adi-cpc">${kw.cpc.toFixed(2)}</span>
                  </td>
                )}
                {hasCpc && (
                  <td className="adi-td adi-td-mono adi-td-right">
                    {formatVolume(kw.searchVolume)}
                  </td>
                )}
                <td className="adi-td">
                  <CompetitionBar level={kw.competitionLevel} />
                </td>
                <td className="adi-td adi-td-mono adi-td-right">{kw.adDensity}{kw.adDensity === 1 ? " ad" : " ads"}</td>
                <td className="adi-td">
                  {kw.topAdvertisers.length > 0 ? (
                    <span className="adi-tag-row">
                      {kw.topAdvertisers.slice(0, 3).map((a) => (
                        <span key={a} className="adi-format-tag">{a}</span>
                      ))}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)", opacity: 0.5 }}>--</span>
                  )}
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
  const [filter, setFilter] = useState("");
  if (!advertisers.length) return null;

  const filtered = filter
    ? advertisers.filter((a) => a.name.toLowerCase().includes(filter.toLowerCase()))
    : advertisers;

  return (
    <section className="adi-section">
      <div className="adi-section-head">
        <h2 className="adi-section-title">Advertisers</h2>
        <span className="adi-section-count">{filtered.length}</span>
        <input
          className="adi-filter-input"
          type="text"
          placeholder="Filter advertisers..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="adi-table-wrap">
        <table className="adi-table">
          <thead>
            <tr>
              <th className="adi-th adi-th-left">Advertiser</th>
              <th className="adi-th adi-th-center">Source</th>
              <th className="adi-th adi-th-left">Format</th>
              <th className="adi-th adi-th-right">Keyword appearances</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((adv, i) => (
              <tr
                key={`${adv.name}-${adv.platform}`}
                className="adi-row"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <td className="adi-td adi-td-advertiser">{adv.name}</td>
                <td className="adi-td adi-td-center">
                  <PlatformBadge source={adv.platform} size="md" />
                </td>
                <td className="adi-td">
                  <span className="adi-tag-row">
                    {(adv.adFormats.length > 0 ? adv.adFormats : ["video"]).map((f) => (
                      <span key={f} className="adi-format-tag">{f}</span>
                    ))}
                  </span>
                </td>
                <td className="adi-td adi-td-mono adi-td-right">
                  {adv.adCount} {adv.adCount === 1 ? "search" : "searches"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="adi-td" colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No advertisers match "{filter}"
                </td>
              </tr>
            )}
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
  const searchParams = useSearchParams();
  const isScreenshot = searchParams.get("screenshot") === "1";
  const [data, setData] = useState<AdIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isScreenshot) { setLoading(false); return; }
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
  }, [isPro, profileLoading, authLoading, user, router, isScreenshot]);

  if (isScreenshot) return <ProGate />;
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

  const totalAds = data.platformSummary.reduce((s, p) => s + p.adCount, 0);
  const hasCpc = data.topKeywords.some((k) => k.cpc > 0);
  const avgCpc = hasCpc && data.topKeywords.length > 0
    ? (data.topKeywords.reduce((s, k) => s + k.cpc, 0) / data.topKeywords.length).toFixed(2)
    : null;
  const totalPlatforms = data.platformSummary.length;
  const topPlatform = data.platformSummary[0]
    ? platformLabel(data.platformSummary[0].platform)
    : "N/A";

  return (
    <div className="adi-wrap">
      <header className="adi-header">
        <div className="adi-header-top">
          <h1 className="adi-title">Ad Intelligence</h1>
        </div>
        <p className="adi-subtitle">
          See who is advertising around trending topics, which platforms they target, and what keywords they compete on
        </p>
      </header>

      <div className="adi-stats-row">
        <StatCard label="Keywords" value={data.topKeywords.length} />
        {avgCpc ? (
          <StatCard label="Avg CPC" value={`$${avgCpc}`} accent="var(--accent)" />
        ) : (
          <StatCard label="Platforms" value={totalPlatforms} />
        )}
        <StatCard label="Advertisers" value={data.topAdvertisers.length} />
        <StatCard label="Total Ads" value={totalAds} />
        <StatCard label="Top Platform" value={topPlatform} />
      </div>

      <KeywordTable keywords={data.topKeywords} />
      <AdvertiserTable advertisers={data.topAdvertisers} />
      <PlatformCards platforms={data.platformSummary} />
    </div>
  );
}
