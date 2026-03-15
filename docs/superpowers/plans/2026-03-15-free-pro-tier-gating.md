# Free/Pro Tier Gating Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the free/pro feature split with teaser-style paywalls, a public pricing page, and backend gating on alerts.

**Architecture:** A reusable `<ProGate>` React component wraps pro-only UI elements, showing a lock overlay and upgrade modal when the user isn't subscribed. A `/pricing` page provides the public comparison. Backend adds `require_pro` to alert endpoints. The billing page is updated to match the canonical feature list.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase Auth, Stripe, FastAPI

**Spec:** `docs/superpowers/specs/2026-03-15-free-pro-tier-gating-design.md`

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `web/components/pro-gate.tsx` | Reusable `<ProGate>` component — checks tier, renders lock overlay + upgrade modal |
| `web/app/pricing/page.tsx` | Public pricing page with Free vs Pro comparison and Upgrade CTA |

### Modified files

| File | Change |
|---|---|
| `web/app/billing/page.tsx` | Update `PRO_FEATURES` list to match canonical feature matrix |
| `web/app/ad-intelligence/page.tsx` | Add page-level pro gate (locked state for non-Pro users) |
| `web/components/dashboard-shell.tsx:2091-2101` | Wrap CSV export button with `<ProGate>` |
| `app/api/routers/alerts.py:26,60,74,99` | Change `require_auth` → `require_pro` on alert endpoints |
| `web/middleware.ts:4` | Remove `/ad-intelligence` from PROTECTED_ROUTES (page handles its own gating now) |

---

## Chunk 1: ProGate Component, Pricing Page, and Integration

### Task 1: ProGate component

**Files:**
- Create: `web/components/pro-gate.tsx`

- [ ] **Step 1: Create the ProGate component**

```tsx
// web/components/pro-gate.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isPro, type BillingStatus } from "@/lib/subscription";

type ProGateProps = {
  feature: string;
  description: string;
  children: React.ReactNode;
};

export function ProGate({ feature, description, children }: ProGateProps) {
  const { user } = useAuth();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Check billing status once on first render
  if (user && !checked) {
    setChecked(true);
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      fetch(`${apiBase}/api/v1/billing/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((status) => {
          if (status) setBillingStatus(status);
        })
        .catch(() => {});
    });
  }

  const userIsPro = isPro(billingStatus);

  if (userIsPro) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className="pro-gate-wrapper"
        onClick={() => setShowModal(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setShowModal(true);
        }}
        role="button"
        tabIndex={0}
        title={`${feature} — Pro feature`}
      >
        <div className="pro-gate-locked">{children}</div>
        <div className="pro-gate-badge">Pro</div>
      </div>

      {showModal && (
        <div
          className="pro-gate-overlay"
          onClick={() => setShowModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Upgrade to unlock ${feature}`}
        >
          <div className="pro-gate-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="pro-gate-close"
              onClick={() => setShowModal(false)}
              aria-label="Close"
              type="button"
            >
              &times;
            </button>
            <h3>{feature}</h3>
            <p>{description}</p>
            <p className="pro-gate-price">$5.99/month</p>
            <Link href="/pricing" className="auth-submit-button">
              View plans
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/pro-gate.tsx
git commit -m "feat: add ProGate component for tier-gated features"
```

---

### Task 2: Pricing page

**Files:**
- Create: `web/app/pricing/page.tsx`

- [ ] **Step 1: Create the pricing page**

```tsx
// web/app/pricing/page.tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

const FREE_FEATURES = [
  { name: "Trend dashboard (all trends, scores, rankings)", included: true },
  { name: "Trend detail pages", included: true },
  { name: "Breaking news feed", included: true },
  { name: "Source health monitoring", included: true },
  { name: "Ad intelligence", included: false },
  { name: "Email alerts on emerging topics", included: false },
  { name: "CSV export", included: false },
  { name: "Watchlists", included: false },
];

const PRO_FEATURES = FREE_FEATURES.map((f) => ({ ...f, included: true }));

export default function PricingPage() {
  const { user } = useAuth();

  const upgradePath = user ? "/billing" : "/login?next=/billing";

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">Pricing</p>
          <h1>Unlock the full power of Signal Eye</h1>
          <p className="detail-copy">
            The core dashboard is free forever. Upgrade to Pro for actionable
            intelligence tools.
          </p>
        </div>
      </section>

      <section className="detail-panel settings-panel">
        <div className="settings-grid">
          <article className="settings-card">
            <header>
              <p className="eyebrow">Free</p>
              <h2>$0</h2>
              <p className="detail-copy">Forever</p>
            </header>
            <div className="settings-card-body">
              <ul className="billing-feature-list">
                {FREE_FEATURES.map((f) => (
                  <li key={f.name} className="billing-feature-item">
                    <span className="billing-feature-check" aria-hidden="true">
                      {f.included ? "\u2713" : "\u2014"}
                    </span>
                    {f.name}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="settings-card pricing-card-pro">
            <header>
              <p className="eyebrow">Pro</p>
              <h2>$5.99</h2>
              <p className="detail-copy">per month</p>
            </header>
            <div className="settings-card-body">
              <ul className="billing-feature-list">
                {PRO_FEATURES.map((f) => (
                  <li key={f.name} className="billing-feature-item">
                    <span className="billing-feature-check" aria-hidden="true">
                      {f.included ? "\u2713" : "\u2014"}
                    </span>
                    {f.name}
                  </li>
                ))}
              </ul>
              <Link href={upgradePath} className="auth-submit-button">
                Upgrade to Pro
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/pricing/page.tsx
git commit -m "feat: add public pricing page with Free vs Pro comparison"
```

---

### Task 3: Update billing page feature list

**Files:**
- Modify: `web/app/billing/page.tsx:28-35`

- [ ] **Step 1: Update PRO_FEATURES**

Replace lines 28-35 in `web/app/billing/page.tsx`:

```typescript
const PRO_FEATURES = [
  "Ad intelligence",
  "Email alerts on emerging topics",
  "Export to CSV",
  "Watchlists",
];
```

- [ ] **Step 2: Commit**

```bash
git add web/app/billing/page.tsx
git commit -m "fix: update billing page Pro features to match canonical list"
```

---

### Task 4: Wrap CSV export with ProGate

**Files:**
- Modify: `web/components/dashboard-shell.tsx:2091-2101`

- [ ] **Step 1: Add ProGate import**

Add to the imports at the top of `web/components/dashboard-shell.tsx`:
```typescript
import { ProGate } from "@/components/pro-gate";
```

- [ ] **Step 2: Wrap the CSV export button**

Replace the CSV export `<a>` element (around lines 2091-2101) with:

```tsx
<ProGate feature="CSV Export" description="Export trend data to spreadsheets for deeper analysis.">
  <a
    className="mini-action-button export-button"
    href={exportHref}
    download="signal-eye-export.csv"
    onClick={(e) => {
      e.preventDefault();
      window.location.href = exportHref;
    }}
  >
    Export CSV
  </a>
</ProGate>
```

- [ ] **Step 3: Commit**

```bash
git add web/components/dashboard-shell.tsx
git commit -m "feat: gate CSV export behind ProGate"
```

---

### Task 5: Gate ad intelligence page

**Files:**
- Modify: `web/app/ad-intelligence/page.tsx`
- Modify: `web/middleware.ts:4`

- [ ] **Step 1: Update ad-intelligence page to handle its own gating**

Replace `web/app/ad-intelligence/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isPro, type BillingStatus } from "@/lib/subscription";
import { AdIntelligenceDashboard } from "@/components/ad-intelligence-dashboard";

export default function AdIntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
        const res = await fetch(`${apiBase}/api/v1/billing/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setBillingStatus(await res.json());
      } catch {}
      setLoading(false);
    };
    load();
  }, [user, authLoading]);

  if (loading || authLoading) return null;

  if (isPro(billingStatus)) {
    return <AdIntelligenceDashboard />;
  }

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">Pro Feature</p>
          <h1>Ad Intelligence</h1>
          <p className="detail-copy">
            See what your competitors are spending on ads, which keywords they
            target, and where their budget goes. Upgrade to Pro to unlock.
          </p>
          <Link href="/pricing" className="auth-submit-button">
            View plans
          </Link>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Remove /ad-intelligence from middleware PROTECTED_ROUTES**

In `web/middleware.ts`, change line 4:
```typescript
const PROTECTED_ROUTES = ["/billing", "/ad-intelligence"];
```
to:
```typescript
const PROTECTED_ROUTES = ["/billing"];
```

The ad-intelligence page now handles its own gating — unauthenticated users see the locked state instead of being redirected to login.

- [ ] **Step 3: Commit**

```bash
git add web/app/ad-intelligence/page.tsx web/middleware.ts
git commit -m "feat: add page-level pro gate to ad intelligence, remove middleware redirect"
```

---

### Task 6: Backend — gate alerts behind require_pro

**Files:**
- Modify: `app/api/routers/alerts.py:10,26,60,74,99`

- [ ] **Step 1: Update the import**

In `app/api/routers/alerts.py`, change line 10:
```python
from app.auth.middleware import auth_enabled, require_auth
```
to:
```python
from app.auth.middleware import auth_enabled, require_auth, require_pro
```

- [ ] **Step 2: Change require_auth to require_pro on alert endpoints**

Replace `require_auth` with `require_pro` on these lines:
- Line 26: `user: User = Depends(require_pro),` (list alerts)
- Line 60: `user: User = Depends(require_pro),` (mark alerts read)
- Line 74: `def list_alert_rules(user: User = Depends(require_pro), ...` (list rules)
- Line 99: `user: User = Depends(require_pro),` (create alert rule)

Note: `require_pro` returns a `UserProfile` not `User`. Check the type annotation — you may need to update the type hint from `User` to `UserProfile` and import it. Read `app/auth/middleware.py` to check the return type of `require_pro`.

- [ ] **Step 3: Run Python tests**

Run: `python3 -m unittest tests.test_alerts -v`
Expected: Tests pass (or skip if they mock auth)

- [ ] **Step 4: Commit**

```bash
git add app/api/routers/alerts.py
git commit -m "feat: gate alert endpoints behind require_pro"
```

---

### Task 7: Build and integration test

- [ ] **Step 1: Build frontend**

Run: `cd web && npx next build`
Expected: Build succeeds

- [ ] **Step 2: Run Python tests**

Run: `python3 -m unittest discover -s tests`
Expected: All tests pass (minus pre-existing enrichment failures)

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve integration issues from tier gating"
```
