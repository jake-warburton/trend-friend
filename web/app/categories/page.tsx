import Link from "next/link";
import type { Metadata } from "next";

import { loadTrendDetails } from "@/lib/trends";
import { buildCategoryDirectory } from "@/lib/trend-browse";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const metadata: Metadata = {
  title: "Trend Categories",
  description: "Browse emerging trends organized by category — AI, crypto, health, culture, and more. Updated daily with momentum scores from 24+ data sources.",
  alternates: { canonical: `${SITE_URL}/categories` },
  openGraph: {
    title: "Trend Categories",
    description: "Browse emerging trends organized by category — AI, crypto, health, culture, and more.",
  },
  twitter: { card: "summary_large_image" },
};

export default async function CategoriesPage() {
  const details = await loadTrendDetails();
  const directory = buildCategoryDirectory(details.trends);

  const jsonLd = buildCollectionPageJsonLd({
    name: "Trend Categories",
    description: "Browse emerging trends organized by category",
    url: `${SITE_URL}/categories`,
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
            <h1>Categories</h1>
            <p className="detail-copy">
              Pipeline-assigned categories for digging through the database by topic family.
            </p>
          </div>
        </section>

        <section className="detail-grid">
          <section className="detail-panel detail-panel-wide">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2>Tracked categories</h2>
              </div>
            </div>

            <div className="detail-list">
              {directory.map((item) => (
                <article className="detail-list-item" key={item.slug}>
                  <div>
                    <strong>
                      <Link href={`/categories/${item.slug}`}>{item.label}</Link>
                    </strong>
                    <span>
                      {item.trendCount} trends · avg score {item.averageScore.toFixed(1)} · meta trend {item.metaTrend}
                    </span>
                    <span>Top trend {item.topTrendName}</span>
                  </div>
                  <small>
                    <Link href={`/trends/${item.topTrendId}`}>Open top trend</Link>
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
