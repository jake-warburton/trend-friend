import Link from "next/link";

export function PricingTable() {
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
            <li>Everything in Free</li>
            <li>CSV export</li>
            <li>Ad Intelligence</li>
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
  );
}
