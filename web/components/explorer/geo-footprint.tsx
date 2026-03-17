import { GeoMapClient } from "@/components/geo-map-client";
import type { GeoMapDatum } from "@/lib/geo-map-data";

type GeoFootprintProps = {
  geoMapData: GeoMapDatum[];
  filteredTrendCount: number;
  selectedGeoCountry: string;
  onGeoCountryChange: (value: string) => void;
  isLoading: boolean;
  isReady: boolean;
};

export function GeoFootprint({
  geoMapData,
  filteredTrendCount,
  selectedGeoCountry,
  onGeoCountryChange,
  isLoading,
  isReady,
}: GeoFootprintProps) {
  if (isReady && geoMapData.length > 0) {
    return (
      <section className="explorer-geo-strip">
        <div className="explorer-geo-panel">
          <div className="explorer-geo-panel-head">
            <div>
              <strong>Geographic footprint</strong>
              <p className="source-summary-copy">
                {geoMapData.length} countr
                {geoMapData.length === 1 ? "y" : "ies"} across{" "}
                {filteredTrendCount} visible trend
                {filteredTrendCount === 1 ? "" : "s"}
              </p>
            </div>
            {selectedGeoCountry !== "all" ? (
              <button
                className="mini-action-button"
                onClick={() => onGeoCountryChange("all")}
                type="button"
              >
                Clear geo filter
              </button>
            ) : (
              <span className="section-heading-meta">
                Click a country to filter
              </span>
            )}
          </div>
          <GeoMapClient
            height={320}
            mapData={geoMapData}
            onCountrySelect={(countryCode) =>
              onGeoCountryChange(
                selectedGeoCountry === countryCode ? "all" : countryCode,
              )
            }
            selectedCountryCode={
              selectedGeoCountry !== "all" ? selectedGeoCountry : null
            }
          />
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="explorer-geo-strip">
        <div className="explorer-geo-panel">
          <div className="explorer-geo-panel-head">
            <div>
              <strong>Geographic footprint</strong>
              <p className="source-summary-copy">
                Loading geographic coverage...
              </p>
            </div>
          </div>
          <div className="geo-map-skeleton skeleton-pulse" style={{ height: 320 }} />
        </div>
      </section>
    );
  }

  return null;
}
