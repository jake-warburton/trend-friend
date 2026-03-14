import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTrendDetails } from "@/lib/trends";
import { findMetaTrendGroup } from "@/lib/trend-browse";
import { formatCategoryLabel } from "@/lib/category-labels";

type MetaTrendPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function MetaTrendPage({ params }: MetaTrendPageProps) {
  const { slug } = await params;
  const details = await loadTrendDetails();
  const group = findMetaTrendGroup(details.trends, slug);

  if (group == null) {
    notFound();
  }

  return (
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
    </main>
  );
}
