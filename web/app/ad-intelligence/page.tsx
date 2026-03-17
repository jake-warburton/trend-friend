import type { Metadata } from "next";
import { Suspense } from "react";
import { AdIntelligenceDashboard } from "@/components/ad-intelligence-dashboard";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Ad Intelligence",
  description:
    "Track what brands are spending on across emerging trend categories. Keyword CPC data, advertiser breakdowns, and cross-platform ad activity from Google, Meta, TikTok, and YouTube.",
  alternates: { canonical: `${SITE_URL}/ad-intelligence` },
  openGraph: {
    title: "Ad Intelligence — Signal Eye",
    description: "Track what brands are spending on across emerging trend categories.",
  },
  twitter: { card: "summary_large_image" },
};

const FAKE_KEYWORDS = [
  { keyword: "AI automation tools", cpc: "$4.82", volume: "201K", competition: "HIGH" },
  { keyword: "cloud security platform", cpc: "$7.15", volume: "156K", competition: "HIGH" },
  { keyword: "low-code development", cpc: "$3.40", volume: "134K", competition: "MEDIUM" },
  { keyword: "remote team management", cpc: "$2.95", volume: "98K", competition: "MEDIUM" },
  { keyword: "sustainable packaging", cpc: "$1.80", volume: "72K", competition: "LOW" },
];

export default function AdIntelligencePage() {
  const jsonLd = buildCollectionPageJsonLd({
    name: "Ad Intelligence",
    description: "Cross-platform advertising data across emerging trends",
    url: `${SITE_URL}/ad-intelligence`,
    numberOfItems: 5,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      {/* Server-rendered teaser */}
      <div className="adi-wrap adi-teaser">
        <div className="adi-header">
          <h1>Ad Intelligence</h1>
          <p>Cross-platform ad spend, keyword CPC data, and advertiser breakdowns across emerging trends.</p>
        </div>

        <section className="adi-section" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Top Keywords</h2>
          <table className="adi-table">
            <thead>
              <tr>
                <th className="adi-th adi-th-left">Keyword</th>
                <th className="adi-th adi-th-right">CPC</th>
                <th className="adi-th adi-th-right">Volume</th>
                <th className="adi-th adi-th-left">Competition</th>
              </tr>
            </thead>
            <tbody>
              {FAKE_KEYWORDS.map((kw) => (
                <tr key={kw.keyword} className="adi-row">
                  <td className="adi-td">{kw.keyword}</td>
                  <td className="adi-td adi-td-right adi-td-mono">{kw.cpc}</td>
                  <td className="adi-td adi-td-right adi-td-mono">{kw.volume}</td>
                  <td className="adi-td">{kw.competition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="adi-gate" style={{ marginTop: 24 }}>
          <div className="adi-gate-inner">
            <div className="adi-gate-badge">PRO</div>
            <p className="adi-gate-copy">
              Unlock full ad intelligence — keyword CPC data, advertiser breakdowns, and cross-platform ad activity.
            </p>
            <a href="/pricing" className="adi-gate-cta">Upgrade to Pro</a>
          </div>
        </div>
      </div>

      {/* Client dashboard replaces teaser for Pro users */}
      <Suspense>
        <AdIntelligenceDashboard />
      </Suspense>
    </>
  );
}
