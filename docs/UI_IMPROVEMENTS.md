# UI Improvements — Navigation & Visual Polish

Summary of all changes made to bring consistency and polish to the signal-eye web dashboard.

---

## 1. CSS Design Tokens & Radius Scale

**File:** `web/app/globals.css`

Added five new custom properties to `:root`:

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `10px` | Stat cards, inputs, explorer cards, snapshot cards, select items, community rail items, curated items, watchlist items |
| `--radius-md` | `16px` | Hero panel, ranking panel, history panel, analytics cards, shared hero, source metric cards, community controls, source run charts, error banners, score columns |
| `--radius-lg` | `24px` | Detail hero, detail panels, community hero, trend cards, empty states |
| `--radius-pill` | `999px` | Pills, badges, buttons with fully rounded ends |
| `--card-gradient` | `linear-gradient(180deg, ...)` | Shared gradient for card backgrounds |

All hardcoded `border-radius` values throughout the file were replaced with the appropriate token.

### Global polish

- `html { scroll-behavior: smooth; }` — smooth anchor scrolling
- `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` — consistent keyboard focus ring

---

## 2. Transitions & Hover Effects

### Card hover (lift + glow)

Applied to: `.explorer-card`, `.community-card`, `.community-rail-item`, `.shared-item-card`, `.trend-card`

```css
transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
/* :hover */
border-color: rgba(124, 157, 216, 0.32);
transform: translateY(-1px);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
```

### Card hover (border only)

Applied to: `.stat-card`, `.snapshot-card`

```css
transition: border-color 180ms ease;
/* :hover */
border-color: rgba(124, 157, 216, 0.32);
```

### Button & toggle transitions

Applied to: `.watch-toggle`, `.mini-action-button`, `.community-filter-chip`

```css
transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
```

### Link transitions

Applied to: `.trend-link`, `.detail-back-link`

```css
transition: color 140ms ease;
```

### Input focus transitions

Applied to: `.text-input`, `.select-trigger`, `.number-group`

```css
transition: border-color 140ms ease;
/* :focus / :focus-within */
border-color: var(--accent);
```

---

## 3. Persistent Nav Bar

### New component: `web/components/nav-bar.tsx`

Client component using `usePathname()` from `next/navigation`.

**Structure:**
- Left: "Signal Eye" brand link to `/`
- Right: "Explorer" (`/`) and "Community" (`/community`) links
- Active state detection: Explorer is active for `/`, `/trends/*`, `/sources/*`; Community is active for `/community*`

**Props:** None (reads route from Next.js)

**Styles:** `.nav-bar`, `.nav-bar-brand`, `.nav-bar-links`, `.nav-bar-link`, `.nav-bar-link-active`

- Sticky positioning (`top: 0`, `z-index: 50`)
- 48px height
- Blurred glass background (`backdrop-filter: blur(18px)`)
- Bottom border separator

### Modified: `web/app/layout.tsx`

`<NavBar />` is rendered inside `<body>` before `{children}`, so it appears on every page.

---

## 4. Unified Back-Links

All "Back to dashboard" links now use the `.detail-back-link` class, which includes:

- `::before` pseudo-element with a left arrow (`\2190`) for a consistent visual cue
- Accent-strong color, 700 weight
- Smooth color transition on hover

### Changes:
- `web/app/community/page.tsx` — changed from `refresh-button shared-back-link` to `detail-back-link`
- `web/app/shared/[token]/page.tsx` — both instances changed from `refresh-button shared-back-link` to `detail-back-link`
- Removed the `.shared-back-link` CSS class (no longer needed)
- Consolidated the duplicate `.detail-back-link` declaration into one rule

---

## 5. Sidebar Collapsible Sections

### Modified: `web/components/dashboard-shell.tsx`

Four sidebar sections wrapped in `<details>/<summary>` elements:

| Section | Default state |
|---------|---------------|
| Watchlists + Identity + Sharing | Always visible (not collapsible) |
| Alerts | `open` when `alertCount > 0`, collapsed otherwise |
| Runs | Collapsed |
| Sources | Collapsed |
| Public watchlists | Collapsed |

### Styles: `.sidebar-section`

- Border-top separator between sections
- Custom summary marker (`+` / `−` indicator)
- Native `<details>` element — no JavaScript required for expand/collapse
