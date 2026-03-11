import type { TrendGeoSummary } from "./types";

export type GeoMapDatum = {
  countryCode: string;
  label: string;
  signalCount: number;
  explicitCount: number;
  inferredCount: number;
  averageConfidence: number;
  centroid: [number, number];
  intensity: number;
};

/** Centroids (lng, lat) for the most common country codes. */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [-98.58, 39.83],
  GB: [-1.17, 52.36],
  DE: [10.45, 51.17],
  FR: [2.21, 46.23],
  CA: [-106.35, 56.13],
  AU: [133.78, -25.27],
  IN: [78.96, 20.59],
  JP: [138.25, 36.2],
  BR: [-51.93, -14.24],
  KR: [127.77, 35.91],
  CN: [104.2, 35.86],
  RU: [105.32, 61.52],
  MX: [-102.55, 23.63],
  IT: [12.57, 41.87],
  ES: [-3.75, 40.46],
  NL: [5.29, 52.13],
  SE: [18.64, 60.13],
  NO: [8.47, 60.47],
  FI: [25.75, 61.92],
  PL: [19.15, 51.92],
  CH: [8.23, 46.82],
  AT: [14.55, 47.52],
  BE: [4.47, 50.5],
  IE: [-8.24, 53.41],
  PT: [-8.22, 39.4],
  DK: [9.5, 56.26],
  NZ: [174.89, -40.9],
  SG: [103.82, 1.35],
  ZA: [22.94, -30.56],
  IL: [34.85, 31.05],
  AR: [-63.62, -38.42],
  TR: [35.24, 38.96],
  ID: [113.92, -0.79],
  TH: [100.99, 15.87],
  PH: [121.77, 12.88],
  MY: [101.98, 4.21],
  VN: [108.28, 14.06],
  NG: [8.68, 9.08],
  EG: [30.8, 26.82],
  SA: [45.08, 23.89],
  AE: [53.85, 23.42],
  PK: [69.35, 30.38],
  TW: [120.96, 23.7],
  CL: [-71.54, -35.68],
  CO: [-74.3, 4.57],
  UA: [31.17, 48.38],
  CZ: [15.47, 49.82],
  RO: [24.97, 45.94],
  HU: [19.5, 47.16],
  GR: [21.82, 39.07],
  HK: [114.11, 22.4],
  KE: [37.91, -0.02],
};

/**
 * Mapping from ISO 3166-1 numeric codes (used by TopoJSON) to alpha-2
 * codes (used by our data). Covers the same set as COUNTRY_CENTROIDS.
 */
export const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = {
  "840": "US", "826": "GB", "276": "DE", "250": "FR", "124": "CA",
  "036": "AU", "356": "IN", "392": "JP", "076": "BR", "410": "KR",
  "156": "CN", "643": "RU", "484": "MX", "380": "IT", "724": "ES",
  "528": "NL", "752": "SE", "578": "NO", "246": "FI", "616": "PL",
  "756": "CH", "040": "AT", "056": "BE", "372": "IE", "620": "PT",
  "208": "DK", "554": "NZ", "702": "SG", "710": "ZA", "376": "IL",
  "032": "AR", "792": "TR", "360": "ID", "764": "TH", "608": "PH",
  "458": "MY", "704": "VN", "566": "NG", "818": "EG", "682": "SA",
  "784": "AE", "586": "PK", "158": "TW", "152": "CL", "170": "CO",
  "804": "UA", "203": "CZ", "642": "RO", "348": "HU", "300": "GR",
  "344": "HK", "404": "KE",
};

/**
 * Aggregate TrendGeoSummary rows by country, normalise intensity, and
 * attach centroids so the map can render markers and choropleth fills.
 */
export function buildGeoMapData(geoSummary: TrendGeoSummary[]): GeoMapDatum[] {
  const byCountry = new Map<string, {
    label: string;
    signalCount: number;
    explicitCount: number;
    inferredCount: number;
    confidenceSum: number;
    rows: number;
  }>();

  for (const row of geoSummary) {
    const code = row.countryCode;
    if (!code) continue;
    const existing = byCountry.get(code);
    if (existing) {
      existing.signalCount += row.signalCount;
      existing.explicitCount += row.explicitCount;
      existing.inferredCount += row.inferredCount;
      existing.confidenceSum += row.averageConfidence * row.signalCount;
      existing.rows += row.signalCount;
    } else {
      byCountry.set(code, {
        label: row.label,
        signalCount: row.signalCount,
        explicitCount: row.explicitCount,
        inferredCount: row.inferredCount,
        confidenceSum: row.averageConfidence * row.signalCount,
        rows: row.signalCount,
      });
    }
  }

  const entries = Array.from(byCountry.entries());
  const maxSignals = Math.max(1, ...entries.map(([, v]) => v.signalCount));

  return entries
    .map(([code, data]) => {
      const centroid = COUNTRY_CENTROIDS[code];
      if (!centroid) return null;
      return {
        countryCode: code,
        label: data.label,
        signalCount: data.signalCount,
        explicitCount: data.explicitCount,
        inferredCount: data.inferredCount,
        averageConfidence: data.rows > 0 ? data.confidenceSum / data.rows : 0,
        centroid,
        intensity: data.signalCount / maxSignals,
      };
    })
    .filter((d): d is GeoMapDatum => d !== null)
    .sort((a, b) => b.signalCount - a.signalCount);
}
