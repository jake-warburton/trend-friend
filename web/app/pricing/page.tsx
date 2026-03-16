import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Signal Eye pricing — start free, upgrade to Pro for advanced analytics, alerts, and API access.",
};

export default function PricingPage() {
  return (
    <main className="pricing-page">
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
              <li>Trend alerts</li>
              <li>Geographic coverage map</li>
            </ul>
            <Link href="/signup" className="landing-pricing-cta">
              Get started
            </Link>
          </article>
          <article className="landing-pricing-card landing-pricing-card-featured">
            <h3>Pro</h3>
            <p className="landing-pricing-price">
              [Price]<span>/month</span>
            </p>
            <ul className="landing-pricing-features">
              <li>Everything in Free</li>
              <li>Unlimited alerts and saved theses</li>
              <li>Advanced trend analytics</li>
              <li>Priority data refresh</li>
              <li>Market footprint enrichment</li>
              <li>CSV export and API access</li>
              <li>Breaking news feed</li>
            </ul>
            <Link
              href="/signup"
              className="landing-pricing-cta landing-pricing-cta-primary"
            >
              Upgrade to Pro
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
