"use client";

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

interface SocialGeoMapProps {
  locationCounts: Record<string, number>;
  selectedLocation: string | null;
  onLocationChange: (location: string | null) => void;
}

export function SocialGeoMap({ locationCounts, selectedLocation, onLocationChange }: SocialGeoMapProps) {
  const maxCount = Math.max(1, ...Object.values(countsByCode(locationCounts)));
  const codeMap = countsByCode(locationCounts);

  function handleClick(countryCode: string | undefined) {
    if (!countryCode) return;
    const location = COUNTRY_CODE_TO_LOCATION[countryCode];
    if (!location) return;
    onLocationChange(selectedLocation === location ? null : location);
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
      <div className="social-geo-map">
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
