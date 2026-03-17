"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { isPro, type BillingStatus } from "@/lib/subscription";

export const PRO_FEATURES = [
  "Everything in Free",
  "CSV export",
  "Social Intelligence",
  "Ad Intelligence",
] as const;

export function PricingTable() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    if (!user) {
      setBillingStatus(null);
      return;
    }
    fetch("/api/billing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setBillingStatus(data); })
      .catch(() => {});
  }, [user]);

  const userIsPro = isPro(billingStatus);
  const renewalDate = billingStatus?.currentPeriodEnd
    ? new Date(billingStatus.currentPeriodEnd).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const handleUpgrade = async () => {
    if (!user) {
      window.location.href = "/login?next=/pricing";
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="landing-pricing">
      <h2>Start free. Go deeper when you&apos;re ready.</h2>
      <div className="landing-pricing-grid">
        <article className="landing-pricing-card">
          <h3>Free</h3>
          <p className="landing-pricing-price">
            $0<span>/month</span>
          </p>
          <ul className="landing-pricing-features">
            <li>Live trend explorer</li>
            <li>All filters and lens presets</li>
            <li>Geographic coverage map</li>
            <li>Breaking news feed</li>
          </ul>
          <Link href="/signup" className="landing-pricing-cta">
            Get started
          </Link>
        </article>
        <article className="landing-pricing-card landing-pricing-card-featured">
          <h3>Pro</h3>
          <p className="landing-pricing-price">
            $5.99<span>/month</span>
          </p>
          <ul className="landing-pricing-features">
            {PRO_FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {userIsPro ? (
            <p className="landing-pricing-cta billing-renew-note">
              Thank you for subscribing to Pro.
              {renewalDate && <> Renews on <strong>{renewalDate}</strong>.</>}
            </p>
          ) : (
            <button
              className="landing-pricing-cta landing-pricing-cta-primary"
              onClick={handleUpgrade}
              disabled={loading}
              type="button"
            >
              {loading ? "Loading..." : "Upgrade to Pro"}
            </button>
          )}
        </article>
      </div>
    </section>
  );
}
