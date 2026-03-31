import Link from "next/link";

import { formatCategoryLabel } from "@/lib/category-labels";
import type { AiUseCaseIntelligence } from "@/lib/ai-use-cases";

export function AiUseCasesContent({
  intelligence,
}: {
  intelligence: AiUseCaseIntelligence;
}) {
  const risingCount = intelligence.trends.filter(
    (trend) => trend.status === "rising" || trend.status === "breakout",
  ).length;
  const toolMentionCount = intelligence.trends.reduce(
    (total, trend) => total + trend.toolMentions.length,
    0,
  );

  return (
    <>
      <section className="detail-hero ai-use-cases-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">AI intelligence</p>
          <div className="detail-pill-row">
            <span className="trend-date-chip">Pro dataset</span>
            <span className="trend-date-chip">Explorer payload backed</span>
            <span className="trend-date-chip">No first-party ChatGPT or Claude telemetry</span>
          </div>
          <h1>AI Use Cases</h1>
          <p className="detail-copy">
            This page does not claim direct ChatGPT or Claude product analytics. It clusters
            public trend, developer, and evidence signals into the most likely AI workflows
            people are discussing, building, and buying around.
          </p>
          <p className="ai-use-cases-note">
            Best read as intent intelligence: what AI seems to be getting used for, not exact
            in-product usage counts.
          </p>
        </div>

        <div className="detail-meta-grid">
          <div className="detail-stat-item">
            <span>Qualified use-case trends</span>
            <strong>{intelligence.trends.length}</strong>
          </div>
          <div className="detail-stat-item">
            <span>Use-case clusters</span>
            <strong>{intelligence.clusters.length}</strong>
          </div>
          <div className="detail-stat-item">
            <span>Rising or breakout</span>
            <strong>{risingCount}</strong>
          </div>
          <div className="detail-stat-item">
            <span>Tool mentions captured</span>
            <strong>{toolMentionCount}</strong>
          </div>
        </div>
      </section>

      <section className="detail-grid">
        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Clusters</p>
              <h2>What AI appears to be used for</h2>
            </div>
          </div>

          <div className="ai-use-case-cluster-grid">
            {intelligence.clusters.map((cluster) => (
              <article className="ai-use-case-cluster-card" key={cluster.id}>
                <div className="ai-use-case-cluster-top">
                  <div>
                    <p className="ai-use-case-cluster-kicker">{cluster.label}</p>
                    <h3>{cluster.topTrend.name}</h3>
                  </div>
                  <span className="trend-date-chip">{cluster.trendCount} trends</span>
                </div>
                <p className="ai-use-case-cluster-copy">{cluster.description}</p>
                <div className="ai-use-case-cluster-metrics">
                  <span>Avg score {cluster.averageScore.toFixed(1)}</span>
                  <span>{cluster.risingCount} rising/breakout</span>
                </div>
                {cluster.sampleTools.length > 0 ? (
                  <div className="detail-pill-row">
                    {cluster.sampleTools.map((tool) => (
                      <span className="trend-date-chip" key={`${cluster.id}-${tool}`}>
                        {tool}
                      </span>
                    ))}
                  </div>
                ) : null}
                <Link className="detail-back-link" href={`/trends/${cluster.topTrend.id}`}>
                  Open {cluster.topTrend.name}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Trends</p>
              <h2>Live AI use-case signals</h2>
            </div>
          </div>

          <div className="detail-list">
            {intelligence.trends.map((trend) => (
              <article className="detail-list-item" key={trend.id}>
                <div>
                  <strong>
                    <Link className="trend-link" href={`/trends/${trend.id}`}>
                      {trend.name}
                    </Link>
                  </strong>
                  <span>
                    {trend.useCaseLabel} · {formatCategoryLabel(trend.category)} · rank #{trend.rank}
                  </span>
                  {trend.evidencePreview[0] ? (
                    <span className="ai-use-case-inline-evidence">{trend.evidencePreview[0]}</span>
                  ) : null}
                </div>
                <small>
                  {trend.scoreTotal.toFixed(1)}
                  {trend.toolMentions.length > 0 ? ` · ${trend.toolMentions.join(", ")}` : ""}
                </small>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tools</p>
              <h2>Named tool signals</h2>
            </div>
          </div>

          <div className="detail-list">
            {intelligence.toolSignals.length === 0 ? (
              <article className="detail-list-item">
                <div>
                  <strong>No strong tool names surfaced yet</strong>
                  <span>The current explorer payload has AI workflow signals, but few explicit product-name mentions.</span>
                </div>
              </article>
            ) : (
              intelligence.toolSignals.map((signal) => (
                <article className="detail-list-item" key={signal.tool}>
                  <div>
                    <strong>{signal.tool}</strong>
                    <span>{signal.associatedUseCases.join(" · ")}</span>
                  </div>
                  <small>{signal.mentionCount} mentions</small>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Evidence</p>
              <h2>Public proof points</h2>
            </div>
          </div>

          <div className="detail-list">
            {intelligence.evidenceHighlights.map((highlight) => (
              <article className="detail-list-item detail-evidence-item" key={`${highlight.trendId}-${highlight.evidence}`}>
                <div>
                  <strong>{highlight.useCaseLabel}</strong>
                  <span>{highlight.evidence}</span>
                </div>
                <small>
                  <Link className="trend-link" href={`/trends/${highlight.trendId}`}>
                    {highlight.trendName}
                  </Link>
                </small>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
