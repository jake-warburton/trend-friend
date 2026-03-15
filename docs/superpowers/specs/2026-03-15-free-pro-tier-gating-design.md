# Free/Pro Tier Gating Design

**Date:** 2026-03-15
**Status:** Approved

## Overview

Define the free vs Pro ($5.99/month) feature split, implement teaser-style paywalls for Pro features, and add a public pricing page. No account required for free features — auth only triggers when upgrading to Pro.

## Motivation

The core trend dashboard is the funnel — free users get hooked on trend data, then pay for actionable intelligence on top. The paywall should be visible (teaser style) so users see the value they're missing, but never block the core experience.

---

## Feature Matrix

| Feature | Free | Pro ($5.99/mo) |
|---|---|---|
| Trend dashboard (all trends, scores, rankings) | Yes | Yes |
| Trend detail pages | Yes | Yes |
| Breaking feed (Twitter) | Yes | Yes |
| Source health page | Yes | Yes |
| Ad intelligence | Teaser (locked) | Yes |
| Email alerts on emerging topics | Teaser (locked) | Yes |
| CSV export | Teaser (locked) | Yes |
| Watchlists | Teaser (locked) | Yes |

The existing `PRO_FEATURES` list in `web/app/billing/page.tsx` must be updated to match this matrix. The billing page currently advertises different features — replace with this canonical list.

---

## No Account Required for Free Features

The dashboard is fully public. No login wall. Users only encounter auth when they click a Pro feature — the upgrade modal prompts sign-up as part of the checkout flow.

This maximizes the funnel: anyone can browse, share links, and discover value. Accounts are only created when a user is ready to pay.

---

## Paywall UX Flow

When a free or unauthenticated user clicks a Pro feature:

1. **Upgrade modal appears** — shows feature name, one-line value proposition, "$5.99/month" price, and a single "View plans" button
2. **Button links to `/pricing`** — users always see the full comparison before paying
3. **`/pricing` page** — public page with Free vs Pro comparison table and an "Upgrade to Pro" CTA button
4. **Auth gate** — if not logged in, the CTA prompts Supabase sign-up/login first
5. **Stripe Checkout** — after auth, redirects to Stripe Checkout session for the Pro plan
6. **Return** — after payment, user returns to the app with Pro access active (existing webhook handles activation)

The flow is always: **modal → /pricing → auth (if needed) → Stripe → return**. There is no shortcut past the pricing page.

---

## Two Gating Patterns

### Feature-level gating (buttons/panels inside dashboard)

Used for: CSV export button, watchlist panel, alerts panel.

```
<ProGate feature="CSV Export" description="Export trend data to CSV for analysis">
  <CsvExportButton />
</ProGate>
```

- If user is Pro: renders children normally
- If user is free/unauthenticated: renders the child element with a lock icon overlay, visually dimmed
- On click when locked: shows the upgrade modal

### Page-level gating (entire pages)

Used for: Ad intelligence page (`web/app/ad-intelligence/`).

The page renders a locked state: the page heading and a brief description of what ad intelligence provides, with a prominent "Upgrade to Pro" CTA that links to `/pricing`. No blurred preview, no API calls — just a clear value proposition and upgrade path.

---

## Implementation

### New files

| File | Purpose |
|---|---|
| `web/app/pricing/page.tsx` | Public pricing page with Free vs Pro comparison table and Upgrade CTA |
| `web/components/pro-gate.tsx` | Reusable `<ProGate>` wrapper component — checks tier, shows upgrade modal if not Pro |

### Modified files

| File | Change |
|---|---|
| `web/components/dashboard-shell.tsx` | Wrap CSV export button with `<ProGate>`. Watchlists are currently disabled (`WATCHLISTS_ENABLED = false`) — do NOT enable them in this work. The `<ProGate>` wrap will be added when watchlists are enabled separately. |
| `web/app/billing/page.tsx` | Update `PRO_FEATURES` list to match the canonical feature matrix. For free users, show the pricing comparison + upgrade CTA. For Pro users, show subscription management (manage/cancel via Stripe portal). |
| `web/app/ad-intelligence/page.tsx` | Add page-level gate: if not Pro, show locked state with value prop and upgrade CTA instead of rendering `<AdIntelligenceDashboard />` |
| `app/api/routers/alerts.py` | Add `require_pro` dependency to alert creation/management endpoints (currently ungated) |

### Backend changes

One backend change is needed: `app/api/routers/alerts.py` does not currently use `require_pro`. Alert creation and management endpoints must be gated. Alert evaluation (the background job) is unaffected — it processes existing alerts regardless of tier.

### Pricing page content

- Hero: "Unlock the full power of Signal Eye"
- Two-column comparison: Free vs Pro with checkmarks
- Pro column highlights: Ad intelligence, email alerts, CSV export, watchlists
- Single CTA button: "Upgrade to Pro — $5.99/month"
- No trial, no annual option (keep it simple for launch)

### Upgrade modal content

- Feature icon + name (e.g., "CSV Export")
- One-line value prop (e.g., "Export trend data to spreadsheets for deeper analysis")
- Price: "$5.99/month"
- Single button: "View plans" (goes to /pricing)

### Subscription cancellation

When a Pro user cancels (via Stripe portal), they retain access until the end of the billing period (existing `current_period_end` field handles this). After expiry:
- Watchlists and alerts remain in the database but become inaccessible (the `require_pro` backend gate returns 403)
- No data is deleted — if they re-subscribe, everything is restored
- The frontend shows Pro features as locked again (same teaser state as a free user)
