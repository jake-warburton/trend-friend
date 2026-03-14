"use client";

import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

import type { TrendGeoSummary } from "@/lib/types";
import { buildGeoMapData, lookupCountryCode } from "@/lib/geo-map-data";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MAP_EMPTY_FILL = "var(--map-fill-empty)";
const MAP_STROKE = "var(--map-stroke)";
const MAP_ACTIVE_RGB = "var(--map-fill-active-rgb)";

export function GeoMapCompact({ data }: { data: TrendGeoSummary[] }) {
  const mapData = buildGeoMapData(data);
  const dataByCode = new Map(mapData.map((d) => [d.countryCode, d]));

  function getCountryFill(code: string | undefined): string {
    if (!code) return MAP_EMPTY_FILL;
    const datum = dataByCode.get(code);
    if (!datum) return MAP_EMPTY_FILL;
    const alpha = 0.15 + datum.intensity * 0.55;
    return `rgba(${MAP_ACTIVE_RGB}, ${alpha.toFixed(2)})`;
  }

  return (
    <div className="geo-map-compact">
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 84, center: [0, 8] }}
        width={500}
        height={210}
        style={{ width: "100%", height: "210px", background: "transparent" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const numericId = String(geo.id).padStart(3, "0");
              const alpha2 = lookupCountryCode(numericId, String(geo.properties?.name ?? numericId));

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getCountryFill(alpha2)}
                  stroke={MAP_STROKE}
                  strokeWidth={0.3}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}
