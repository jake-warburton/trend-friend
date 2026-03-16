import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-service";
import { buildEnrichmentProviderStatuses } from "@/lib/settings";
import { loadBreakingFeed, loadDashboardOverview } from "@/lib/trends";
import { FreshnessCards } from "@/components/freshness-cards";
import type { AdIntelligenceResponse } from "@/lib/types";

async function loadAdIntelligenceTimestamp(): Promise<string | null> {
  try {
    const res = await fetch(
      `${process.env.SIGNAL_EYE_FRONTEND_URL ?? "http://localhost:3000"}/api/ad-intelligence`,
      { next: { revalidate: 0 } },
    );
    if (!res.ok) return null;
    const data: AdIntelligenceResponse = await res.json();
    return data.generatedAt ?? null;
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const { user } = await getCurrentUser();

  const ADMIN_USER_IDS = ["9d291cd1-dc49-403e-bed8-1f9f17703664"];
  if (!user || !ADMIN_USER_IDS.includes(user.id)) {
    redirect("/explore");
  }

  const providerStatuses = buildEnrichmentProviderStatuses(process.env);

  const [overview, breakingFeed, adIntelTimestamp] = await Promise.all([
    loadDashboardOverview().catch(() => null),
    loadBreakingFeed().catch(() => null),
    loadAdIntelligenceTimestamp(),
  ]);

  const freshnessItems = [
    {
      key: "refresh-data",
      label: "Refresh Data",
      timestamp: overview?.generatedAt ?? null,
      description: "Main ingestion pipeline. Fetches from 22+ sources, scores trends, exports JSON payloads. Runs on a schedule via GitHub Actions. Affects explorer, trend detail, categories, and all dashboard pages.",
    },
    {
      key: "refresh-twitter",
      label: "Refresh Twitter",
      timestamp: breakingFeed?.updatedAt ?? null,
      description: "Fetches recent tweets from tracked accounts via twscrape and publishes the breaking feed. Runs on a separate GitHub Actions schedule.",
    },
    {
      key: "refresh-ads",
      label: "Refresh Ads",
      timestamp: adIntelTimestamp,
      description: "Collects ad keyword data, advertiser activity, and platform distribution for trending topics. Runs as a separate GitHub Actions workflow.",
    },
  ];

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">Admin</p>
          <h1>Admin</h1>
          <p className="detail-copy">
            System status and data enrichment provider configuration.
          </p>
        </div>
      </section>

      <section className="detail-panel settings-panel">
        <div className="settings-grid">
          <article className="settings-card settings-card-wide">
            <header>
              <p className="eyebrow">Data</p>
              <h2>Data freshness</h2>
            </header>
            <FreshnessCards items={freshnessItems} />
          </article>

          <article className="settings-card settings-card-wide">
            <header>
              <p className="eyebrow">Data</p>
              <h2>Enrichment status</h2>
            </header>
            <div className="settings-provider-grid">
              {providerStatuses.map((provider) => (
                <div className="settings-provider-card" key={provider.key}>
                  <div className="settings-provider-header">
                    <strong>{provider.label}</strong>
                    <span className={provider.configured ? "status-pill status-pill-success" : "status-pill"}>
                      {provider.configured ? "Configured" : "Fallback"}
                    </span>
                  </div>
                  <p className="settings-copy">{provider.detail}</p>
                </div>
              ))}
            </div>
          </article>

        </div>
      </section>
    </main>
  );
}
