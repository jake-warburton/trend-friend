"use client";

import dynamic from "next/dynamic";
import type { TrendGeoSummary } from "@/lib/types";

const GeoMap = dynamic(() => import("@/components/geo-map").then((mod) => mod.GeoMap), {
  ssr: false,
  loading: () => <p className="chart-empty">Loading map...</p>,
});

export function GeoMapClient({ data, height = 420 }: { data: TrendGeoSummary[]; height?: number }) {
  return <GeoMap data={data} height={height} />;
}
