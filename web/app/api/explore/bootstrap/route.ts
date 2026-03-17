import { NextResponse } from "next/server";

import { loadExploreDeferredData } from "@/lib/trends";
import type { ExploreDeferredData } from "@/lib/types";

export const revalidate = 2400;

type ExploreBootstrapDependencies = {
  loadDeferredData: () => Promise<ExploreDeferredData>;
};

const DEFAULT_DEPENDENCIES: ExploreBootstrapDependencies = {
  loadDeferredData: loadExploreDeferredData,
};

export async function handleExploreBootstrapGet(
  _request?: Request,
  dependencies: ExploreBootstrapDependencies = DEFAULT_DEPENDENCIES,
) {
  const payload = await dependencies.loadDeferredData();
  return NextResponse.json(payload);
}

export async function GET(request: Request) {
  return handleExploreBootstrapGet(request);
}
