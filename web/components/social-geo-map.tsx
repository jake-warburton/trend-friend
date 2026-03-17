"use client";

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

import { lookupCountryCode } from "@/lib/geo-map-data";
import { LOCATION_TO_COUNTRY_CODE } from "@/components/explorer/trending-carousel";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MAP_EMPTY_FILL = "var(--map-fill-empty)";
const MAP_STROKE = "var(--map-stroke)";
const MAP_ACTIVE_RGB = "var(--map-fill-active-rgb)";

const COUNTRY_CODE_TO_LOCATION: Record<string, string> = Object.fromEntries(
  Object.entries(LOCATION_TO_COUNTRY_CODE).map(([loc, code]) => [code, loc]),
);

interface TrendingTopic {
  name: string;
  category: string;
  location: string;
  tweet_volume: number | null;
}

interface SocialGeoMapProps {
  trends: TrendingTopic[];
  selectedLocation: string | null;
  onLocationChange: (location: string | null) => void;
}

function buildLocationData(trends: TrendingTopic[]) {
  const byLocation: Record<string, TrendingTopic[]> = {};
  for (const t of trends) {
    if (t.category === "place" && t.location !== "Worldwide") {
      (byLocation[t.location] ??= []).push(t);
    }
  }
  return byLocation;
}

export function SocialGeoMap({ trends, selectedLocation, onLocationChange }: SocialGeoMapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; location: string; topics: string[] } | null>(null);

  const locationData = buildLocationData(trends);
  const locationCounts: Record<string, number> = {};
  for (const [loc, items] of Object.entries(locationData)) {
    locationCounts[loc] = items.length;
  }
  const codeMap = countsByCode(locationCounts);
  const maxCount = Math.max(1, ...Object.values(codeMap));

  function handleClick(countryCode: string | undefined) {
    if (!countryCode) return;
    const location = COUNTRY_CODE_TO_LOCATION[countryCode];
    if (!location) return;
    setTooltip(null);
    onLocationChange(selectedLocation === location ? null : location);
  }

  function handleMouseEnter(countryCode: string | undefined, event: React.MouseEvent) {
    if (!countryCode) return;
    const location = COUNTRY_CODE_TO_LOCATION[countryCode];
    if (!location || !locationData[location]) return;
    const seen = new Set<string>();
    const topics = locationData[location]
      .filter((t) => { const k = t.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 8)
      .map((t) => t.name);
    const rect = (event.currentTarget as SVGElement).closest("svg")?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 10,
      location,
      topics,
    });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  function getFill(code: string | undefined): string {
    if (!code) return MAP_EMPTY_FILL;
    const location = COUNTRY_CODE_TO_LOCATION[code];
    if (selectedLocation && selectedLocation !== location) {
      return codeMap[code] ? `rgba(${MAP_ACTIVE_RGB}, 0.1)` : MAP_EMPTY_FILL;
    }
    const count = codeMap[code];
    if (!count) return MAP_EMPTY_FILL;
    const alpha = 0.2 + (count / maxCount) * 0.6;
    return `rgba(${MAP_ACTIVE_RGB}, ${alpha.toFixed(2)})`;
  }

  return (
    <section className="social-geo-section">
      <div className="social-geo-header">
        <h2 className="social-geo-title">Trending by Region</h2>
        {selectedLocation && (
          <button
            className="social-geo-clear"
            onClick={() => onLocationChange(null)}
          >
            Clear filter: {selectedLocation}
          </button>
        )}
      </div>
      <div className="social-geo-map" style={{ position: "relative" }}>
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 120, center: [0, 8] }}
          width={700}
          height={320}
          style={{ width: "100%", height: "auto", background: "transparent" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericId = String(geo.id).padStart(3, "0");
                const alpha2 = lookupCountryCode(numericId, String(geo.properties?.name ?? numericId));
                const isActive = alpha2 ? !!codeMap[alpha2] : false;
                const isSelected = alpha2 ? COUNTRY_CODE_TO_LOCATION[alpha2] === selectedLocation : false;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getFill(alpha2)}
                    stroke={isSelected ? "var(--accent)" : MAP_STROKE}
                    strokeWidth={isSelected ? 1.2 : 0.3}
                    onClick={() => handleClick(alpha2)}
                    onMouseEnter={(e) => handleMouseEnter(alpha2, e)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      default: { outline: "none", cursor: isActive ? "pointer" : "default" },
                      hover: {
                        outline: "none",
                        fill: isActive ? `rgba(${MAP_ACTIVE_RGB}, 0.5)` : MAP_EMPTY_FILL,
                        cursor: isActive ? "pointer" : "default",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
        {tooltip && (
          <div
            className={`social-geo-tooltip${tooltip.y < 120 ? " social-geo-tooltip-below" : ""}`}
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <strong className="social-geo-tooltip-title">{tooltip.location}</strong>
            <ul className="social-geo-tooltip-list">
              {tooltip.topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function countsByCode(locationCounts: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [location, count] of Object.entries(locationCounts)) {
    const code = LOCATION_TO_COUNTRY_CODE[location];
    if (code) result[code] = count;
  }
  return result;
}
