import type { TrendDetailRecord } from "@/lib/types";

export type WikipediaLink = {
  title: string;
  url: string;
};

export function getWikipediaLinkFromDetail(
  detail: Pick<TrendDetailRecord, "evidenceItems"> | null | undefined,
): WikipediaLink | null {
  const wikipediaEvidence = detail?.evidenceItems.find((item) => item.source === "wikipedia");
  if (!wikipediaEvidence) {
    return null;
  }
  const title = wikipediaEvidence.evidence.trim();
  if (!title) {
    return null;
  }
  return {
    title,
    url: buildWikipediaUrl(title),
  };
}

export function buildWikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;
}

export async function loadWikipediaSummary(title: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { extract?: string };
    const extract = payload.extract?.trim();
    return extract ? extract : null;
  } catch {
    return null;
  }
}
