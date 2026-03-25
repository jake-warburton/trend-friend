import type { Metadata } from "next";
import Link from "next/link";

import { loadTrendExplorer } from "@/lib/trends";
import { buildMetaTrendDirectory } from "@/lib/trend-browse";
import { formatCategoryLabel } from "@/lib/category-labels";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

export const revalidate = 172800;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const metadata: Metadata = {
  title: "Meta-Trends",
  description: "Explore macro-level meta-trends connecting related emerging signals across categories. See how individual trends cluster into larger movements.",
  alternates: { canonical: `${SITE_URL}/meta-trends` },
  openGraph: {
    title: "Meta-Trends",
    description: "Explore macro-level meta-trends connecting related emerging signals.",
  },
  twitter: { card: "summary_large_image" },
};

export default async function MetaTrendsPage() {
  const explorer = await loadTrendExplorer();
  const directory = buildMetaTrendDirectory(explorer.trends);

  const jsonLd = buildCollectionPageJsonLd({
    url: `${SITE_URL}/meta-trends`,
    name: "Meta-Trends",
    description: "Macro-level meta-trends connecting related emerging signals across categories.",
    numberOfItems: directory.length,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">Browse</p>
          <h1>Meta trends</h1>
          <p className="detail-copy">
            Higher-level demand clusters that group related trends into usable markets and narratives.
          </p>
        </div>
      </section>

      <section className="detail-grid">
        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Directory</p>
              <h2>Tracked meta trends</h2>
            </div>
          </div>

          <div className="detail-list">
            {directory.map((item) => (
              <article className="detail-list-item" key={item.slug}>
                <div>
                  <strong>
                    <Link href={`/meta-trends/${item.slug}`}>{item.label}</Link>
                  </strong>
                  <span>
                    {item.trendCount} trends · avg score {item.averageScore.toFixed(1)} · top trend {item.topTrendName}
                  </span>
                  <span>{item.categories.map((category) => formatCategoryLabel(category)).join(" · ")}</span>
                </div>
                <small>
                  <Link href={`/compare?ids=${item.topTrendId}`}>Open compare</Link>
                </small>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
    </>
  );
}
