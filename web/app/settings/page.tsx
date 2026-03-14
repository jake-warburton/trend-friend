import Link from "next/link";
import { cookies } from "next/headers";

import { SettingsPreferences } from "@/components/settings-preferences";
import {
  buildEnrichmentProviderStatuses,
  ESTIMATED_METRICS_COOKIE,
  LIGHT_THEME,
  readEstimatedMetricsPreference,
  readThemePreference,
  THEME_COOKIE,
  THEME_OPTIONS,
} from "@/lib/settings";

export default async function SettingsPage() {
  let showEstimatedMetrics = true;
  let selectedTheme = LIGHT_THEME;
  try {
    const cookieStore = await cookies();
    showEstimatedMetrics = readEstimatedMetricsPreference(cookieStore.get(ESTIMATED_METRICS_COOKIE)?.value);
    selectedTheme = readThemePreference(cookieStore.get(THEME_COOKIE)?.value) ?? LIGHT_THEME;
  } catch {
    showEstimatedMetrics = true;
    selectedTheme = LIGHT_THEME;
  }
  const providerStatuses = buildEnrichmentProviderStatuses(process.env);

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">Settings</p>
          <h1>Settings</h1>
          <p className="detail-copy">
            Configure how market-footprint enrichment behaves and see which live providers are currently wired into the
            app.
          </p>
        </div>
      </section>

      <section className="detail-panel settings-panel">
        <div className="settings-grid">
          <article className="settings-card settings-card-wide">
            <header>
              <p className="eyebrow">Display</p>
              <h2>UI preferences</h2>
            </header>
            <div className="settings-card-body">
              <SettingsPreferences
                initialShowEstimatedMetrics={showEstimatedMetrics}
                initialTheme={selectedTheme}
                themes={THEME_OPTIONS}
              />
            </div>
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
