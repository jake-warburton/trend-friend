import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-service";
import {
  buildEnrichmentProviderStatuses,
  ESTIMATED_METRICS_COOKIE,
  readEstimatedMetricsPreference,
} from "@/lib/settings";
import { EstimatedMetricsToggle } from "@/components/estimated-metrics-toggle";

export default async function AdminPage() {
  const { user } = await getCurrentUser();

  const ADMIN_USER_IDS = ["9d291cd1-dc49-403e-bed8-1f9f17703664"];
  if (!user || !ADMIN_USER_IDS.includes(user.id)) {
    redirect("/explore");
  }

  const providerStatuses = buildEnrichmentProviderStatuses(process.env);

  let showEstimatedMetrics = true;
  try {
    const cookieStore = await cookies();
    showEstimatedMetrics = readEstimatedMetricsPreference(cookieStore.get(ESTIMATED_METRICS_COOKIE)?.value);
  } catch {
    showEstimatedMetrics = true;
  }

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

          <article className="settings-card settings-card-wide">
            <header>
              <p className="eyebrow">Data</p>
              <h2>Estimated market metrics</h2>
            </header>
            <div className="settings-card-body">
              <EstimatedMetricsToggle initialValue={showEstimatedMetrics} />
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
