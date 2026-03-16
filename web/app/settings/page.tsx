import Link from "next/link";
import { cookies } from "next/headers";

import { LogoutButton } from "@/components/logout-button";
import { SubscriptionManager } from "@/components/subscription-manager";
import { SettingsPreferences } from "@/components/settings-preferences";
import {
  LIGHT_THEME,
  readThemePreference,
  THEME_COOKIE,
  THEME_OPTIONS,
} from "@/lib/settings";

export default async function SettingsPage() {
  let selectedTheme = LIGHT_THEME;
  try {
    const cookieStore = await cookies();
    selectedTheme = readThemePreference(cookieStore.get(THEME_COOKIE)?.value) ?? LIGHT_THEME;
  } catch {
    selectedTheme = LIGHT_THEME;
  }

  return (
    <main className="detail-page">
      <section className="settings-hero">
        <div className="settings-hero-content">
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <h1 className="settings-headline">Settings</h1>
          <p className="settings-subline">
            Manage your preferences, subscription, and account.
          </p>
        </div>
      </section>

      <section className="settings-sections">
        <article className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </div>
            <div>
              <h2 className="settings-section-title">Appearance</h2>
              <p className="settings-section-desc">Choose the palette used across the app.</p>
            </div>
          </div>
          <div className="settings-section-body">
            <SettingsPreferences
              initialTheme={selectedTheme}
              themes={THEME_OPTIONS}
            />
          </div>
        </article>

        <article className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div>
              <h2 className="settings-section-title">Subscription</h2>
              <p className="settings-section-desc">Manage your plan and billing.</p>
            </div>
          </div>
          <div className="settings-section-body">
            <SubscriptionManager />
          </div>
        </article>

        <article className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className="settings-section-title">Account</h2>
              <p className="settings-section-desc">Session and sign out.</p>
            </div>
          </div>
          <div className="settings-section-body">
            <LogoutButton />
          </div>
        </article>
      </section>
    </main>
  );
}
