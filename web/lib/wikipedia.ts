import type { TrendDetailRecord } from "@/lib/types";

export type WikipediaLink = {
  title: string;
  url: string;
};

export type WikipediaData = {
  extract: string;
  description: string | null;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  originalImageUrl: string | null;
  pageUrl: string;
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
  const data = await loadWikipediaData(title);
  return data?.extract ?? null;
}

export async function loadWikipediaData(title: string): Promise<WikipediaData | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/\s+/g, "_"));
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
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
    const payload = (await response.json()) as {
      extract?: string;
      description?: string;
      thumbnail?: { source?: string; width?: number; height?: number };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    const extract = payload.extract?.trim();
    if (!extract) {
      return null;
    }
    return {
      extract,
      description: payload.description?.trim() || null,
      thumbnailUrl: payload.thumbnail?.source || null,
      thumbnailWidth: payload.thumbnail?.width || null,
      thumbnailHeight: payload.thumbnail?.height || null,
      originalImageUrl: payload.originalimage?.source || null,
      pageUrl: payload.content_urls?.desktop?.page || buildWikipediaUrl(title),
    };
  } catch {
    return null;
  }
}
