# Changelog

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
