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
| `/community` | `force-dynamic` | stays dynamic (user-specific) |
| `/compare` | `force-dynamic` | stays dynamic (user-specific) |

Each page gets a `generateMetadata` function producing dynamic titles and descriptions from live data:

- `/categories/artificial-intelligence` → *"Artificial Intelligence Trends — 47 emerging signals tracked across 12 sources | Signal Eye"*
- `/meta-trends/generative-ai` → *"Generative AI Meta-Trend — connecting 23 related trends with a combined momentum score of 91 | Signal Eye"*

Add all new ISR pages to `sitemap.ts` with `changeFrequency: daily`, `priority: 0.8`.

---

## 2. JSON-LD Structured Data

A shared `JsonLd` React component renders `<script type="application/ld+json">`. Each page passes typed props.

### Trend detail pages (`/trends/[slug]`)

`Article` + `BreadcrumbList`:

```json
{
  "@type": "Article",
  "headline": "AI Agents — Trend Analysis",
  "description": "AI Agents is trending across 8 sources...",
  "dateModified": "<ISR revalidation timestamp>",
  "author": { "@type": "Organization", "name": "Signal Eye" },
  "mainEntityOfPage": "https://www.signaleye.live/trends/ai-agents"
}
```

`dateModified` updates with each revalidation — automatic freshness signal.

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

### Behavior by user type

| User | Experience |
|---|---|
| Unauthenticated / Free | Top 5 results rendered normally. Remaining rows show **fake placeholder data** (randomized names, scores, source counts) behind a blurred overlay with CTA linking to `/pricing`. |
| Pro | Full page, no change. |

### Critical: fake data for blurred rows

Blurred rows must use **generated placeholder data**, not real data. Real Pro-only data loads exclusively via authenticated API calls client-side. There is nothing real to unblur via CSS inspection.

### Crawlability changes

- Remove `/social-intelligence` and `/ad-intelligence` from `robots.ts` disallow list.
- Switch to ISR with `revalidate: 300`.
- Server component renders teaser HTML (top 5 real results + page metadata). Full data loads client-side for Pro users only.
- Google sees and indexes the teaser — same content as unauthenticated visitors.

### Metadata

- `/social-intelligence` → *"Social Intelligence — Real-time trend signals from Reddit, X, Hacker News & more | Signal Eye"*
- `/ad-intelligence` → *"Ad Intelligence — Track what brands are spending on across emerging trend categories | Signal Eye"*

Both get `CollectionPage` JSON-LD.

---

## 4. Canonical URLs & Domain Fix

### Problem

`metadataBase` in `layout.tsx` uses `signaleye.live` (no www). `sitemap.ts` and `robots.ts` use `www.signaleye.live`. This splits SEO authority.

### Fix

- Canonical domain: `www.signaleye.live`
- Update `metadataBase` in `layout.tsx` to default to `https://www.signaleye.live`
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

- Configure Vercel to redirect `signaleye.live` → `www.signaleye.live` (dashboard setting, not code).

---

## 5. Internal Linking Mesh

### Cross-linking rules (all programmatic from existing data relationships)

| Page | Links to |
|---|---|
| Trend detail | Parent category, related meta-trend(s), top source pages |
| Category | All child trends, related categories, relevant meta-trends |
| Meta-trend | All constituent trends and their categories |
| Source | Top trends from that source |
| Teaser pages | The 5 visible trends' detail pages |

### Related Trends section

Add a "Related Trends" section to trend detail pages showing 3-5 trends from the same category or meta-trend. Data already exists (same-category lookup), no new computation.

All links are standard `<Link>` elements in existing components — rendering data relationships that already exist as crawlable HTML links.

---

## Out of Scope

- Blog or manual content creation
- Comparison / "[competitor] alternative" landing pages
- New pipeline jobs or data processing changes
- Scoring or data model changes
- Multi-language / hreflang support
