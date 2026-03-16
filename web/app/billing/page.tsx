"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { isPro, isPastDue, type BillingStatus } from "@/lib/subscription";

const FREE_FEATURES = [
  { label: "Trend dashboard", description: "All trends, scores, rankings", included: true },
  { label: "Trend detail pages", description: "Deep-dive into any trend", included: true },
  { label: "Breaking news feed", description: "Real-time Twitter intelligence", included: true },
  { label: "Source health monitoring", description: "22+ data source status", included: true },
  { label: "Ad intelligence", description: "Competitor ad spend & keywords", included: false },
  { label: "Email alerts", description: "Get notified on emerging topics", included: false },
  { label: "CSV export", description: "Download trend data", included: false },
  { label: "Watchlists", description: "Track custom trend groups", included: false },
];

const PRO_FEATURES = FREE_FEATURES.map((f) => ({ ...f, included: true }));

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch("/api/billing/status");
        if (res.ok) {
          setStatus(await res.json());
        }
      } catch {
        // billing endpoint may not be available
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading]);

  const handleCheckout = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch {
      // handle error
    } finally {
      setActionLoading(false);
    }
  };

  const handlePortal = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch {
      // handle error
    } finally {
      setActionLoading(false);
    }
  };

  const pro = isPro(status);
  const pastDue = isPastDue(status);

  return (
    <main className="detail-page">
      <section className="billing-hero">
        <div className="billing-hero-content">
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <h1 className="billing-headline">
            {pro ? "Your Pro plan" : "Upgrade to Pro"}
          </h1>
          <p className="billing-subline">
            {pro
              ? "You have full access to all Signal Eye features."
              : "Unlock the full power of Signal Eye for trend-driven growth."}
          </p>
        </div>
      </section>

      {!user && !authLoading && (
        <section className="billing-plans">
          <div className="billing-signin-prompt">
            <p><Link href="/login">Sign in</Link> to manage your subscription or upgrade.</p>
          </div>
        </section>
      )}

      {user && !loading && (
        <>
          {pastDue && (
            <section className="billing-alert">
              <p>Your payment is past due. Please update your payment method to keep Pro access.</p>
            </section>
          )}

          <section className="billing-plans">
            <article className={`billing-plan-card${!pro ? " billing-plan-current" : ""}`}>
              <div className="billing-plan-header">
                <span className="billing-plan-name">Free</span>
                <div className="billing-plan-price">
                  <span className="billing-price-amount">$0</span>
                  <span className="billing-price-period">forever</span>
                </div>
                {!pro && <span className="billing-plan-badge">Current plan</span>}
              </div>
              <ul className="billing-plan-features">
                {FREE_FEATURES.map((f) => (
                  <li key={f.label} className={f.included ? "billing-feature-yes" : "billing-feature-no"}>
                    <span className="billing-feature-icon" aria-hidden="true">
                      {f.included ? "✓" : "—"}
                    </span>
                    <span>
                      <strong>{f.label}</strong>
                      <span className="billing-feature-desc">{f.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>

            <article className={`billing-plan-card billing-plan-pro${pro ? " billing-plan-current" : ""}`}>
              <div className="billing-plan-header">
                <span className="billing-plan-name">Pro</span>
                <div className="billing-plan-price">
                  <span className="billing-price-amount">$5.99</span>
                  <span className="billing-price-period">/ month</span>
                </div>
                {pro && <span className="billing-plan-badge">Current plan</span>}
              </div>
              <ul className="billing-plan-features">
                {PRO_FEATURES.map((f) => (
                  <li key={f.label} className="billing-feature-yes">
                    <span className="billing-feature-icon" aria-hidden="true">✓</span>
                    <span>
                      <strong>{f.label}</strong>
                      <span className="billing-feature-desc">{f.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="billing-plan-action">
                {pro ? (
                  <>
                    {status?.currentPeriodEnd && (
                      <p className="billing-renew-note">
                        Renews {new Date(status.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                    <button
                      className="billing-manage-button"
                      onClick={handlePortal}
                      disabled={actionLoading}
                      type="button"
                    >
                      {actionLoading ? "Loading…" : "Manage subscription"}
                    </button>
                  </>
                ) : (
                  <button
                    className="billing-upgrade-button"
                    onClick={handleCheckout}
                    disabled={actionLoading}
                    type="button"
                  >
                    {actionLoading ? "Loading…" : "Upgrade to Pro"}
                  </button>
                )}
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
