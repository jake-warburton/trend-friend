import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTrendDetails } from "@/lib/trends";
import { findMetaTrendGroup, slugifyBrowseValue } from "@/lib/trend-browse";
import { formatCategoryLabel } from "@/lib/category-labels";
import { JsonLd, buildCollectionPageJsonLd, buildBreadcrumbJsonLd } from "@/components/json-ld";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

type MetaTrendPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: MetaTrendPageProps): Promise<Metadata> {
  const { slug } = await params;
  const details = await loadTrendDetails();
  const group = details ? findMetaTrendGroup(details.trends, slug) : null;
  if (!group) return { title: "Meta-Trend Not Found" };

  const description = `${group.label} — a meta-trend connecting ${group.trendCount} related trends with an average momentum score of ${Math.round(group.averageScore)}.`;
  return {
    title: group.label,
    description,
    alternates: { canonical: `${SITE_URL}/meta-trends/${slugifyBrowseValue(slug)}` },
    openGraph: { title: `${group.label} — Meta-Trend`, description },
    twitter: { card: "summary_large_image" },
  };
}

export default async function MetaTrendPage({ params }: MetaTrendPageProps) {
  const { slug } = await params;
  const details = await loadTrendDetails();
  const group = findMetaTrendGroup(details.trends, slug);

  if (group == null) {
    notFound();
  }

  const relatedCategories = [...new Set(group.trends.map((t) => t.category).filter(Boolean))];

  const collectionJsonLd = buildCollectionPageJsonLd({
    url: `${SITE_URL}/meta-trends/${slugifyBrowseValue(slug)}`,
    name: group.label,
    description: group.description,
    numberOfItems: group.trendCount,
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Meta-Trends", url: `${SITE_URL}/meta-trends` },
    { name: group.label, url: `${SITE_URL}/meta-trends/${slugifyBrowseValue(slug)}` },
  ]);

  return (
    <>
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/meta-trends">
            Back to meta trends
          </Link>
          <p className="eyebrow">Meta trend</p>
          <h1>{group.label}</h1>
          <p className="detail-copy">{group.description}</p>
        </div>

        <div className="detail-meta-grid">
          <div className="detail-stat-item">
            <span>Tracked trends</span>
            <strong>{group.trendCount}</strong>
          </div>
          <div className="detail-stat-item">
            <span>Average score</span>
            <strong>{group.averageScore.toFixed(1)}</strong>
          </div>
          <div className="detail-stat-item">
            <span>Top trend</span>
            <strong>{group.topTrendName}</strong>
          </div>
        </div>
      </section>

      <section className="detail-grid">
        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Trends</p>
              <h2>{group.label} opportunities</h2>
            </div>
          </div>

          <div className="detail-list">
            {group.trends.map((trend) => (
              <article className="detail-list-item" key={trend.id}>
                <div>
                  <strong>
                    <Link href={`/trends/${trend.id}`}>{trend.name}</Link>
                  </strong>
                  <span>
                    #{trend.rank} · {formatCategoryLabel(trend.category)} · {trend.stage} · {Math.round(trend.confidence * 100)}%
                    {" "}confidence
                  </span>
                  <span>{trend.summary}</span>
                </div>
                <small>
                  <Link href={`/compare?ids=${trend.id}`}>Compare</Link>
                </small>
              </article>
            ))}
          </div>
        </section>
      </section>

      {relatedCategories.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Categories</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {relatedCategories.map((cat) => (
              <Link
                key={cat}
                href={`/categories/${slugifyBrowseValue(cat)}`}
                style={{
                  padding: "6px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  textDecoration: "none",
                  color: "var(--foreground)",
                }}
              >
                {cat}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
    </>
  );
}
