import Link from "next/link";

export const metadata = {
  title: "Signal Eye — Trend Intelligence for Founders, Creators & Investors",
  description:
    "Spot emerging trends before they peak. Signal Eye monitors 18+ data sources in real time to surface rising topics for content creators, founders, marketers, and investors.",
};

export default function Page() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="landing-kicker">Trend intelligence terminal</p>
          <h1>
            Spot the next big thing
            <br />
            <span className="landing-hero-accent">before everyone else does.</span>
          </h1>
          <p className="landing-subheadline">
            Signal Eye tracks 18+ live data sources — Hacker News, Reddit, GitHub, arXiv, YouTube, Google Trends and
            more — to surface emerging trends the moment they start gaining momentum.
          </p>
          <div className="landing-cta-group">
            <Link href="/signup" className="landing-cta-primary">
              Start for free
            </Link>
            <Link href="/explore" className="landing-cta-secondary">
              See live trends
            </Link>
          </div>
          <p className="landing-cta-note">No credit card required. Free tier available.</p>
        </div>
      </section>

      <section className="landing-hero-screenshot">
        <div className="landing-screenshot-frame">
          <div className="landing-screenshot-bar">
            <span /><span /><span />
          </div>
          {/* Replace with: <Image src="/screenshots/explorer.png" alt="Signal Eye explorer dashboard" ... /> */}
          <div className="landing-screenshot-placeholder" aria-label="Screenshot: trend explorer dashboard">
            <svg viewBox="0 0 800 450" fill="none" aria-hidden="true">
              <rect x="20" y="20" width="760" height="50" rx="8" opacity="0.08" fill="currentColor" />
              <rect x="20" y="90" width="240" height="340" rx="8" opacity="0.05" fill="currentColor" />
              <rect x="280" y="90" width="500" height="164" rx="8" opacity="0.06" fill="currentColor" />
              <rect x="280" y="270" width="245" height="160" rx="8" opacity="0.05" fill="currentColor" />
              <rect x="535" y="270" width="245" height="160" rx="8" opacity="0.05" fill="currentColor" />
            </svg>
            <span>Explorer dashboard screenshot</span>
          </div>
        </div>
      </section>

      <section className="landing-stats">
        <div className="landing-stats-grid">
          <div className="landing-stat-item">
            <strong>18+</strong>
            <span>data sources monitored</span>
          </div>
          <div className="landing-stat-item">
            <strong>Real-time</strong>
            <span>signal aggregation</span>
          </div>
          <div className="landing-stat-item">
            <strong>6</strong>
            <span>trend stages tracked</span>
          </div>
          <div className="landing-stat-item">
            <strong>Free</strong>
            <span>to start</span>
          </div>
        </div>
      </section>

      <section className="landing-problem">
        <div className="landing-problem-content">
          <h2>By the time a trend is obvious, you&apos;ve already missed it.</h2>
          <p>
            Everyone uses the same tools. Everyone watches the same feeds. So everyone reacts at the same time — too
            late to get ahead.
          </p>
          <p>
            Signal Eye tracks weak signals across developer forums, research papers, package registries, prediction
            markets, and social platforms to find what&apos;s gaining momentum <em>now</em>, not next month.
          </p>
        </div>
      </section>

      <section className="landing-how-it-works">
        <h2>From raw signal to actionable insight.</h2>
        <div className="landing-steps-grid">
          <article className="landing-step">
            <span className="landing-step-number">01</span>
            <h3>Aggregate</h3>
            <p>
              We continuously ingest data from 18+ sources: Reddit, Hacker News, GitHub, arXiv, npm, PyPI, Product
              Hunt, YouTube, Google Trends, Polymarket, Wikipedia and more.
            </p>
          </article>
          <article className="landing-step">
            <span className="landing-step-number">02</span>
            <h3>Score</h3>
            <p>
              Every topic gets a transparent trend score based on growth velocity, cross-source validation, and stage
              classification: Nascent, Rising, Breakout, Validated, Cooling.
            </p>
          </article>
          <article className="landing-step">
            <span className="landing-step-number">03</span>
            <h3>Act</h3>
            <p>
              Filter by use case — SEO, content, product ideas, investment — and get directly to what matters for you.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-features-intro">
          <h2>Everything you need to move first.</h2>
          <p className="landing-features-lead">
            A complete toolkit for discovering, tracking, and acting on emerging trends across the internet.
          </p>
        </div>
        <div className="landing-features-showcase">
          <div className="landing-showcase-screenshot">
            <div className="landing-screenshot-frame landing-screenshot-frame-sm">
              <div className="landing-screenshot-bar">
                <span /><span /><span />
              </div>
              {/* Replace with: <Image src="/screenshots/trend-detail.png" alt="Trend detail view" ... /> */}
              <div className="landing-screenshot-placeholder" aria-label="Screenshot: trend detail page">
                <svg viewBox="0 0 600 380" fill="none" aria-hidden="true">
                  <rect x="16" y="16" width="350" height="24" rx="6" opacity="0.08" fill="currentColor" />
                  <rect x="16" y="56" width="568" height="120" rx="8" opacity="0.05" fill="currentColor" />
                  <rect x="16" y="192" width="275" height="170" rx="8" opacity="0.06" fill="currentColor" />
                  <rect x="307" y="192" width="277" height="170" rx="8" opacity="0.06" fill="currentColor" />
                </svg>
                <span>Trend detail view</span>
              </div>
            </div>
          </div>
          <div className="landing-features-list">
            <article className="landing-feature-card">
              <h3>Multi-source explorer</h3>
              <p>Browse and filter ranked trends across every source, stage, audience, market, and language.</p>
            </article>
            <article className="landing-feature-card">
              <h3>Trend score & history</h3>
              <p>
                See not just where a trend is, but where it&apos;s been — score history charts, seasonality analysis, geo
                distribution.
              </p>
            </article>
            <article className="landing-feature-card">
              <h3>Lens presets</h3>
              <p>Switch between Discovery, SEO, Content, Product, and Investment views with one click.</p>
            </article>
            <article className="landing-feature-card">
              <h3>Watchlists & alerts</h3>
              <p>Save topics to watchlists and get notified when a trend crosses your score threshold.</p>
            </article>
            <article className="landing-feature-card">
              <h3>Market footprint</h3>
              <p>See real-world evidence: top Google results, YouTube coverage, and search volume data.</p>
            </article>
            <article className="landing-feature-card">
              <h3>Shareable collections</h3>
              <p>Publish watchlists to the community or share private links with an expiry date.</p>
            </article>
            <article className="landing-feature-card">
              <h3>API & CSV export</h3>
              <p>Integrate trend data into your own tools and workflows. <em className="landing-pro-badge">Pro</em></p>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-use-cases">
        <h2>Built for people who need to be early.</h2>
        <div className="landing-personas-grid">
          <article className="landing-persona-card">
            <h3>Content creators</h3>
            <p>
              Know what your audience will care about next week, not last week. Plan content around trends that are
              rising, not already peaking.
            </p>
          </article>
          <article className="landing-persona-card">
            <h3>Indie hackers & builders</h3>
            <p>
              Spot underserved problems before the market gets crowded. Signal Eye&apos;s Build Ideas lens surfaces
              developer trends with low competition and rising demand.
            </p>
          </article>
          <article className="landing-persona-card">
            <h3>Founders & investors</h3>
            <p>
              Get a read on emerging categories and market momentum before it shows up in TechCrunch. Validate thesis
              ideas with cross-source signal data.
            </p>
          </article>
          <article className="landing-persona-card">
            <h3>Marketers & SEO teams</h3>
            <p>
              Find keywords and topics with genuine momentum behind them. Move before your competitors even know the
              trend exists.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-app-preview">
        <div className="landing-preview-content">
          <h2>See it in action</h2>
          <p>Real-time trend scoring, source health monitoring, and community watchlists — all in one interface.</p>
        </div>
        <div className="landing-preview-screenshots">
          <div className="landing-screenshot-frame landing-screenshot-frame-sm">
            <div className="landing-screenshot-bar">
              <span /><span /><span />
            </div>
            {/* Replace with: <Image src="/screenshots/source-health.png" alt="Source health dashboard" ... /> */}
            <div className="landing-screenshot-placeholder" aria-label="Screenshot: source health dashboard">
              <svg viewBox="0 0 480 300" fill="none" aria-hidden="true">
                <rect x="12" y="12" width="200" height="18" rx="4" opacity="0.08" fill="currentColor" />
                <rect x="12" y="44" width="456" height="100" rx="6" opacity="0.05" fill="currentColor" />
                <rect x="12" y="160" width="456" height="128" rx="6" opacity="0.06" fill="currentColor" />
              </svg>
              <span>Source health</span>
            </div>
          </div>
          <div className="landing-screenshot-frame landing-screenshot-frame-sm">
            <div className="landing-screenshot-bar">
              <span /><span /><span />
            </div>
            {/* Replace with: <Image src="/screenshots/community.png" alt="Community watchlists" ... /> */}
            <div className="landing-screenshot-placeholder" aria-label="Screenshot: community watchlists">
              <svg viewBox="0 0 480 300" fill="none" aria-hidden="true">
                <rect x="12" y="12" width="180" height="18" rx="4" opacity="0.08" fill="currentColor" />
                <rect x="12" y="44" width="148" height="120" rx="6" opacity="0.05" fill="currentColor" />
                <rect x="170" y="44" width="148" height="120" rx="6" opacity="0.05" fill="currentColor" />
                <rect x="328" y="44" width="140" height="120" rx="6" opacity="0.05" fill="currentColor" />
                <rect x="12" y="178" width="456" height="110" rx="6" opacity="0.04" fill="currentColor" />
              </svg>
              <span>Community watchlists</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-pricing">
        <h2>Start free. Go deeper when you&apos;re ready.</h2>
        <div className="landing-pricing-grid">
          <article className="landing-pricing-card">
            <h3>Free</h3>
            <p className="landing-pricing-price">$0<span>/month</span></p>
            <ul className="landing-pricing-features">
              <li>Live trend explorer</li>
              <li>All filters and lens presets</li>
              <li>Community watchlists</li>
              <li>Up to 3 saved watchlists</li>
            </ul>
            <Link href="/signup" className="landing-pricing-cta">
              Get started
            </Link>
          </article>
          <article className="landing-pricing-card landing-pricing-card-featured">
            <h3>Pro</h3>
            <p className="landing-pricing-price">[Price]<span>/month</span></p>
            <ul className="landing-pricing-features">
              <li>Everything in Free</li>
              <li>Unlimited watchlists and alerts</li>
              <li>Advanced trend analytics</li>
              <li>Priority data refresh</li>
              <li>Market footprint enrichment</li>
              <li>CSV export and API access</li>
              <li>Community leaderboard features</li>
            </ul>
            <Link href="/signup" className="landing-pricing-cta landing-pricing-cta-primary">
              Upgrade to Pro
            </Link>
          </article>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-cta-inner">
          <h2>The next big thing is already showing up in the data.</h2>
          <p>Signal Eye is watching. Are you?</p>
          <Link href="/signup" className="landing-cta-primary">
            Start for free
          </Link>
          <p className="landing-final-note">
            Join founders, creators, and investors who spotted their next opportunity in the signal, not the noise.
          </p>
        </div>
      </section>
    </main>
  );
}
