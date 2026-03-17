import { Suspense } from "react";
import { AdIntelligenceDashboard } from "@/components/ad-intelligence-dashboard";

export const revalidate = 3600;

export default function AdIntelligencePage() {
  return (
    <Suspense>
      <AdIntelligenceDashboard />
    </Suspense>
  );
}
