import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AiUseCasesDashboard } from "@/components/ai-use-cases-dashboard";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const revalidate = 172800;
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "AI Use Cases",
  description:
    "Track what people appear to be using AI for across public trend, developer, and search signals. Pro users get rising workflows, tool associations, and evidence-backed AI use-case clusters.",
  alternates: { canonical: `${SITE_URL}/ai-use-cases` },
  openGraph: {
    title: "AI Use Cases — Signal Eye",
    description:
      "Pro AI intelligence on rising workflows, tool associations, and evidence-backed use cases.",
  },
  twitter: { card: "summary_large_image" },
};

const PREVIEW_CLUSTERS = [
  "Agent workflows and orchestration",
  "Coding copilots and dev assistants",
  "Research, synthesis, and reasoning",
  "Content, design, and creative production",
];

export default function AiUseCasesPage() {
  const jsonLd = buildCollectionPageJsonLd({
    name: "AI Use Cases",
    description: "Public-signal intelligence on how AI tools are being used",
    url: `${SITE_URL}/ai-use-cases`,
    numberOfItems: PREVIEW_CLUSTERS.length,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <main className="detail-page ai-use-cases-page ai-use-cases-teaser">
        <section className="detail-hero ai-use-cases-hero">
          <div>
            <Link className="detail-back-link" href="/explore">
              Back to explorer
            </Link>
            <p className="eyebrow">AI intelligence</p>
            <div className="detail-pill-row">
              <span className="trend-date-chip">Pro feature</span>
              <span className="trend-date-chip">Explorer payload backed</span>
              <span className="trend-date-chip">No first-party ChatGPT or Claude telemetry</span>
            </div>
            <h1>AI Use Cases</h1>
            <p className="detail-copy">
              Track what AI appears to be getting used for across public trend, developer, and
              search signals. Pro unlocks the live cluster view, tool associations, and
              evidence-backed workflow breakdowns.
            </p>
            <p className="ai-use-cases-note">
              Best read as intent intelligence: what AI seems to be getting used for, not exact
              in-product usage counts.
            </p>
          </div>

          <div className="detail-meta-grid">
            <div className="detail-stat-item">
              <span>Signals included</span>
              <strong>Search + developer + public evidence</strong>
            </div>
            <div className="detail-stat-item">
              <span>Outputs</span>
              <strong>Clusters, tools, evidence</strong>
            </div>
            <div className="detail-stat-item">
              <span>Update path</span>
              <strong>Published explorer payload</strong>
            </div>
            <div className="detail-stat-item">
              <span>Access</span>
              <strong>Pro</strong>
            </div>
          </div>
        </section>

        <section className="detail-grid">
          <section className="detail-panel detail-panel-wide">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Included</p>
                <h2>What Pro unlocks</h2>
              </div>
            </div>
            <div className="ai-use-case-cluster-grid">
              {PREVIEW_CLUSTERS.map((label) => (
                <article className="ai-use-case-cluster-card" key={label}>
                  <div className="ai-use-case-cluster-top">
                    <div>
                      <p className="ai-use-case-cluster-kicker">Live cluster</p>
                      <h3>{label}</h3>
                    </div>
                    <span className="trend-date-chip">Pro</span>
                  </div>
                  <p className="ai-use-case-cluster-copy">
                    Rising use cases, named tools, and public evidence stitched into one
                    workflow view.
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Access</p>
                <h2>Unlock AI intelligence</h2>
              </div>
            </div>

            <section className="adi-gate">
              <div className="adi-gate-inner">
                <div className="adi-gate-badge">PRO</div>
                <p className="adi-gate-copy">
                  Upgrade to unlock the live AI use-case dataset, tool associations, and
                  evidence-backed workflow clusters.
                </p>
                <a href="/pricing" className="adi-gate-cta">Upgrade to Pro</a>
              </div>
            </section>
          </section>
        </section>
      </main>

      <Suspense>
        <AiUseCasesDashboard />
      </Suspense>
    </>
  );
}
