import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { loadTrendDetails, loadTrendExplorer } from "@/lib/trends";
import { findCategoryGroup, slugifyBrowseValue } from "@/lib/trend-browse";
import { JsonLd, buildCollectionPageJsonLd, buildBreadcrumbJsonLd } from "@/components/json-ld";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 172800;
export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const explorer = await loadTrendExplorer();
    const categories = new Set(explorer.trends.map((t) => t.category).filter(Boolean));
    return Array.from(categories).map((category) => ({ slug: slugifyBrowseValue(category) }));
  } catch {
    return [];
  }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const details = await loadTrendDetails();
  const group = details ? findCategoryGroup(details.trends, slugifyBrowseValue(slug)) : null;
  if (!group) return { title: "Category Not Found" };

  const normalizedSlug = slugifyBrowseValue(slug);
  const description = `${group.label} — ${group.trendCount} emerging trends tracked across multiple sources. Top trend: ${group.topTrendName}.`;
  return {
    title: group.label,
    description,
    alternates: { canonical: `${SITE_URL}/categories/${normalizedSlug}` },
    openGraph: { title: `${group.label} Trends`, description },
    twitter: { card: "summary_large_image" },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const details = await loadTrendDetails();
  const group = findCategoryGroup(details.trends, slugifyBrowseValue(slug));

  if (group == null) {
    notFound();
  }

  const relatedMetaTrends = [...new Set(group.trends.map((t) => t.metaTrend).filter(Boolean))];

  const jsonLd = [
    buildCollectionPageJsonLd({
      name: `${group.label} Trends`,
      description: `${group.trendCount} emerging trends in ${group.label}`,
      url: `${SITE_URL}/categories/${slug}`,
      numberOfItems: group.trendCount,
    }),
    buildBreadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Categories", url: `${SITE_URL}/categories` },
      { name: group.label, url: `${SITE_URL}/categories/${slug}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <main className="detail-page">
        <section className="detail-hero">
          <div>
            <Link className="detail-back-link" href="/categories">
              Back to categories
            </Link>
            <p className="eyebrow">Category</p>
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
                <h2>{group.label} trends</h2>
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
                      #{trend.rank} · {trend.metaTrend} · {trend.status} · {Math.round(trend.confidence * 100)}% confidence
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

        {relatedMetaTrends.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Related Meta-Trends</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {relatedMetaTrends.map((mt) => (
                <Link
                  key={mt}
                  href={`/meta-trends/${slugifyBrowseValue(mt)}`}
                  style={{
                    padding: "6px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                    textDecoration: "none",
                    color: "var(--foreground)",
                  }}
                >
                  {mt}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
