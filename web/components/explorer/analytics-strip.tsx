import { scaleValue, formatPercent } from "./format";
import { getSourceColor, buildConicGradient } from "./source-palette";

type AnalyticsStripProps = {
  topTrendScores: Array<{ label: string; value: number }>;
  sourceShare: Array<{ label: string; value: number }>;
  statusBreakdown: Array<{ label: string; value: number }>;
};

export function AnalyticsStrip({
  topTrendScores,
  sourceShare,
  statusBreakdown,
}: AnalyticsStripProps) {
  return (
    <section className="analytics-strip">
      <article className="analytics-card">
        <div className="section-heading">
          <h2>Top scores</h2>
        </div>
        <div className="mini-bar-list">
          {topTrendScores
            .slice(0, 6)
            .map((datum) => (
              <div className="mini-bar-row" key={datum.label}>
                <span>{datum.label}</span>
                <div className="mini-bar-track">
                  <div
                    className="mini-bar-fill"
                    style={{
                      width: `${scaleValue(datum.value, topTrendScores)}%`,
                    }}
                  />
                </div>
                <strong>{datum.value.toFixed(1)}</strong>
              </div>
            ))}
        </div>
      </article>

      <article className="analytics-card analytics-card-pie">
        <div className="section-heading">
          <h2>Source share</h2>
        </div>
        <div className="pie-chart-wrap-full">
          <div
            className="pie-chart-large"
            style={{
              background: buildConicGradient(sourceShare),
            }}
          />
          <div className="pie-chart-legend-grid">
            {sourceShare.map((datum, index) => (
              <div className="pie-legend-item" key={datum.label}>
                <span
                  className="pie-legend-dot"
                  style={{ background: getSourceColor(index) }}
                />
                <span className="pie-legend-label">{datum.label}</span>
                <span className="pie-legend-pct">
                  {formatPercent(datum.value, sourceShare)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="analytics-card">
        <div className="section-heading">
          <h2>Status mix</h2>
        </div>
        <div className="mini-bar-list">
          {statusBreakdown.map((datum) => (
            <div className="mini-bar-row" key={datum.label}>
              <span>{datum.label}</span>
              <div className="mini-bar-track">
                <div
                  className="mini-bar-fill mini-bar-fill-muted"
                  style={{
                    width: `${scaleValue(datum.value, statusBreakdown)}%`,
                  }}
                />
              </div>
              <strong>{datum.value.toFixed(0)}</strong>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
