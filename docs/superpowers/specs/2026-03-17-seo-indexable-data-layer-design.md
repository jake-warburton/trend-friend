# SEO: Indexable Data Layer

**Date:** 2026-03-17
**Goal:** Maximize organic traffic → Pro conversions by making existing auto-refreshing content crawlable, structured, and conversion-optimized. Zero ongoing manual effort.

---

## 1. Make Existing Pages Crawlable

Switch category, meta-trend, and source pages from `force-dynamic` to ISR.

| Page | Current | Proposed |
|---|---|---|
| `/categories` | `force-dynamic` | ISR, `revalidate: 600` |
| `/categories/[slug]` | `force-dynamic` | ISR, `revalidate: 300` |
| `/meta-trends` | `force-dynamic` | ISR, `revalidate: 600` |
| `/meta-trends/[slug]` | `force-dynamic` | ISR, `revalidate: 300` |
| `/sources/[source]` | `force-dynamic` | ISR, `revalidate: 600` |
| `/community` | `force-dynamic` | stays dynamic (user-specific, not indexed) |
| `/compare` | `force-dynamic` | stays dynamic (user-specific, not indexed) |

### Metadata

Each page gets a `generateMetadata` function producing dynamic titles, descriptions, and OpenGraph/Twitter card metadata from live data:

- `/categories/artificial-intelligence` → *"Artificial Intelligence Trends — 47 emerging signals tracked across 12 sources | Signal Eye"*
- `/meta-trends/generative-ai` → *"Generative AI Meta-Trend — connecting 23 related trends with a combined momentum score of 91 | Signal Eye"*

OpenGraph and Twitter card metadata follow the same pattern as existing trend detail pages: dynamic title, description, and `summary_large_image` card type.

### `generateStaticParams`

Do NOT add `generateStaticParams` to these pages. On-demand ISR is acceptable — pages are cached after first visitor request. The sitemap ensures Google discovers all URLs regardless. This avoids coupling build time to data availability.

### Sitemap expansion

Add all category, meta-trend, and source pages to `sitemap.ts` with `changeFrequency: daily`, `priority: 0.8`.

**Slug enumeration:** The existing `loadTrendExplorer()` call in `sitemap.ts` returns trend data that includes category and source information. Extract unique category slugs and source identifiers from this data. For meta-trends, add a `loadMetaTrends()` call (or equivalent) to enumerate meta-trend slugs. If no server-side meta-trend loader exists, create a thin one that reads from the same data source as the meta-trends page.

### Indexing intent for remaining pages

`/community` and `/compare` remain `force-dynamic` and should NOT be added to the sitemap or robots.txt allow list. They are user-specific and not useful for search indexing.

---

## 2. JSON-LD Structured Data

A shared `JsonLd` React component (server component) renders `<script type="application/ld+json">`. Each page passes typed props.

### Trend detail pages (`/trends/[slug]`)

`Article` + `BreadcrumbList`:

```json
{
  "@type": "Article",
  "headline": "AI Agents — Trend Analysis",
  "description": "AI Agents is trending across 8 sources...",
  "dateModified": "2026-03-17T12:00:00Z",
  "author": { "@type": "Organization", "name": "Signal Eye" },
  "mainEntityOfPage": "https://www.signaleye.live/trends/ai-agents"
}
```

`dateModified` uses `new Date().toISOString()` at render time. Since ISR re-renders periodically, this naturally reflects content freshness without any special framework API.

### Category pages

`CollectionPage` + `BreadcrumbList`:

```json
{
  "@type": "CollectionPage",
  "name": "Artificial Intelligence Trends",
  "description": "47 emerging AI trends tracked across 12 sources",
  "numberOfItems": 47
}
```

### Meta-trend and source pages

Same `CollectionPage` pattern adapted to their data.

### Breadcrumbs

All hierarchical pages get `BreadcrumbList`:

```
Home → Categories → Artificial Intelligence → AI Agents
```

---

## 3. Teaser Pages for Gated Content

Convert `/social-intelligence` and `/ad-intelligence` from fully auth-gated to public teasers.

### Middleware change (critical)

Remove `/social-intelligence` and `/ad-intelligence` from the `PROTECTED_ROUTES` array in `web/middleware.ts`. Without this, unauthenticated users (including Googlebot) are 302-redirected to `/login` and never see the teaser.

### Component decomposition

Both dashboards (`SocialIntelligenceDashboard`, `AdIntelligenceDashboard`) are currently `"use client"` components that fetch all data via `useEffect` → `fetch("/api/...")`. This must be split:

1. **New server component (page.tsx):** Renders the teaser shell — page title, description metadata, top 5 results from server-side data, fake placeholder rows, and the CTA overlay. This is what Google indexes.
2. **Existing client component:** Loaded conditionally for Pro users. Fetches full data via authenticated API call and replaces the teaser content.

**Server-side data source for top 5:** Use the same data loading pattern as the explore page — call the existing JSON export or trend loader from the server component to get the top 5 items. No new API endpoint needed.

### Behavior by user type

| User | Experience |
|---|---|
| Unauthenticated / Free | Top 5 results rendered normally by server component. Remaining rows show **fake placeholder data** (randomized names, scores, source counts) behind a blurred overlay with CTA linking to `/pricing`. |
| Pro | Client component loads, fetches full data via authenticated API, replaces teaser with full dashboard. |

### Critical: fake data for blurred rows

Blurred rows must use **generated placeholder data**, not real data. Real Pro-only data loads exclusively via authenticated API calls client-side. There is nothing real to unblur via CSS inspection.

### Crawlability changes

- These paths are NOT currently in the `robots.ts` disallow list (they were blocked by middleware redirect). After the middleware change, add them explicitly to the `allow` list in `robots.ts` for clarity.
- Switch to ISR with `revalidate: 300`.
- Google sees and indexes the server-rendered teaser — identical to what unauthenticated visitors see.

### Metadata

- `/social-intelligence` → *"Social Intelligence — Real-time trend signals from Reddit, X, Hacker News & more | Signal Eye"*
- `/ad-intelligence` → *"Ad Intelligence — Track what brands are spending on across emerging trend categories | Signal Eye"*

Both get `CollectionPage` JSON-LD and OpenGraph/Twitter card metadata.

---

## 4. Canonical URLs & Domain Fix

### Problem

`metadataBase` in `layout.tsx` uses `SIGNAL_EYE_FRONTEND_URL` defaulting to `signaleye.live` (no www). `sitemap.ts` and `robots.ts` use `NEXT_PUBLIC_SITE_URL` defaulting to `www.signaleye.live`. This splits SEO authority.

### Fix

- Canonical domain: `www.signaleye.live`
- Update the fallback in `layout.tsx` `metadataBase` to `https://www.signaleye.live`
- Update the `SIGNAL_EYE_FRONTEND_URL` env var in Vercel production settings to `https://www.signaleye.live` (if currently set to the non-www variant)
- Add `alternates.canonical` to all dynamic pages:

```tsx
export async function generateMetadata({ params }) {
  return {
    alternates: {
      canonical: `https://www.signaleye.live/trends/${params.slug}`,
    },
  }
}
```

- Configure Vercel to redirect `signaleye.live` → `www.signaleye.live` (Vercel dashboard → Domains settings).

---

## 5. Internal Linking Mesh

### Cross-linking rules (programmatic from existing data relationships)

| Page | Links to |
|---|---|
| Trend detail | Parent category, related meta-trend(s), top source pages |
| Category | All child trends, relevant meta-trends that overlap with this category's trends |
| Meta-trend | All constituent trends and their categories |
| Source | Top trends from that source |
| Teaser pages | The 5 visible trends' detail pages |

### Clarifications on "related" links

- **Category → related categories:** NOT a direct data relationship. Instead, link to meta-trends that span multiple categories — this creates cross-category navigation without requiring a new "related categories" data model.
- **Trend → related meta-trend(s):** Trends already have meta-trend associations in the data. Render these as links.

### Related Trends section on trend detail pages

The existing trend detail page already has an adjacent/related trends area. Ensure it renders 3-5 trends from the same category or meta-trend as crawlable `<Link>` elements (not just visual cards without `href`).

All cross-links are standard Next.js `<Link>` elements rendered in existing components — making implicit data relationships into explicit crawlable HTML links.

---

## Out of Scope

- Blog or manual content creation
- Comparison / "[competitor] alternative" landing pages
- New pipeline jobs or data processing changes
- Scoring or data model changes
- Multi-language / hreflang support
