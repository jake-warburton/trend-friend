import Link from "next/link";

import { loadTrendDetails } from "@/lib/trends";
import { buildMetaTrendDirectory } from "@/lib/trend-browse";
import { formatCategoryLabel } from "@/lib/category-labels";

export const dynamic = "force-dynamic";

export default async function MetaTrendsPage() {
  const details = await loadTrendDetails();
  const directory = buildMetaTrendDirectory(details.trends);

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/">
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
  );
}
