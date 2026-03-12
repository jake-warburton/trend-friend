import { COUNTRY_CENTROIDS, formatCountryLabel } from "./geo-map-data";
import type { GeoMapDatum, GeoMapTrendContribution } from "./geo-map-data";
import type { TrendDetailRecord, TrendExplorerRecord } from "./types";

type ExplorerGeoAggregate = {
  label: string;
  signalCount: number;
  explicitCount: number;
  inferredCount: number;
  confidenceWeightedSum: number;
  confidenceWeight: number;
  contributingTrends: Map<string, GeoMapTrendContribution>;
};

export function buildExplorerGeoMapData(
  trends: TrendExplorerRecord[],
  detailsByTrendId: Map<string, TrendDetailRecord>,
): GeoMapDatum[] {
  const byCountry = new Map<string, ExplorerGeoAggregate>();

  for (const trend of trends) {
    const detail = detailsByTrendId.get(trend.id);
    if (!detail) {
      continue;
    }

    for (const row of detail.geoSummary) {
      if (!row.countryCode) {
        continue;
      }

      const countryCode = row.countryCode;
      const existing = byCountry.get(countryCode);
      const weightedConfidence = row.averageConfidence * row.signalCount;

      if (existing) {
        existing.signalCount += row.signalCount;
        existing.explicitCount += row.explicitCount;
        existing.inferredCount += row.inferredCount;
        existing.confidenceWeightedSum += weightedConfidence;
        existing.confidenceWeight += row.signalCount;
      } else {
        byCountry.set(countryCode, {
          label: row.label,
          signalCount: row.signalCount,
          explicitCount: row.explicitCount,
          inferredCount: row.inferredCount,
          confidenceWeightedSum: weightedConfidence,
          confidenceWeight: row.signalCount,
          contributingTrends: new Map<string, GeoMapTrendContribution>(),
        });
      }

      const aggregate = byCountry.get(countryCode);
      if (!aggregate) {
        continue;
      }

      const priorContribution = aggregate.contributingTrends.get(trend.id);
      if (priorContribution) {
        priorContribution.signalCount += row.signalCount;
      } else {
        aggregate.contributingTrends.set(trend.id, {
          id: trend.id,
          name: trend.name,
          rank: trend.rank,
          signalCount: row.signalCount,
        });
      }
    }
  }

  const entries = Array.from(byCountry.entries());
  const maxSignals = Math.max(1, ...entries.map(([, value]) => value.signalCount));

  return entries
    .map(([countryCode, aggregate]) => {
      const centroid = COUNTRY_CENTROIDS[countryCode];
      if (!centroid) {
        return null;
      }

      const contributingTrends = Array.from(aggregate.contributingTrends.values()).sort(
        (left, right) => right.signalCount - left.signalCount || left.rank - right.rank || left.name.localeCompare(right.name),
      );

      return {
        countryCode,
        label: formatCountryLabel(countryCode, aggregate.label),
        signalCount: aggregate.signalCount,
        explicitCount: aggregate.explicitCount,
        inferredCount: aggregate.inferredCount,
        averageConfidence:
          aggregate.confidenceWeight > 0 ? aggregate.confidenceWeightedSum / aggregate.confidenceWeight : 0,
        centroid,
        intensity: Math.sqrt(aggregate.signalCount / maxSignals),
        contributingTrends,
      };
    })
    .filter((datum): datum is NonNullable<typeof datum> => datum !== null)
    .sort((left, right) => right.signalCount - left.signalCount || left.label.localeCompare(right.label));
}

export function trendMatchesGeo(detail: TrendDetailRecord | undefined, selectedGeoCountry: string) {
  if (selectedGeoCountry === "all") {
    return true;
  }

  return (detail?.geoSummary ?? []).some((row) => row.countryCode === selectedGeoCountry);
}
