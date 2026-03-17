import Link from "next/link";
import { formatCategory } from "./format";

type ExplorerSidebarProps = {
  metaTrends: Array<{ category: string; trendCount: number; averageScore: number }>;
  breakoutTrends: Array<{ id: string; name: string; rank: number }>;
  risingTrends: Array<{ id: string; name: string; scoreTotal: number }>;
  experimentalTrends: Array<{ id: string; name: string; scoreTotal: number }>;
};

export function ExplorerSidebar({
  metaTrends,
  breakoutTrends,
  risingTrends,
  experimentalTrends,
}: ExplorerSidebarProps) {
  return (
    <aside className="history-panel">
      <div className="section-heading">
        <h2>Discover</h2>
      </div>

      <details className="sidebar-section" open>
        <summary>
          <div className="section-heading section-heading-spaced">
            <h2>Categories</h2>
          </div>
        </summary>
        <div className="curated-list">
          {metaTrends.slice(0, 6).map((trend) => (
            <Link className="curated-item" href={`/categories/${trend.category}`} key={trend.category}>
              <span>{formatCategory(trend.category)}</span>
              <small>{trend.trendCount} trends · avg {trend.averageScore.toFixed(1)}</small>
            </Link>
          ))}
          <Link className="curated-item" href="/meta-trends">
            <span>Browse meta trends</span>
            <small>Open the cross-category trend directory</small>
          </Link>
        </div>
      </details>

      <details className="sidebar-section">
        <summary>
          <div className="section-heading section-heading-spaced">
            <h2>Breakout</h2>
          </div>
        </summary>
        <div className="curated-list">
          {breakoutTrends.slice(0, 4).map((trend) => (
            <Link className="curated-item" href={`/trends/${trend.id}`} key={trend.id}>
              <span>{trend.name}</span>
              <strong>#{trend.rank}</strong>
            </Link>
          ))}
        </div>
      </details>

      <details className="sidebar-section">
        <summary>
          <div className="section-heading section-heading-spaced">
            <h2>Rising</h2>
          </div>
        </summary>
        <div className="curated-list">
          {risingTrends.slice(0, 4).map((trend) => (
            <Link className="curated-item" href={`/trends/${trend.id}`} key={trend.id}>
              <span>{trend.name}</span>
              <strong>{trend.scoreTotal.toFixed(1)}</strong>
            </Link>
          ))}
        </div>
      </details>

      <details className="sidebar-section">
        <summary>
          <div className="section-heading section-heading-spaced">
            <h2>Experimental</h2>
          </div>
        </summary>
        <div className="curated-list">
          {experimentalTrends.slice(0, 4).map((trend) => (
            <Link className="curated-item" href={`/trends/${trend.id}`} key={trend.id}>
              <span>{trend.name}</span>
              <strong>{trend.scoreTotal.toFixed(1)}</strong>
            </Link>
          ))}
        </div>
      </details>
    </aside>
  );
}
