"use client";

import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

import type { TrendGeoSummary } from "@/lib/types";
import { buildGeoMapData, ISO_NUMERIC_TO_ALPHA2 } from "@/lib/geo-map-data";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function GeoMapCompact({ data }: { data: TrendGeoSummary[] }) {
  const mapData = buildGeoMapData(data);
  const dataByCode = new Map(mapData.map((d) => [d.countryCode, d]));

  function getCountryFill(code: string | undefined): string {
    if (!code) return "#151b27";
    const datum = dataByCode.get(code);
    if (!datum) return "#151b27";
    const alpha = 0.15 + datum.intensity * 0.55;
    return `rgba(94, 107, 255, ${alpha.toFixed(2)})`;
  }

  return (
    <div className="geo-map-compact">
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 100 }}
        width={500}
        height={120}
        style={{ width: "100%", height: "120px", background: "transparent" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const numericId = String(geo.id).padStart(3, "0");
              const alpha2 = ISO_NUMERIC_TO_ALPHA2[numericId];

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getCountryFill(alpha2)}
                  stroke="#1e2838"
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
