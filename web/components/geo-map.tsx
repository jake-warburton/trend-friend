"use client";

import { useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";

import type { TrendGeoSummary } from "@/lib/types";
import { buildGeoMapData, ISO_NUMERIC_TO_ALPHA2 } from "@/lib/geo-map-data";
import type { GeoMapDatum } from "@/lib/geo-map-data";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type TooltipState = {
  datum: GeoMapDatum;
  x: number;
  y: number;
} | null;

export function GeoMap({
  data,
  height = 420,
}: {
  data: TrendGeoSummary[];
  height?: number;
}) {
  const mapData = buildGeoMapData(data);
  const activeCountryCodes = new Set(mapData.map((d) => d.countryCode));
  const dataByCode = new Map(mapData.map((d) => [d.countryCode, d]));

  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const handleMouseMove = useCallback(
    (datum: GeoMapDatum, event: React.MouseEvent) => {
      setTooltip({ datum, x: event.clientX, y: event.clientY });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  function getCountryFill(code: string | undefined): string {
    if (!code) return "#151b27";
    const datum = dataByCode.get(code);
    if (!datum) return "#151b27";
    const alpha = 0.15 + datum.intensity * 0.55;
    return `rgba(94, 107, 255, ${alpha.toFixed(2)})`;
  }

  function getCountryHoverFill(code: string | undefined): string {
    if (!code) return "#1a2030";
    const datum = dataByCode.get(code);
    if (!datum) return "#1a2030";
    const alpha = 0.25 + datum.intensity * 0.55;
    return `rgba(94, 107, 255, ${alpha.toFixed(2)})`;
  }

  return (
    <div className="geo-map-container">
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 160 }}
        width={800}
        height={height}
        style={{ width: "100%", height: "auto", background: "#0b0e14" }}
      >
        <ZoomableGroup>
          <Graticule stroke="#1e2838" strokeWidth={0.4} />
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericId = String(geo.id).padStart(3, "0");
                const alpha2 = ISO_NUMERIC_TO_ALPHA2[numericId];
                const isActive = alpha2 ? activeCountryCodes.has(alpha2) : false;
                const datum = alpha2 ? dataByCode.get(alpha2) : undefined;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getCountryFill(alpha2)}
                    stroke="#1e2838"
                    strokeWidth={0.5}
                    onMouseMove={
                      isActive && datum
                        ? (event: React.MouseEvent) => handleMouseMove(datum, event)
                        : undefined
                    }
                    onMouseLeave={isActive ? handleMouseLeave : undefined}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        fill: getCountryHoverFill(alpha2),
                        outline: "none",
                        cursor: isActive ? "pointer" : "default",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
          {mapData.map((datum) => {
            const r = 4 + datum.intensity * 12;
            const opacity = 0.6 + datum.intensity * 0.3;
            return (
              <Marker
                key={datum.countryCode}
                coordinates={datum.centroid}
                onMouseMove={(event: React.MouseEvent) => handleMouseMove(datum, event)}
                onMouseLeave={handleMouseLeave}
              >
                <circle
                  r={r}
                  fill={`rgba(94, 107, 255, ${opacity.toFixed(2)})`}
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth={1}
                  style={{ cursor: "pointer" }}
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div
          className="geo-map-tooltip"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
          }}
        >
          <strong>{tooltip.datum.label}</strong>
          <span>
            {tooltip.datum.signalCount} signal{tooltip.datum.signalCount !== 1 ? "s" : ""}
          </span>
          <span>
            {tooltip.datum.explicitCount} explicit · {tooltip.datum.inferredCount} inferred
          </span>
          <div className="geo-intensity-bar">
            <div
              style={{
                width: `${Math.round(tooltip.datum.averageConfidence * 100)}%`,
              }}
            />
          </div>
          <small>{Math.round(tooltip.datum.averageConfidence * 100)}% avg confidence</small>
        </div>
      )}
    </div>
  );
}
