import Link from "next/link";

const SETTINGS_SECTIONS = [
  { title: "Workspace", description: "Reserved for account-level defaults, workspace behavior, and preferences." },
  { title: "Notifications", description: "Reserved for delivery channels, alert policies, and digest controls." },
  { title: "Display", description: "Reserved for theme, density, typography, and data presentation settings." },
  { title: "Data", description: "Reserved for source preferences, refresh behavior, and export defaults." },
] as const;

export default function SettingsPage() {
  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/">
            Back to explorer
          </Link>
          <p className="eyebrow">Settings</p>
          <h1>Settings</h1>
          <p className="detail-copy">
            This page is intentionally blank for now. The layout is ready for grouped settings, switches, and system
            information as those controls are added.
          </p>
        </div>
      </section>

      <section className="detail-panel settings-panel">
        <div className="settings-grid">
          {SETTINGS_SECTIONS.map((section) => (
            <article className="settings-card" key={section.title}>
              <header>
                <p className="eyebrow">Reserved</p>
                <h2>{section.title}</h2>
              </header>
              <div className="settings-card-body">
                <p>{section.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
