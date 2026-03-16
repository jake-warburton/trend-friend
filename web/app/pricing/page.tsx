import type { Metadata } from "next";
import { PricingTable } from "@/components/pricing-table";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Signal Eye pricing — start free, upgrade to Pro for advanced analytics, alerts, and API access.",
};

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <PricingTable />
    </main>
  );
}
