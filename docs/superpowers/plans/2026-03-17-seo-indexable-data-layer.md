# SEO: Indexable Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing auto-refreshing content crawlable and conversion-optimized to drive organic traffic → Pro signups.

**Architecture:** Switch category/meta-trend/source pages from `force-dynamic` to ISR, add JSON-LD structured data across all public pages, convert social/ad intelligence from auth-gated to public teasers with fake blurred data, fix canonical domain, and add internal cross-links.

**Tech Stack:** Next.js App Router (ISR, generateMetadata, server components), Schema.org JSON-LD, existing data loaders from `web/lib/trends.ts`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `web/components/json-ld.tsx` | Create | Shared JSON-LD renderer component |
| `web/app/categories/page.tsx` | Modify | ISR + generateMetadata + JSON-LD |
| `web/app/categories/[slug]/page.tsx` | Modify | ISR + generateMetadata + JSON-LD + breadcrumbs |
| `web/app/meta-trends/page.tsx` | Modify | ISR + generateMetadata + JSON-LD |
| `web/app/meta-trends/[slug]/page.tsx` | Modify | ISR + generateMetadata + JSON-LD + breadcrumbs |
| `web/app/sources/[source]/page.tsx` | Modify | ISR + generateMetadata + JSON-LD |
| `web/app/trends/[slug]/page.tsx` | Modify | Add JSON-LD + breadcrumbs + related trends links |
| `web/app/sitemap.ts` | Modify | Add category/meta-trend/source URLs |
| `web/app/robots.ts` | Modify | Add social/ad intelligence to allow list |
| `web/app/layout.tsx` | Modify | Fix metadataBase to www |
| `web/middleware.ts` | Modify | Remove social/ad intelligence from PROTECTED_ROUTES |
| `web/app/social-intelligence/page.tsx` | Modify | Server teaser + conditional client dashboard |
| `web/app/ad-intelligence/page.tsx` | Modify | Server teaser + conditional client dashboard |
| `web/components/social-intelligence-dashboard.tsx` | Modify | Remove ProGate/auth redirect (handled by page) |
| `web/components/ad-intelligence-dashboard.tsx` | Modify | Remove ProGate/auth redirect (handled by page) |
| `web/tests/json-ld.test.ts` | Create | Tests for JSON-LD component |
| `web/tests/seo-metadata.test.ts` | Create | Tests for sitemap, robots, metadata changes |
| `web/tests/teaser-pages.test.ts` | Create | Tests for teaser data generation |

---

## Task 1: JSON-LD Component

**Files:**
- Create: `web/components/json-ld.tsx`
- Create: `web/tests/json-ld.test.ts`

- [ ] **Step 1: Write failing tests for JSON-LD helpers**

```typescript
// web/tests/json-ld.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArticleJsonLd,
  buildCollectionPageJsonLd,
  buildBreadcrumbJsonLd,
} from "@/components/json-ld";

test("buildArticleJsonLd produces valid Article schema", () => {
  const result = buildArticleJsonLd({
    headline: "AI Agents — Trend Analysis",
    description: "AI Agents is trending across 8 sources",
    url: "https://www.signaleye.live/trends/ai-agents",
    imageUrl: "https://upload.wikimedia.org/image.jpg",
  });
  assert.equal(result["@context"], "https://schema.org");
  assert.equal(result["@type"], "Article");
  assert.equal(result.headline, "AI Agents — Trend Analysis");
  assert.equal(result.author["@type"], "Organization");
  assert.equal(result.author.name, "Signal Eye");
  assert.ok(result.dateModified);
  assert.deepEqual(result.image, ["https://upload.wikimedia.org/image.jpg"]);
});

test("buildArticleJsonLd omits image when not provided", () => {
  const result = buildArticleJsonLd({
    headline: "Test",
    description: "Test desc",
    url: "https://www.signaleye.live/trends/test",
  });
  assert.equal(result.image, undefined);
});

test("buildCollectionPageJsonLd produces valid CollectionPage schema", () => {
  const result = buildCollectionPageJsonLd({
    name: "Artificial Intelligence Trends",
    description: "47 emerging AI trends",
    url: "https://www.signaleye.live/categories/artificial-intelligence",
    numberOfItems: 47,
  });
  assert.equal(result["@context"], "https://schema.org");
  assert.equal(result["@type"], "CollectionPage");
  assert.equal(result.numberOfItems, 47);
});

test("buildBreadcrumbJsonLd produces valid BreadcrumbList", () => {
  const result = buildBreadcrumbJsonLd([
    { name: "Home", url: "https://www.signaleye.live" },
    { name: "Categories", url: "https://www.signaleye.live/categories" },
    { name: "AI", url: "https://www.signaleye.live/categories/ai" },
  ]);
  assert.equal(result["@type"], "BreadcrumbList");
  assert.equal(result.itemListElement.length, 3);
  assert.equal(result.itemListElement[0].position, 1);
  assert.equal(result.itemListElement[2].item, "https://www.signaleye.live/categories/ai");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && node --import tsx --test tests/json-ld.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement JSON-LD component and helpers**

```tsx
// web/components/json-ld.tsx

type ArticleJsonLdProps = {
  headline: string;
  description: string;
  url: string;
  imageUrl?: string;
};

type CollectionPageJsonLdProps = {
  name: string;
  description: string;
  url: string;
  numberOfItems: number;
};

type BreadcrumbItem = { name: string; url: string };

export function buildArticleJsonLd({ headline, description, url, imageUrl }: ArticleJsonLdProps) {
  return {
    "@context": "https://schema.org" as const,
    "@type": "Article" as const,
    headline,
    description,
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization" as const, name: "Signal Eye" },
    mainEntityOfPage: url,
    ...(imageUrl ? { image: [imageUrl] } : {}),
  };
}

export function buildCollectionPageJsonLd({ name, description, url, numberOfItems }: CollectionPageJsonLdProps) {
  return {
    "@context": "https://schema.org" as const,
    "@type": "CollectionPage" as const,
    name,
    description,
    url,
    numberOfItems,
  };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org" as const,
    "@type": "BreadcrumbList" as const,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const jsonLdArray = Array.isArray(data) ? data : [data];
  return (
    <>
      {jsonLdArray.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && node --import tsx --test tests/json-ld.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/json-ld.tsx web/tests/json-ld.test.ts
git commit -m "feat: add JSON-LD structured data component and helpers"
```

---

## Task 2: Canonical Domain Fix

**Files:**
- Modify: `web/app/layout.tsx:18-19` (metadataBase fallback)

- [ ] **Step 1: Update metadataBase fallback to www**

In `web/app/layout.tsx`, change the `metadataBase` fallback from `"https://signaleye.live"` to `"https://www.signaleye.live"`:

```tsx
// Before:
metadataBase: new URL(process.env.SIGNAL_EYE_FRONTEND_URL ?? "https://signaleye.live"),

// After:
metadataBase: new URL(process.env.SIGNAL_EYE_FRONTEND_URL ?? "https://www.signaleye.live"),
```

- [ ] **Step 2: Verify no other references to non-www domain**

Run: `cd web && grep -r "signaleye\.live" --include="*.ts" --include="*.tsx" | grep -v "www\." | grep -v node_modules | grep -v ".next"`

Expected: Only the env var fallback in layout.tsx (now fixed). If any others exist, update them too.

- [ ] **Step 3: Commit**

```bash
git add web/app/layout.tsx
git commit -m "fix: unify canonical domain to www.signaleye.live"
```

> **Note:** Also update `SIGNAL_EYE_FRONTEND_URL` in Vercel production environment to `https://www.signaleye.live` if currently set to the non-www variant. Configure Vercel Domains to redirect `signaleye.live` → `www.signaleye.live`.

---

## Task 3: Categories ISR + Metadata + JSON-LD

**Files:**
- Modify: `web/app/categories/page.tsx`
- Modify: `web/app/categories/[slug]/page.tsx`

- [ ] **Step 1: Update categories index page**

In `web/app/categories/page.tsx`:

1. Replace `export const dynamic = "force-dynamic"` with `export const revalidate = 600`
2. Add metadata export
3. Add JSON-LD

```tsx
// At the top, add imports:
import type { Metadata } from "next";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

// Replace: export const dynamic = "force-dynamic"
// With:
export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const metadata: Metadata = {
  title: "Trend Categories",
  description:
    "Browse emerging trends organized by category — AI, crypto, health, culture, and more. Updated daily with momentum scores from 24+ data sources.",
  alternates: { canonical: `${SITE_URL}/categories` },
  openGraph: {
    title: "Trend Categories",
    description:
      "Browse emerging trends organized by category — AI, crypto, health, culture, and more.",
  },
  twitter: { card: "summary_large_image" },
};

// Inside the component, before the return, add:
const jsonLd = buildCollectionPageJsonLd({
  name: "Trend Categories",
  description: "Browse emerging trends organized by category",
  url: `${SITE_URL}/categories`,
  numberOfItems: directory.length,
});

// At the top of the JSX return, add:
<JsonLd data={jsonLd} />
```

- [ ] **Step 2: Update categories slug page**

In `web/app/categories/[slug]/page.tsx`:

1. Replace `export const dynamic = "force-dynamic"` with `export const revalidate = 300`
2. Add `generateMetadata` function
3. Add JSON-LD + breadcrumbs

```tsx
// Add imports:
import type { Metadata } from "next";
import {
  JsonLd,
  buildCollectionPageJsonLd,
  buildBreadcrumbJsonLd,
} from "@/components/json-ld";

// Replace: export const dynamic = "force-dynamic"
// With:
export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

// Add generateMetadata:
export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const details = await loadTrendDetails();
  const group = details ? findCategoryGroup(details.trends, slugifyBrowseValue(slug)) : null;
  if (!group) return { title: "Category Not Found" };

  const normalizedSlug = slugifyBrowseValue(slug);
  const description = `${group.label} — ${group.trendCount} emerging trends tracked across multiple sources. Top trend: ${group.topTrendName}.`;
  return {
    title: group.label,
    description,
    alternates: { canonical: `${SITE_URL}/categories/${normalizedSlug}` },
    openGraph: { title: `${group.label} Trends`, description },
    twitter: { card: "summary_large_image" },
  };
}

// Inside the component, before return, add JSON-LD + breadcrumbs:
const jsonLd = [
  buildCollectionPageJsonLd({
    name: `${group.label} Trends`,
    description: `${group.trendCount} emerging trends in ${group.label}`,
    url: `${SITE_URL}/categories/${slug}`,
    numberOfItems: group.trendCount,
  }),
  buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Categories", url: `${SITE_URL}/categories` },
    { name: group.label, url: `${SITE_URL}/categories/${slug}` },
  ]),
];

// At top of JSX return:
<JsonLd data={jsonLd} />
```

- [ ] **Step 3: Run the dev server and verify both pages load**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build succeeds. Categories pages are now ISR (shown as "ISR" in build output, not "λ Dynamic").

- [ ] **Step 4: Commit**

```bash
git add web/app/categories/page.tsx web/app/categories/\[slug\]/page.tsx
git commit -m "feat: make category pages crawlable with ISR, metadata, and JSON-LD"
```

---

## Task 4: Meta-Trends ISR + Metadata + JSON-LD

**Files:**
- Modify: `web/app/meta-trends/page.tsx`
- Modify: `web/app/meta-trends/[slug]/page.tsx`

- [ ] **Step 1: Update meta-trends index page**

Same pattern as Task 3. In `web/app/meta-trends/page.tsx`:

1. Replace `export const dynamic = "force-dynamic"` with `export const revalidate = 600`
2. Add metadata + JSON-LD

```tsx
import type { Metadata } from "next";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const metadata: Metadata = {
  title: "Meta-Trends",
  description:
    "Explore macro-level meta-trends connecting related emerging signals across categories. See how individual trends cluster into larger movements.",
  alternates: { canonical: `${SITE_URL}/meta-trends` },
  openGraph: {
    title: "Meta-Trends",
    description: "Explore macro-level meta-trends connecting related emerging signals.",
  },
  twitter: { card: "summary_large_image" },
};

// Inside component, before return:
const jsonLd = buildCollectionPageJsonLd({
  name: "Meta-Trends",
  description: "Macro-level trends connecting related signals",
  url: `${SITE_URL}/meta-trends`,
  numberOfItems: directory.length,
});

// Top of JSX:
<JsonLd data={jsonLd} />
```

- [ ] **Step 2: Update meta-trends slug page**

In `web/app/meta-trends/[slug]/page.tsx`:

1. Replace `export const dynamic = "force-dynamic"` with `export const revalidate = 300`
2. Add `generateMetadata` + JSON-LD + breadcrumbs

```tsx
import type { Metadata } from "next";
import {
  JsonLd,
  buildCollectionPageJsonLd,
  buildBreadcrumbJsonLd,
} from "@/components/json-ld";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export async function generateMetadata({ params }: MetaTrendPageProps): Promise<Metadata> {
  const { slug } = await params;
  const details = await loadTrendDetails();
  const group = details ? findMetaTrendGroup(details.trends, slug) : null;
  if (!group) return { title: "Meta-Trend Not Found" };

  const description = `${group.label} — a meta-trend connecting ${group.trendCount} related trends with an average momentum score of ${Math.round(group.averageScore)}.`;
  return {
    title: group.label,
    description,
    alternates: { canonical: `${SITE_URL}/meta-trends/${slugifyBrowseValue(slug)}` },
    openGraph: { title: `${group.label} — Meta-Trend`, description },
    twitter: { card: "summary_large_image" },
  };
}

// Inside component, before return:
const jsonLd = [
  buildCollectionPageJsonLd({
    name: `${group.label} — Meta-Trend`,
    description: `Connecting ${group.trendCount} related trends`,
    url: `${SITE_URL}/meta-trends/${slug}`,
    numberOfItems: group.trendCount,
  }),
  buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Meta-Trends", url: `${SITE_URL}/meta-trends` },
    { name: group.label, url: `${SITE_URL}/meta-trends/${slug}` },
  ]),
];

// Top of JSX:
<JsonLd data={jsonLd} />
```

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/app/meta-trends/page.tsx web/app/meta-trends/\[slug\]/page.tsx
git commit -m "feat: make meta-trend pages crawlable with ISR, metadata, and JSON-LD"
```

---

## Task 5: Sources ISR + Metadata + JSON-LD

**Files:**
- Modify: `web/app/sources/[source]/page.tsx`

- [ ] **Step 1: Update sources page**

In `web/app/sources/[source]/page.tsx`:

1. Replace `export const dynamic = "force-dynamic"` with `export const revalidate = 600`
2. Add `generateMetadata` + JSON-LD + breadcrumbs

```tsx
import type { Metadata } from "next";
import {
  JsonLd,
  buildCollectionPageJsonLd,
  buildBreadcrumbJsonLd,
} from "@/components/json-ld";

export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

// Add generateMetadata (use the existing formatSourceLabel helper in the file):
export async function generateMetadata({ params }: SourcePageProps): Promise<Metadata> {
  const { source } = await params;
  const summary = await loadSourceSummary(source);
  if (!summary) return { title: "Source Not Found" };

  const label = formatSourceLabel(source);
  const description = `${label} source health — tracking ${summary.trendCount ?? 0} trends. See run history, top trends, and signal quality metrics.`;
  return {
    title: `${label} — Source Health`,
    description,
    alternates: { canonical: `${SITE_URL}/sources/${source}` },
    openGraph: { title: `${label} — Source Health`, description },
    twitter: { card: "summary_large_image" },
  };
}

// Inside the component, after data loads, before return:
const label = formatSourceLabel(source);
const jsonLd = [
  buildCollectionPageJsonLd({
    name: `${label} — Source Health`,
    description: `Signal quality and trend tracking for ${label}`,
    url: `${SITE_URL}/sources/${source}`,
    numberOfItems: summary.trendCount ?? 0,
  }),
  buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Sources", url: `${SITE_URL}/explore` },
    { name: label, url: `${SITE_URL}/sources/${source}` },
  ]),
];

// Top of JSX:
<JsonLd data={jsonLd} />
```

> **Note:** The `formatSourceLabel` function already exists in this file. Use it. The `SourceSummaryRecord` type may need checking for the `totalTrends` field — adapt to whatever field name is actually on the record.

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/app/sources/\[source\]/page.tsx
git commit -m "feat: make source pages crawlable with ISR, metadata, and JSON-LD"
```

---

## Task 6: Trend Detail JSON-LD + Breadcrumbs

**Files:**
- Modify: `web/app/trends/[slug]/page.tsx`

- [ ] **Step 1: Add JSON-LD and breadcrumbs to trend detail page**

In `web/app/trends/[slug]/page.tsx`:

1. Import JSON-LD helpers
2. Add canonical URL to existing `generateMetadata`
3. Add JSON-LD in the component body

```tsx
// Add imports:
import {
  JsonLd,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
} from "@/components/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

// In generateMetadata, add alternates to the return:
alternates: { canonical: `${SITE_URL}/trends/${slug}` },

// Inside the main component (after data loads, before return), build the description
// and JSON-LD. Note: generateMetadata and the component are separate functions,
// so reconstruct the description here:
const articleDescription = trend.wikipediaDescription ?? trend.summary ?? `${trend.name} is an emerging trend tracked by Signal Eye.`;
const jsonLd = [
  buildArticleJsonLd({
    headline: `${trend.name} — Trend Analysis`,
    description: articleDescription,
    url: `${SITE_URL}/trends/${trend.id}`,
    imageUrl: trend.wikipediaThumbnailUrl ?? undefined,
  }),
  buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Explore", url: `${SITE_URL}/explore` },
    { name: formatCategoryLabel(trend.category), url: `${SITE_URL}/categories/${slugifyBrowseValue(trend.category)}` },
    { name: trend.name, url: `${SITE_URL}/trends/${trend.id}` },
  ]),
];

// Top of JSX return:
<JsonLd data={jsonLd} />
```

Also import `slugifyBrowseValue` from `@/lib/trend-browse`.

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/app/trends/\[slug\]/page.tsx
git commit -m "feat: add JSON-LD structured data and breadcrumbs to trend detail pages"
```

---

## Task 7: Expand Sitemap

**Files:**
- Modify: `web/app/sitemap.ts`

- [ ] **Step 1: Write a test for sitemap expansion**

```typescript
// web/tests/seo-metadata.test.ts
import assert from "node:assert/strict";
import test from "node:test";

test("sitemap includes category, meta-trend, and source URLs", async () => {
  // Import the sitemap function — it calls loadTrendExplorer() internally
  // which falls back to local JSON data
  const { default: sitemap } = await import("@/app/sitemap");
  const entries = await sitemap();

  const urls = entries.map((e) => e.url);

  // Static pages always present
  assert.ok(urls.some((u) => u.endsWith("/")));
  assert.ok(urls.some((u) => u.includes("/explore")));
  assert.ok(urls.some((u) => u.includes("/pricing")));

  // Dynamic pages should now include categories, meta-trends, sources
  assert.ok(urls.some((u) => u.includes("/categories/")), "should include category URLs");
  assert.ok(urls.some((u) => u.includes("/meta-trends/")), "should include meta-trend URLs");
  assert.ok(urls.some((u) => u.includes("/sources/")), "should include source URLs");

  // Should also include social/ad intelligence
  assert.ok(urls.some((u) => u.includes("/social-intelligence")));
  assert.ok(urls.some((u) => u.includes("/ad-intelligence")));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && node --import tsx --test tests/seo-metadata.test.ts`
Expected: FAIL — no category/meta-trend/source URLs in sitemap

- [ ] **Step 3: Expand sitemap.ts**

Update `web/app/sitemap.ts` to extract categories, meta-trends, and sources from the existing `loadTrendExplorer()` data:

```typescript
import type { MetadataRoute } from "next";
import { loadTrendExplorer } from "@/lib/trends";
import { slugifyBrowseValue } from "@/lib/trend-browse";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/explore`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/social-intelligence`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/ad-intelligence`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
  ];

  try {
    const explorer = await loadTrendExplorer();
    if (!explorer?.trends?.length) return staticPages;

    const trendPages: MetadataRoute.Sitemap = explorer.trends.map((t) => ({
      url: `${BASE}/trends/${t.id}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    const categories = [...new Set(explorer.trends.map((t) => t.category).filter(Boolean))];
    const categoryPages: MetadataRoute.Sitemap = [
      { url: `${BASE}/categories`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
      ...categories.map((c) => ({
        url: `${BASE}/categories/${slugifyBrowseValue(c)}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];

    const metaTrends = [...new Set(explorer.trends.map((t) => t.metaTrend).filter(Boolean))];
    const metaTrendPages: MetadataRoute.Sitemap = [
      { url: `${BASE}/meta-trends`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
      ...metaTrends.map((mt) => ({
        url: `${BASE}/meta-trends/${slugifyBrowseValue(mt)}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];

    const sources = [...new Set(explorer.trends.flatMap((t) => t.sources).filter(Boolean))];
    const sourcePages: MetadataRoute.Sitemap = sources.map((s) => ({
      url: `${BASE}/sources/${s}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...trendPages, ...categoryPages, ...metaTrendPages, ...sourcePages];
  } catch {
    return staticPages;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && node --import tsx --test tests/seo-metadata.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/sitemap.ts web/tests/seo-metadata.test.ts
git commit -m "feat: expand sitemap with category, meta-trend, and source URLs"
```

---

## Task 8: Update robots.ts

**Files:**
- Modify: `web/app/robots.ts`

- [ ] **Step 1: Add social/ad intelligence to allow list**

In `web/app/robots.ts`, add `/social-intelligence` and `/ad-intelligence` to the allow array, and also add `/categories/`, `/meta-trends/`, `/sources/`:

```typescript
allow: ["/", "/explore", "/trends/", "/pricing", "/categories/", "/meta-trends/", "/sources/", "/social-intelligence", "/ad-intelligence"],
```

- [ ] **Step 2: Commit**

```bash
git add web/app/robots.ts
git commit -m "feat: add new crawlable paths to robots.txt allow list"
```

---

## Task 9: Middleware — Ungate Social/Ad Intelligence

**Files:**
- Modify: `web/middleware.ts:4`

- [ ] **Step 1: Remove social/ad intelligence from PROTECTED_ROUTES**

In `web/middleware.ts`, change line 4 from:

```typescript
const PROTECTED_ROUTES = ["/ad-intelligence", "/social-intelligence", "/admin"];
```

to:

```typescript
const PROTECTED_ROUTES = ["/admin"];
```

- [ ] **Step 2: Verify middleware still protects /admin**

Run: `cd web && npm run build 2>&1 | tail -20`
Expected: Build succeeds, middleware still configured.

- [ ] **Step 3: Commit**

```bash
git add web/middleware.ts
git commit -m "feat: ungate social/ad intelligence routes for public teaser access"
```

---

## Task 10: Social Intelligence Teaser Page

**Files:**
- Modify: `web/app/social-intelligence/page.tsx`
- Modify: `web/components/social-intelligence-dashboard.tsx`

- [ ] **Step 1: Update the page.tsx to render a server-side teaser**

The social intelligence page currently wraps `SocialIntelligenceDashboard` in Suspense. Transform it to render a server-side teaser for unauthenticated/free users and conditionally load the client dashboard for Pro users.

```tsx
// web/app/social-intelligence/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { SocialIntelligenceDashboard } from "@/components/social-intelligence-dashboard";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Social Intelligence",
  description:
    "Real-time trend signals from Reddit, X, Hacker News & more. Track trending topics, breaking news from curated accounts, and hashtag tracking across 10+ countries.",
  alternates: { canonical: `${SITE_URL}/social-intelligence` },
  openGraph: {
    title: "Social Intelligence — Signal Eye",
    description:
      "Real-time trend signals from Reddit, X, Hacker News & more.",
  },
  twitter: { card: "summary_large_image" },
};

const FAKE_HASHTAGS = ["#AIAgents", "#QuantumComputing", "#RemoteWork", "#DeFi", "#CleanEnergy"];
const FAKE_TOPICS = [
  { name: "AI Code Assistants", category: "Technology", location: "Worldwide", volume: "142K" },
  { name: "Nuclear Fusion Breakthrough", category: "Science", location: "United States", volume: "89K" },
  { name: "Decentralized Social", category: "Crypto", location: "Worldwide", volume: "67K" },
  { name: "Lab-Grown Meat Approval", category: "Health", location: "Europe", volume: "54K" },
  { name: "Rust Programming Language", category: "Developer Tools", location: "Worldwide", volume: "41K" },
];

export default function SocialIntelligencePage() {
  const jsonLd = buildCollectionPageJsonLd({
    name: "Social Intelligence",
    description: "Real-time trend signals from social platforms",
    url: `${SITE_URL}/social-intelligence`,
    numberOfItems: 5,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      {/* Server-rendered teaser — visible to crawlers and unauthenticated users */}
      <div className="social-intel-wrap social-intel-teaser">
        <div className="social-intel-header">
          <h1>Social Intelligence</h1>
          <p>Real-time trending topics and breaking news from curated X accounts across 10+ countries.</p>
        </div>

        {/* Top 5 real-looking but fake topics */}
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Trending Now</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {FAKE_HASHTAGS.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "8px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Topic</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Category</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Location</th>
                <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid var(--border)" }}>Volume</th>
              </tr>
            </thead>
            <tbody>
              {FAKE_TOPICS.map((topic) => (
                <tr key={topic.name}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{topic.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{topic.category}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{topic.location}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "monospace" }}>{topic.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Blurred fake rows + CTA */}
        <div className="adi-gate" style={{ marginTop: 24 }}>
          <div className="adi-gate-inner">
            <div className="adi-gate-badge">PRO</div>
            <p className="adi-gate-copy">
              Unlock real-time social intelligence — trending topics, breaking news, and hashtag tracking across 10+ countries.
            </p>
            <a href="/pricing" className="adi-gate-cta">Upgrade to Pro</a>
          </div>
        </div>
      </div>

      {/* Client dashboard replaces teaser for Pro users */}
      <Suspense>
        <SocialIntelligenceDashboard />
      </Suspense>
    </>
  );
}
```

- [ ] **Step 2: Update the client dashboard to hide teaser when Pro**

In `web/components/social-intelligence-dashboard.tsx`, modify the component to:
1. Remove the `router.replace` redirect for non-Pro users (middleware no longer blocks)
2. Remove the `ProGate` rendering (page.tsx handles it)
3. Return `null` when user is not Pro (teaser from page.tsx shows instead)
4. When Pro and loaded, hide the server teaser via a wrapper class

Update the `SocialIntelligenceDashboard` component:

```tsx
export function SocialIntelligenceDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isPro, loading: profileLoading } = useProfile();
  const isScreenshot = useScreenshotMode();
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[] | null>(null);
  const [breakingFeed, setBreakingFeed] = useState<BreakingFeed | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const shouldShow = isScreenshot || (isPro && !authLoading && !profileLoading);

  useEffect(() => {
    if (!shouldShow) { setLoading(false); return; }
    Promise.all([
      fetch("/api/trends/hashtags").then((r) => r.ok ? r.json() : null),
      fetch("/api/breaking").then((r) => r.ok ? r.json() : null),
    ])
      .then(([hashtagData, feedData]) => {
        setTrendingTopics(hashtagData?.trends ?? []);
        setBreakingFeed(feedData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shouldShow]);

  // Not Pro — let the server-rendered teaser show
  if (!shouldShow) return null;
  if (loading) return <Skeleton />;

  // Pro user — hide the server teaser and show full dashboard
  return (
    <>
      <style>{`.social-intel-teaser { display: none !important; }`}</style>
      <div className="social-intel-wrap">
        <div className="social-intel-header">
          <h1>Social Intelligence</h1>
          <p>Real-time trending topics and breaking news from curated X accounts.</p>
        </div>
        <SocialGeoMap
          trends={trendingTopics ?? []}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
        />
        <TrendingCarousel trends={trendingTopics} selectedLocation={selectedLocation} />
        <BreakingFeedSection feed={breakingFeed} />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/app/social-intelligence/page.tsx web/components/social-intelligence-dashboard.tsx
git commit -m "feat: social intelligence teaser page with server-rendered fake data for SEO"
```

---

## Task 11: Ad Intelligence Teaser Page

**Files:**
- Modify: `web/app/ad-intelligence/page.tsx`
- Modify: `web/components/ad-intelligence-dashboard.tsx`

- [ ] **Step 1: Update the page.tsx to render a server-side teaser**

Same pattern as Task 10. The ad intelligence dashboard already has a `ProGate` with fake table data — we replicate that pattern server-side.

```tsx
// web/app/ad-intelligence/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdIntelligenceDashboard } from "@/components/ad-intelligence-dashboard";
import { JsonLd, buildCollectionPageJsonLd } from "@/components/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Ad Intelligence",
  description:
    "Track what brands are spending on across emerging trend categories. Keyword CPC data, advertiser breakdowns, and cross-platform ad activity from Google, Meta, TikTok, and YouTube.",
  alternates: { canonical: `${SITE_URL}/ad-intelligence` },
  openGraph: {
    title: "Ad Intelligence — Signal Eye",
    description:
      "Track what brands are spending on across emerging trend categories.",
  },
  twitter: { card: "summary_large_image" },
};

const FAKE_KEYWORDS = [
  { keyword: "AI automation tools", cpc: "$4.82", volume: "201K", competition: "HIGH" },
  { keyword: "cloud security platform", cpc: "$7.15", volume: "156K", competition: "HIGH" },
  { keyword: "low-code development", cpc: "$3.40", volume: "134K", competition: "MEDIUM" },
  { keyword: "remote team management", cpc: "$2.95", volume: "98K", competition: "MEDIUM" },
  { keyword: "sustainable packaging", cpc: "$1.80", volume: "72K", competition: "LOW" },
];

export default function AdIntelligencePage() {
  const jsonLd = buildCollectionPageJsonLd({
    name: "Ad Intelligence",
    description: "Cross-platform advertising data across emerging trends",
    url: `${SITE_URL}/ad-intelligence`,
    numberOfItems: 5,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      {/* Server-rendered teaser */}
      <div className="adi-wrap adi-teaser">
        <div className="adi-header">
          <h1>Ad Intelligence</h1>
          <p>Cross-platform ad spend, keyword CPC data, and advertiser breakdowns across emerging trends.</p>
        </div>

        <section className="adi-section" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Top Keywords</h2>
          <table className="adi-table">
            <thead>
              <tr>
                <th className="adi-th adi-th-left">Keyword</th>
                <th className="adi-th adi-th-right">CPC</th>
                <th className="adi-th adi-th-right">Volume</th>
                <th className="adi-th adi-th-left">Competition</th>
              </tr>
            </thead>
            <tbody>
              {FAKE_KEYWORDS.map((kw) => (
                <tr key={kw.keyword} className="adi-row">
                  <td className="adi-td">{kw.keyword}</td>
                  <td className="adi-td adi-td-right adi-td-mono">{kw.cpc}</td>
                  <td className="adi-td adi-td-right adi-td-mono">{kw.volume}</td>
                  <td className="adi-td">{kw.competition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Blurred fake rows + CTA */}
        <div className="adi-gate" style={{ marginTop: 24 }}>
          <div className="adi-gate-inner">
            <div className="adi-gate-badge">PRO</div>
            <p className="adi-gate-copy">
              Unlock full ad intelligence — keyword CPC data, advertiser breakdowns, and cross-platform ad activity.
            </p>
            <a href="/pricing" className="adi-gate-cta">Upgrade to Pro</a>
          </div>
        </div>
      </div>

      {/* Client dashboard replaces teaser for Pro users */}
      <Suspense>
        <AdIntelligenceDashboard />
      </Suspense>
    </>
  );
}
```

- [ ] **Step 2: Update the client dashboard**

In `web/components/ad-intelligence-dashboard.tsx`, same pattern as social intelligence:
1. Remove `router.replace` redirect
2. Remove `ProGate` rendering
3. Return `null` when not Pro
4. Hide server teaser when Pro

```tsx
export function AdIntelligenceDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isPro, loading: profileLoading } = useProfile();
  const isScreenshot = useScreenshotMode();
  const [data, setData] = useState<AdIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const shouldShow = isScreenshot || (isPro && !authLoading && !profileLoading);

  useEffect(() => {
    if (!shouldShow) { setLoading(false); return; }
    fetch("/api/ad-intelligence")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shouldShow]);

  if (!shouldShow) return null;
  if (loading) return <Skeleton />;

  if (!data) {
    return (
      <div className="adi-wrap">
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>
          No ad intelligence data available yet.
        </p>
      </div>
    );
  }

  // Pro user — hide server teaser, show full dashboard
  const totalAds = data.platformSummary.reduce((s, p) => s + p.adCount, 0);
  // ... rest of existing render logic unchanged

  return (
    <>
      <style>{`.adi-teaser { display: none !important; }`}</style>
      {/* existing full dashboard JSX unchanged */}
    </>
  );
}
```

> **Important:** Keep all the existing dashboard rendering logic (`totalAds`, `hasCpc`, stat cards, keyword table, advertiser table, platform summary). Only wrap the return in a fragment with the teaser-hiding style, and remove the ProGate/redirect logic.

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/app/ad-intelligence/page.tsx web/components/ad-intelligence-dashboard.tsx
git commit -m "feat: ad intelligence teaser page with server-rendered fake data for SEO"
```

---

## Task 12: Internal Cross-Links

**Files:**
- Modify: `web/app/categories/[slug]/page.tsx`
- Modify: `web/app/meta-trends/[slug]/page.tsx`
- Modify: `web/app/trends/[slug]/page.tsx`

- [ ] **Step 1: Add cross-links on category slug pages**

In `web/app/categories/[slug]/page.tsx`, after the existing trend grid, add links to relevant meta-trends. The `group.trends` array contains `TrendDetailRecord` objects which have a `metaTrend` field.

```tsx
// After the trend grid, add meta-trend links:
const relatedMetaTrends = [...new Set(group.trends.map((t) => t.metaTrend).filter(Boolean))];

// In JSX, after the trends grid:
{relatedMetaTrends.length > 0 && (
  <section style={{ marginTop: 32 }}>
    <h2 style={{ fontSize: 16, marginBottom: 12 }}>Related Meta-Trends</h2>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {relatedMetaTrends.map((mt) => (
        <Link
          key={mt}
          href={`/meta-trends/${slugifyBrowseValue(mt)}`}
          style={{
            padding: "6px 14px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
            textDecoration: "none",
            color: "var(--foreground)",
          }}
        >
          {mt}
        </Link>
      ))}
    </div>
  </section>
)}
```

Import `Link` from `next/link` if not already imported.

- [ ] **Step 2: Add cross-links on meta-trend slug pages**

In `web/app/meta-trends/[slug]/page.tsx`, add links to categories that the trends in this meta-trend belong to:

```tsx
const relatedCategories = [...new Set(group.trends.map((t) => t.category).filter(Boolean))];

// In JSX:
{relatedCategories.length > 0 && (
  <section style={{ marginTop: 32 }}>
    <h2 style={{ fontSize: 16, marginBottom: 12 }}>Categories</h2>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {relatedCategories.map((cat) => (
        <Link
          key={cat}
          href={`/categories/${slugifyBrowseValue(cat)}`}
          style={{
            padding: "6px 14px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
            textDecoration: "none",
            color: "var(--foreground)",
          }}
        >
          {cat}
        </Link>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 3: Ensure trend detail page links to category and meta-trend**

In `web/app/trends/[slug]/page.tsx`, verify that the existing category and meta-trend pills are rendered as `<Link>` elements pointing to `/categories/[slug]` and `/meta-trends/[slug]`. If they are currently plain `<span>` elements, convert them to links:

```tsx
// Check the hero pills section — if category pill is a span, make it a link:
<Link href={`/categories/${slugifyBrowseValue(trend.category)}`}>
  {trend.category}
</Link>

// Same for metaTrend:
<Link href={`/meta-trends/${slugifyBrowseValue(trend.metaTrend)}`}>
  {trend.metaTrend}
</Link>
```

Also ensure the existing related/adjacent trends section renders trend names as `<Link>` elements to `/trends/[id]`.

- [ ] **Step 4: Verify build and test navigation**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/app/categories/\[slug\]/page.tsx web/app/meta-trends/\[slug\]/page.tsx web/app/trends/\[slug\]/page.tsx
git commit -m "feat: add internal cross-links between categories, meta-trends, and trends"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run all existing tests**

Run: `cd web && node --import tsx --test tests/**/*.test.ts`
Expected: All tests pass. No regressions.

- [ ] **Step 2: Run the new tests**

Run: `cd web && node --import tsx --test tests/json-ld.test.ts tests/seo-metadata.test.ts`
Expected: All pass.

- [ ] **Step 3: Build and check output**

Run: `cd web && npm run build 2>&1 | grep -E "(○|●|λ|ƒ)" | head -30`

Verify:
- `/categories` shows as ISR (○ or ●), not λ (dynamic)
- `/categories/[slug]` shows as ISR
- `/meta-trends` shows as ISR
- `/meta-trends/[slug]` shows as ISR
- `/sources/[source]` shows as ISR
- `/social-intelligence` shows as ISR
- `/ad-intelligence` shows as ISR

- [ ] **Step 4: Spot-check JSON-LD in rendered HTML**

Run: `cd web && npm run build && npm start &` then:

```bash
curl -s http://localhost:3000/categories | grep "application/ld+json"
curl -s http://localhost:3000/social-intelligence | grep "application/ld+json"
curl -s http://localhost:3000/social-intelligence | grep "adi-gate-cta"
```

Expected: JSON-LD script tags present. CTA button present on social intelligence page.

- [ ] **Step 5: Commit any final fixes**

If any issues found, fix and commit.

- [ ] **Step 6: Final commit with all changes verified**

```bash
git log --oneline -15
```

Verify all commits from this implementation are present and make sense.
