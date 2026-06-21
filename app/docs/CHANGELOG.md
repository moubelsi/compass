# Changelog

---

## 2026-06-21 — Project health fixes

### Fix: Delete trade now handles errors and only redirects on success

**Files changed**
- `app/(app)/trades/[id]/page.tsx`

**What changed**
- Added `deleting` and `deleteError` state
- `handleDelete` now checks the Supabase error response; only calls `router.push('/trades')` on success
- Delete button shows "Deleting…" while in flight and is disabled to prevent double-submit
- Error banner renders inline below the fixed nav bar if delete fails

**Why**
Previously the delete always redirected regardless of whether Supabase returned an error. A failed delete (network issue, RLS rejection) silently left the trade intact while making the user believe it was gone.

**New dependencies**
None

---

### Fix: Trades and dashboard now sort by trade date, not insertion time

**Files changed**
- `app/(app)/trades/page.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/analytics/page.tsx`

**What changed**
All three pages changed `.order('created_at', ...)` to `.order('trade_date', ...).order('created_at', ...)`. `trade_date` is the primary sort key with `created_at` as tiebreaker. Dashboard and analytics equity curve date labels now use `trade_date || created_at`. Dashboard "today's trades" filter now checks `trade_date` first.

**Why**
A trade logged today for last Tuesday appeared at the top of every list. `trade_date` is the actual date of the trade; `created_at` is when the row was inserted.

**New dependencies**
None

---

### Fix: Dashboard insights are now data-driven, not hardcoded

**Files changed**
- `app/(app)/dashboard/page.tsx`

**What changed**
Replaced two static `InsightCard` components ("You perform best during London session trades", "Planned trades account for 89% of your total profit") with a single card that computes a real insight from the user's actual trade data:
- 0 trades → "Log your first trade to unlock performance insights."
- Has trades, no `trade_type` logged → prompts user to add trade type
- Has trade type data → shows real planned vs impulsive win rate comparison

**Why**
The hardcoded text showed fake statistics regardless of the user's actual data, including for users with zero trades.

**New dependencies**
None

---

### Fix: Dashboard and analytics fetch only required columns

**Files changed**
- `app/(app)/dashboard/page.tsx`
- `app/(app)/analytics/page.tsx`

**What changed**
- Dashboard: `select('*')` → `select('id, symbol, direction, strategy, pnl, return_pct, created_at, trade_date, trade_type')`
- Analytics: `select('*')` → `select('id, symbol, pnl, rr, strategy, created_at, trade_date')`

**Why**
Both pages were fetching every column (including `notes`, `screenshot_url`, `stop_loss`, `take_profit`, etc.) for every trade. Only the listed columns are used in each view.

**New dependencies**
None

---

### Fix: Equity curve Y-axis readable for all P&L ranges

**Files changed**
- `components/charts/EquityCurve.tsx`

**What changed**
- Replaced `tickFormatter={v => \`$\${(v/1000).toFixed(0)}k\`}` with adaptive formatter: values under $1000 show as `$320`, values ≥ $1000 show as `$1.2k`
- Removed `MOCK_DATA` constant and default prop — component now requires `data: DataPoint[]` explicitly
- Added `if (!data.length) return null` guard
- Tooltip now shows sign (`+$320.00` / `-$50.00`) to match P&L convention
- YAxis `width` increased from 38 to 44 to accommodate negative labels

**Why**
The old formatter divided every value by 1000. For users with cumulative P&L under $1000 (all new users), every Y-axis tick rendered as `$0k`, making the chart axis completely unreadable.

**New dependencies**
None

---

### Fix: New trade — session guard and screenshot size validation

**Files changed**
- `app/(app)/trades/new/page.tsx`

**What changed**
Added two guards in `handleSave` before any Supabase operations:
1. If `supabase.auth.getUser()` returns null → shows "Session expired. Please sign in again." and aborts
2. If screenshot file exceeds 10MB → shows "Screenshot must be under 10MB." and aborts

**Why**
Without the session guard, a null `user.id` would be passed to the insert, potentially creating an orphaned trade. The file size limit was advisory UI text only — nothing enforced it.

**New dependencies**
None

---

### Chore: Deleted dead components

**Files deleted**
- `components/trades/RecentTrades.tsx`
- `components/LogoutButton.tsx`

**What changed**
Both files were never imported anywhere in the codebase. `RecentTrades.tsx` contained 5 hardcoded fake trades. `LogoutButton.tsx` contained Dutch text ("Uitloggen"), Tailwind classes with no effect in this design system, and a broken sign-out implementation that used `router.push` instead of `window.location.href` (would have failed to clear the cookie session).

**Why**
Dead code that would mislead any future development. `LogoutButton` in particular was actively harmful if re-imported — it would have appeared to work but left the user in a broken auth state.

**New dependencies**
None

---

### Chore: Created /settings page stub

**Files changed**
- `app/(app)/settings/page.tsx` (created)

**What changed**
Added a minimal stub page matching the design system. Displays "Coming soon" with a description. Resolves the 404 that occurred when clicking Settings in the sidebar nav.

**Why**
AppShell nav linked to `/settings` but no page existed, producing a 404 on every click.

**New dependencies**
None

---

### Chore: Removed deprecated @supabase/auth-helpers-nextjs

**Files changed**
- `package.json`
- `package-lock.json`

**What changed**
Ran `npm uninstall @supabase/auth-helpers-nextjs`. Package removed from dependencies.

**Why**
The package was officially deprecated in favour of `@supabase/ssr` (already in use). It was never imported anywhere in the codebase. Its presence in `package.json` created confusion about which auth package was authoritative.

**New dependencies**
None (one removed: `@supabase/auth-helpers-nextjs`)

---

## 2026-06-21 (continued)

### Fix: Login succeeded but user was not redirected to /dashboard

**Files changed**
- `lib/supabase.ts`

**What changed**
Replaced `createClient` from `@supabase/supabase-js` with `createBrowserClient` from `@supabase/ssr`. One import and one function call changed. The exported `supabase` constant and all call sites are otherwise identical.

```ts
// Before
import { createClient } from "@supabase/supabase-js"
export const supabase = createClient(URL, KEY)

// After
import { createBrowserClient } from "@supabase/ssr"
export const supabase = createBrowserClient(URL, KEY)
```

**Root cause**
A session storage mismatch between the client and the proxy:

| | Package | Session storage |
|---|---|---|
| `lib/supabase.ts` (before) | `@supabase/supabase-js` `createClient` | `localStorage` |
| `proxy.ts` | `@supabase/ssr` `createServerClient` | HTTP cookies |

`signInWithPassword` succeeded and wrote the session to `localStorage`. When `window.location.href = '/dashboard'` fired, `proxy.ts` intercepted the request, read cookies, found nothing, and immediately redirected back to `/login`. The user looped between `/login` and `/dashboard` invisibly.

`createBrowserClient` writes the session to cookies instead of `localStorage`. The proxy can now read it.

**Call sites verified — no changes required**
All 10 files importing `supabase` use standard methods (`auth.signInWithPassword`, `auth.signOut`, `auth.signUp`, `auth.getUser`, `from().select/insert/update/delete`, `storage.from().upload/getPublicUrl`) that have identical APIs on both clients.

**New dependencies**
None (`@supabase/ssr` was already installed)

---

## 2026-06-21

### Fix: Trades listing page was showing the new-trade form

**Files changed**
- `app/(app)/trades/page.tsx` — full rewrite

**What changed**
The file contained the new-trade form code (exported `NewTradePage`) instead of a trades list. Replaced with a proper trades listing page.

**What the new page includes**
- Fetches all trades from Supabase ordered by `created_at` desc
- Summary header: total trades, W/L count, all-time P&L
- Search by symbol or strategy
- Filter by direction (All / LONG / SHORT)
- Filter by result (All / Win / Loss)
- Table with columns: Symbol + direction badge + trade-type badge, Strategy, Date, Return %, P&L, R:R
- Hover state on rows
- Empty state with CTA when no trades exist
- "X of Y trades" count shown when filters are active

**Why it changed**
Critical bug — the Trades nav link was rendering the log-trade form instead of the trade history.

**New dependencies**
None

---

### Fix: Login page branding said "Edgefolio" instead of "Compass"

**Files changed**
- `app/login/page.tsx`

**What changed**
- Replaced `Activity` icon (lucide-react) with inline `CompassIcon` SVG (same as AppShell)
- Changed brand name from "Edgefolio" to "Compass"
- Removed `React.FormEvent` type annotation (deprecated in React 19); moved `preventDefault` to the `onSubmit` inline handler instead

**Why it changed**
Branding inconsistency — the app is named Compass everywhere else. `React.FormEvent` is deprecated in React 19.

**New dependencies**
None

---

### Fix: Signup page was empty

**Files changed**
- `app/signup/page.tsx` — built from scratch

**What changed**
The file existed but had no content. Built a full signup page matching the login page's design.

**What the new page includes**
- Compass logo + wordmark header (same CompassIcon as login/AppShell)
- Email + password inputs with validation (min 8 chars enforced client-side)
- Error banner for Supabase errors
- Post-submission confirmation state: shows "Check your email" with the submitted address
- Link back to `/login`
- `React.FormEvent` pattern avoided from the start (inline `onSubmit` handler)

**Why it changed**
Anyone clicking "Sign up" from the login page hit a blank page.

**New dependencies**
None

---

### Add: Auth route protection via proxy.ts

**Files changed**
- `proxy.ts` — new file at project root

**What changed**
Created `proxy.ts` (Next.js 16's Node.js-runtime route interceptor) to protect authenticated routes.

**Logic**
- Protected routes: `/dashboard`, `/trades`, `/analytics`, `/coach`, `/settings` (and all sub-paths)
- Public routes: `/login`, `/signup`
- Uses `@supabase/ssr` `createServerClient` with `next/headers` cookies to call `supabase.auth.getUser()`
- Unauthenticated request to a protected route → redirect to `/login`
- Authenticated request to a public route → redirect to `/dashboard`
- All other routes pass through unchanged

**Why it changed**
Unauthenticated users could access `/dashboard` and all app pages directly by typing the URL.

**New dependencies**
None (`@supabase/ssr` was already installed)

---

### Fix: Deleted middleware.ts — caused startup crash and slow page loads

**Files changed**
- `middleware.ts` — deleted

**What changed**
Deleted the obsolete `middleware.ts` file that had been left over from before `proxy.ts` was introduced.

**Why it was causing slow page loads**
Next.js 16 threw an `Unhandled Rejection: Error` on startup when both `middleware.ts` and `proxy.ts` existed simultaneously:

```
WARN  The "middleware" file convention is deprecated. Please use "proxy" instead.
ERROR Unhandled Rejection: Error: Both middleware file "./middleware.ts" and proxy
      file "./proxy.ts" are detected. Please use "./proxy.ts" only.
```

Every incoming request hit an unstable interceptor state, causing hangs and slow responses across the entire app.

**Why middleware.ts was safe to delete**
The file contained only a pass-through — no logic of any kind:
```ts
export async function middleware(req: NextRequest) {
  return NextResponse.next()
}
```
All auth protection is fully handled by `proxy.ts`. Deleting `middleware.ts` removed the conflict without losing any functionality.

**proxy.ts now sole interceptor — verified clean**
- Protected routes: `/dashboard`, `/trades`, `/analytics`, `/coach`, `/settings` and all sub-paths
- Public routes: `/login`, `/signup`
- All other routes (including `/`) pass through immediately with no auth overhead
- No redirect loops confirmed

**New dependencies**
None

---

### Chore: Deleted orphaned V0 route files

**Files deleted**
- `app/trade/[id]/page.tsx`
- `app/trade/[id]/edit/page.tsx`
- `app/trade/[id]/delete/page.tsx`
- `app/new-trade/page.tsx`

**What changed**
Removed four pages that were left over from the original V0 build. They served routes `/trade/:id`, `/trade/:id/edit`, `/trade/:id/delete`, and `/new-trade`.

**Why they were safe to delete**
- Zero references from any active file — confirmed by full codebase grep
- Only cross-referenced each other internally
- No sidebar/AppShell (outside the `(app)` route group)
- Dutch-language UI; black background — superseded by the current Compass design system
- `app/new-trade/` used a different storage bucket (`trade-screenshots`) than the current form (`screenshots`)
- All functionality fully replaced by routes inside `app/(app)/trades/`

**Why it changed**
Dead code. Keeping them created a risk of someone accidentally navigating to a broken, unstyled, unauthenticated version of the app.

**New dependencies**
None
