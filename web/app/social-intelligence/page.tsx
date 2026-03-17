import type { Metadata } from "next";
import { Suspense } from "react";
import { SocialIntelligenceDashboard } from "@/components/social-intelligence-dashboard";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Social Intelligence",
  description:
    "Real-time trend signals from Reddit, X, Hacker News & more. Track trending topics, breaking news from curated accounts, and hashtag tracking across 10+ countries.",
  alternates: { canonical: `${SITE_URL}/social-intelligence` },
  openGraph: {
    title: "Social Intelligence — Signal Eye",
    description: "Real-time trend signals from Reddit, X, Hacker News & more.",
  },
  twitter: { card: "summary_large_image" },
};

const FAKE_HASHTAGS = ["#AIAgents", "#QuantumComputing", "#RemoteWork", "#DeFi", "#CleanEnergy"];
const FAKE_TOPICS = [
  { name: "AI Code Assistants", category: "Technology", location: "Worldwide", volume: "142K" },
  { name: "Nuclear Fusion Breakthrough", category: "Science", location: "United States", volume: "89K" },
  { name: "Decentralized Social", category: "Crypto", location: "Worldwide", volume: "67K" },
  { name: "Lab-Grown Meat Approval", category: "Health", location: "Europe", volume: "54K" },
  { name: "Rust Programming Language", category: "Developer Tools", location: "Worldwide", volume: "41K" },
];

export default function SocialIntelligencePage() {
  const jsonLd = buildCollectionPageJsonLd({
    name: "Social Intelligence",
    description: "Real-time trend signals from social platforms",
    url: `${SITE_URL}/social-intelligence`,
    numberOfItems: 5,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      {/* Server-rendered teaser — visible to crawlers and unauthenticated users */}
      <div className="social-intel-wrap social-intel-teaser">
        <div className="social-intel-header">
          <h1>Social Intelligence</h1>
          <p>Real-time trending topics and breaking news from curated X accounts across 10+ countries.</p>
        </div>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Trending Now</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {FAKE_HASHTAGS.map((tag) => (
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
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Topic</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Category</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Location</th>
                <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid var(--border)" }}>Volume</th>
              </tr>
            </thead>
            <tbody>
              {FAKE_TOPICS.map((topic) => (
                <tr key={topic.name}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{topic.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{topic.category}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{topic.location}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "monospace" }}>{topic.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="adi-gate" style={{ marginTop: 24 }}>
          <div className="adi-gate-inner">
            <div className="adi-gate-badge">PRO</div>
            <p className="adi-gate-copy">
              Unlock real-time social intelligence — trending topics, breaking news, and hashtag tracking across 10+ countries.
            </p>
            <a href="/pricing" className="adi-gate-cta">Upgrade to Pro</a>
          </div>
        </div>
      </div>

      {/* Client dashboard replaces teaser for Pro users */}
      <Suspense>
        <SocialIntelligenceDashboard />
      </Suspense>
    </>
  );
}
