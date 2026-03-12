"use client";

import { useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  ZoomableGroup,
} from "react-simple-maps";

import type { TrendGeoSummary } from "@/lib/types";
import { buildGeoMapData, formatCountryLabel, lookupCountryCode } from "@/lib/geo-map-data";
import type { GeoMapDatum } from "@/lib/geo-map-data";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MAP_EMPTY_FILL = "var(--map-fill-empty)";
const MAP_STROKE = "var(--map-stroke)";
const MAP_BACKGROUND = "var(--map-background)";
const MAP_ACTIVE_RGB = "var(--map-fill-active-rgb)";

type TooltipState = {
  datum: GeoMapDatum;
  x: number;
  y: number;
} | null;

export function GeoMap({
  data,
  mapData,
  height = 420,
  selectedCountryCode,
  onCountrySelect,
}: {
  data?: TrendGeoSummary[];
  mapData?: GeoMapDatum[];
  height?: number;
  selectedCountryCode?: string | null;
  onCountrySelect?: (countryCode: string) => void;
}) {
  const resolvedMapData = mapData ?? buildGeoMapData(data ?? []);
  const dataByCode = new Map(resolvedMapData.map((d) => [d.countryCode, d]));

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
    if (!code) return MAP_EMPTY_FILL;
    const datum = dataByCode.get(code);
    if (!datum) return MAP_EMPTY_FILL;
    if (selectedCountryCode && selectedCountryCode === code) {
      return `rgba(${MAP_ACTIVE_RGB}, 0.82)`;
    }
    const alpha = 0.15 + datum.intensity * 0.55;
    return `rgba(${MAP_ACTIVE_RGB}, ${alpha.toFixed(2)})`;
  }

  function getCountryHoverFill(code: string | undefined): string {
    if (!code) return MAP_EMPTY_FILL;
    const datum = dataByCode.get(code);
    if (!datum) return MAP_EMPTY_FILL;
    if (selectedCountryCode && selectedCountryCode === code) {
      return `rgba(${MAP_ACTIVE_RGB}, 0.88)`;
    }
    const alpha = 0.25 + datum.intensity * 0.55;
    return `rgba(${MAP_ACTIVE_RGB}, ${alpha.toFixed(2)})`;
  }

  return (
    <div className="geo-map-container">
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 160 }}
        width={800}
        height={height}
        style={{ width: "100%", height: "auto", background: MAP_BACKGROUND }}
      >
        <ZoomableGroup>
          <Graticule stroke={MAP_STROKE} strokeWidth={0.4} />
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericId = String(geo.id).padStart(3, "0");
                const geographyName = String(geo.properties?.name ?? numericId);
                const alpha2 = lookupCountryCode(numericId, geographyName);
                const datum = alpha2 ? dataByCode.get(alpha2) : undefined;
                const hoverDatum = datum
                  ?? (alpha2
                    ? {
                        countryCode: alpha2,
                        label: formatCountryLabel(alpha2, geographyName),
                        signalCount: 0,
                        explicitCount: 0,
                        inferredCount: 0,
                        averageConfidence: 0,
                        centroid: [0, 0] as [number, number],
                        intensity: 0,
                      }
                    : {
                        countryCode: numericId,
                        label: geographyName,
                        signalCount: 0,
                        explicitCount: 0,
                        inferredCount: 0,
                        averageConfidence: 0,
                        centroid: [0, 0] as [number, number],
                        intensity: 0,
                      });

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getCountryFill(alpha2)}
                    stroke={MAP_STROKE}
                    strokeWidth={selectedCountryCode && selectedCountryCode === alpha2 ? 0.9 : 0.5}
                    onMouseMove={
                      hoverDatum
                        ? (event: React.MouseEvent) => handleMouseMove(hoverDatum, event)
                        : undefined
                    }
                    onMouseLeave={hoverDatum ? handleMouseLeave : undefined}
                    onClick={
                      alpha2 && datum && onCountrySelect
                        ? () => onCountrySelect(alpha2)
                        : undefined
                    }
                    style={{
                      default: { outline: "none" },
                      hover: {
                        fill: getCountryHoverFill(alpha2),
                        outline: "none",
                        cursor: datum && onCountrySelect ? "pointer" : hoverDatum ? "pointer" : "default",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
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
          {tooltip.datum.signalCount > 0 ? (
            <>
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
              {tooltip.datum.contributingTrends && tooltip.datum.contributingTrends.length > 0 ? (
                <div className="geo-map-trend-list">
                  {tooltip.datum.contributingTrends.map((trend) => (
                    <div className="geo-map-trend-row" key={`${tooltip.datum.countryCode}-${trend.id}`}>
                      <span>{trend.name}</span>
                      <small>{trend.signalCount}</small>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <small>No tagged signals</small>
          )}
        </div>
      )}
    </div>
  );
}
