import { NextResponse } from "next/server";

import { deriveAiUseCaseIntelligence } from "@/lib/ai-use-cases";
import { requirePro } from "@/lib/server/require-pro";
import { loadTrendExplorer } from "@/lib/trends";

export async function GET() {
  const check = await requirePro();
  if (!check.authorized) {
    return check.response;
  }

  const explorer = await loadTrendExplorer();
  const intelligence = deriveAiUseCaseIntelligence(explorer.trends);
  return NextResponse.json(intelligence);
}
