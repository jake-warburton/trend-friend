"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { isPro, isPastDue, type BillingStatus } from "@/lib/subscription";

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
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">Account</p>
          <h1>Billing</h1>
          <p className="detail-copy">Manage your subscription and billing details.</p>
        </div>
      </section>

      <section className="detail-panel settings-panel">
        <div className="settings-grid">
          {!user && !authLoading && (
            <article className="settings-card settings-card-wide">
              <div className="settings-card-body">
                <p>
                  <Link href="/login">Sign in</Link> to manage your subscription.
                </p>
              </div>
            </article>
          )}

          {user && !loading && (
            <>
              <article className="settings-card settings-card-wide">
                <header>
                  <p className="eyebrow">Current plan</p>
                  <h2>{pro ? "Pro" : "Free"}</h2>
                </header>
                <div className="settings-card-body">
                  {pastDue && (
                    <p className="auth-error">
                      Your payment is past due. Please update your payment method to keep Pro access.
                    </p>
                  )}
                  {pro && status?.currentPeriodEnd && (
                    <p className="detail-copy">
                      Renews on {new Date(status.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                  {pro ? (
                    <button
                      className="auth-submit-button"
                      onClick={handlePortal}
                      disabled={actionLoading}
                      type="button"
                    >
                      {actionLoading ? "Loading..." : "Manage subscription"}
                    </button>
                  ) : (
                    <button
                      className="auth-submit-button"
                      onClick={handleCheckout}
                      disabled={actionLoading}
                      type="button"
                    >
                      {actionLoading ? "Loading..." : "Upgrade to Pro — $5.99/mo"}
                    </button>
                  )}
                </div>
              </article>

              <article className="settings-card settings-card-wide">
                <header>
                  <p className="eyebrow">What&apos;s included</p>
                  <h2>Pro features</h2>
                </header>
                <div className="settings-card-body">
                  <ul className="billing-feature-list">
                    <li className="billing-feature-item">
                      <span className="billing-feature-check" aria-hidden="true">
                        {pro ? "\u2713" : "\u2014"}
                      </span>
                      CSV export
                    </li>
                    <li className="billing-feature-item">
                      <span className="billing-feature-check" aria-hidden="true">
                        {pro ? "\u2713" : "\u2014"}
                      </span>
                      Ad Intelligence
                    </li>
                  </ul>
                </div>
              </article>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
