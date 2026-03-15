import Image from "next/image";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  DARK_THEME,
  LIGHT_THEME,
  readThemePreference,
  THEME_COOKIE,
} from "@/lib/settings";

export const metadata = {
  title: "Signal Eye — Trend Intelligence for Founders, Creators & Investors",
  description:
    "Spot emerging trends before they peak. Signal Eye monitors 24+ data sources — Reddit, GitHub, TikTok, Google Trends, arXiv, and more — to surface rising topics with momentum scoring, breakout predictions, and market signals.",
  keywords: [
    "trend intelligence platform",
    "emerging trends tool",
    "trend tracking software",
    "breakout topic detection",
    "trend forecasting",
    "market trend analysis",
    "content trend discovery",
    "startup trend signals",
    "exploding topics alternative",
    "treendly alternative",
  ],
  openGraph: {
    title: "Signal Eye — Trend Intelligence for Founders, Creators & Investors",
    description:
      "Monitor 24+ data sources for emerging trends. Momentum scoring, breakout predictions, and market signals — all in one dashboard.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Signal Eye — Trend Intelligence Platform",
    description:
      "Monitor 24+ data sources for emerging trends. Momentum scoring, breakout predictions, and market signals.",
  },
};

const LANDING_SCREENSHOT_SETS = {
  [LIGHT_THEME]: {
    explorer: "/screenshots/explorer-light-v2.png",
    trendDetail: "/screenshots/trend-detail-light-v2.png",
    sourceHealth: "/screenshots/source-health-light-v2.png",
    exploreGeo: "/screenshots/explore-geo-light-v2.png",
  },
  [DARK_THEME]: {
    explorer: "/screenshots/explorer-dark-v2.png",
    trendDetail: "/screenshots/trend-detail-dark-v2.png",
    sourceHealth: "/screenshots/source-health-dark-v2.png",
    exploreGeo: "/screenshots/explore-geo-dark-v2.png",
  },
} as const;

export default async function Page() {
  let themeKey: typeof LIGHT_THEME | typeof DARK_THEME = LIGHT_THEME;
  try {
    const cookieStore = await cookies();
    const preferredTheme =
      readThemePreference(cookieStore.get(THEME_COOKIE)?.value) ?? LIGHT_THEME;
    themeKey = preferredTheme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
  } catch {
    themeKey = LIGHT_THEME;
  }
  const screenshotSet = LANDING_SCREENSHOT_SETS[themeKey];

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-content">
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
        <LandingScreenshot
          alt="Signal Eye explorer dashboard"
          height={1024}
          priority
          src={screenshotSet.explorer}
          width={1440}
        />
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
            <LandingScreenshot
              alt="Signal Eye trend detail view"
              className="landing-screenshot-frame-sm"
              height={1080}
              src={screenshotSet.trendDetail}
              width={1440}
            />
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
          <LandingScreenshot
            alt="Signal Eye source health dashboard"
            className="landing-screenshot-frame-sm"
            height={1180}
            src={screenshotSet.sourceHealth}
            width={1440}
          />
          <LandingScreenshot
            alt="Signal Eye explorer geographic footprint"
            className="landing-screenshot-frame-sm"
            height={1080}
            src={screenshotSet.exploreGeo}
            width={1440}
          />
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

function LandingScreenshot({
  alt,
  src,
  width,
  height,
  className,
  priority = false,
}: {
  alt: string;
  src: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  const frameClassName = className
    ? `landing-screenshot-frame ${className}`
    : "landing-screenshot-frame";

  return (
    <div className={frameClassName}>
      <div className="landing-screenshot-bar">
        <span /><span /><span />
      </div>
      <Image
        alt={alt}
        className="landing-screenshot-image"
        height={height}
        priority={priority}
        src={src}
        width={width}
      />
    </div>
  );
}
