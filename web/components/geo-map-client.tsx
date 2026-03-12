"use client";

import dynamic from "next/dynamic";
import type { TrendGeoSummary } from "@/lib/types";
import type { GeoMapDatum } from "@/lib/geo-map-data";

const GeoMap = dynamic(() => import("@/components/geo-map").then((mod) => mod.GeoMap), {
  ssr: false,
  loading: () => <p className="chart-empty">Loading map...</p>,
});

export function GeoMapClient({
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
  return (
    <GeoMap
      data={data}
      mapData={mapData}
      height={height}
      selectedCountryCode={selectedCountryCode}
      onCountrySelect={onCountrySelect}
    />
  );
}
