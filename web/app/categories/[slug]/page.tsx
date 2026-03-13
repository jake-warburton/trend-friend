import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTrendDetails } from "@/lib/trends";
import { findCategoryGroup, slugifyBrowseValue } from "@/lib/trend-browse";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const details = await loadTrendDetails();
  const group = findCategoryGroup(details.trends, slugifyBrowseValue(slug));

  if (group == null) {
    notFound();
  }

  return (
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
    </main>
  );
}
