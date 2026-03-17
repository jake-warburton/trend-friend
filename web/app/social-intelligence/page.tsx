import type { Metadata } from "next";
import { SocialIntelligenceDashboard } from "@/components/social-intelligence-dashboard";

export const metadata: Metadata = {
  title: "Social Intelligence — Signal Eye",
  description: "Real-time Twitter/X trending topics, breaking news from curated accounts, and hashtag tracking across 10+ countries.",
};

export const dynamic = "force-dynamic";

export default function SocialIntelligencePage() {
  return <SocialIntelligenceDashboard />;
}
