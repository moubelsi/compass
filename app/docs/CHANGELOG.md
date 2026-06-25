# Changelog

---

## 2026-06-24 — Playbook, Journal, Tools, Hour analytics, Open trades, Weekly goal

### Feature: Playbook

**Files changed**
- `app/(app)/playbook/page.tsx` (new)
- `app/(app)/playbook/new/page.tsx` (new)
- `app/(app)/playbook/[id]/page.tsx` (new)
- `app/(app)/playbook/[id]/edit/page.tsx` (new)

**What changed**
- Full CRUD playbook: list, create, view, edit, delete setups
- Each setup has name, description, dynamic rules list, tags (TagInput), optional screenshot
- Detail page has interactive pre-trade checklist (local state, not persisted) with "All clear" badge when all rules checked
- Screenshot can be uploaded to Supabase storage, replaced, or removed on edit

**SQL required**
```sql
create table if not exists setups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text,
  rules text[] default '{}',
  tags text[] default '{}',
  screenshot_url text,
  created_at timestamptz default now()
);
alter table setups enable row level security;
create policy "Users manage own setups" on setups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### Feature: Daily Journal

**Files changed**
- `app/(app)/journal/page.tsx` (new)

**What changed**
- Date navigator (← →) to browse any past day, capped at today
- Mood selector: 5 emoji buttons (Rough → On fire), deselectable
- Free-text notes textarea, auto-saves via upsert on `journal_entries` table
- Shows trades summary for selected day (count, P&L, symbols) pulled from trades table
- Past entries list below (last 60, shows 2-line preview + mood emoji)

**SQL required**
```sql
create table if not exists journal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  entry_date date not null,
  content text default '',
  mood integer check (mood between 1 and 5),
  created_at timestamptz default now(),
  unique(user_id, entry_date)
);
alter table journal_entries enable row level security;
create policy "Users manage own journal" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### Feature: Tools — Position size calculator

**Files changed**
- `app/(app)/tools/page.tsx` (new)

**What changed**
- Asset type selector: Forex, Indices, Gold, Crypto (each with correct multiplier)
- Inputs: account size, risk % (range slider 0.1–5%), entry price, stop loss
- Real-time calculation: risk amount, distance (points), lot/contract size
- Plain-language summary sentence when result is available

---

### Feature: Hour-of-day analytics

**Files changed**
- `app/(app)/analytics/page.tsx`

**What changed**
- Computes P&L grouped by hour (from `created_at` timestamp)
- Full-width bar chart at bottom of charts grid, colored green/red per hour

---

### Feature: Open positions on dashboard

**Files changed**
- `app/(app)/dashboard/page.tsx`

**What changed**
- Fetches trades where `exit_price IS NULL` as open positions
- Shows open positions table: symbol, direction, entry price, date opened
- Closed trades query now filters `exit_price IS NOT NULL` so open trades don't skew equity curve / stats

---

### Feature: Weekly P&L goal on dashboard

**Files changed**
- `app/(app)/dashboard/page.tsx`

**What changed**
- Weekly goal stored in `localStorage` (no DB change)
- Inline edit: click "Set goal" / "Edit goal" → number input → save
- Progress bar shows week-to-date P&L vs goal, colored accent until reached then profit-green
- Sits alongside open positions in a 2-column row

---

### Navigation update

**Files changed**
- `components/layout/AppShell.tsx`

**What changed**
- Added Playbook (`BookMarked`), Journal (`PenLine`), Tools (`Calculator`) to desktop sidebar
- Mobile bottom nav updated to show: Dashboard, Trades, Playbook, Journal, Analytics

---

## 2026-06-24 — Analytics, Dashboard, Settings

### Feature: Calendar heatmap (Analytics)

**Files changed**
- `components/charts/CalendarHeatmap.tsx` (new)
- `app/(app)/analytics/page.tsx`

**What changed**
- New `CalendarHeatmap` component: 26-week grid (Mon–Sun columns), colour-coded by daily P&L intensity (green = profit, red = loss). Hover tooltip shows date, P&L, and trade count
- Added "Trading activity" section to analytics page between equity curve and strategy charts
- Fixed analytics select query to include `direction` column (was missing, causing Long vs Short table to show empty)

---

### Feature: Drawdown + Streak stats (Analytics)

**Files changed**
- `app/(app)/analytics/page.tsx`

**What changed**
- New stat row: Max drawdown (peak-to-trough %), Current streak (N W / N L), Best win streak, Total trades
- Current streak and best win streak computed from trade history

---

### Feature: Streak on Dashboard

**Files changed**
- `app/(app)/dashboard\page.tsx`

**What changed**
- Current win/loss streak shown as sub-text on the Discipline Score KPI card

---

### Feature: Export CSV + account stats (Settings)

**Files changed**
- `app/(app)/settings/page.tsx`

**What changed**
- Added account stats mini-grid: Total trades, Win rate, All-time P&L
- New "Export data" card: downloads all trades as UTF-8 CSV (with BOM for Excel compatibility), includes all columns — date, symbol, direction, strategy, entry/exit, P&L, return %, R:R, trade type, confidence, followed plan, notes, tags

**New dependencies:** none

---

## 2026-06-24 — Tags + Favourites on trades

### Feature: Tags on trades

**Files changed**
- `components/ui/TagInput.tsx` (new)
- `app/(app)/trades/page.tsx`
- `app/(app)/trades/[id]/page.tsx`
- `app/(app)/trades/[id]/edit/page.tsx`
- `app/(app)/trades/new/page.tsx`

**What changed**

Added a tags system and favourites toggle to the trades journal.

**Tags**
- New `TagInput` component: chip display of applied tags, text input (Enter/comma to add, Backspace to remove last), preset suggestions (A+ Setup, FOMO, Revenge, Breakout, etc.)
- Tags added to new trade form and edit trade form (Analysis card, below Notes)
- Tags displayed as small chips on each row in the trades list (below the symbol/direction badges)
- Tags shown in Setup details on the trade detail page
- Tag filter chips appear at the top of the trades list — click any tag to filter to only that tag

**Favourites**
- Star icon column added as the first column in the trades list; click to toggle (optimistic update)
- "Starred" filter button added to the filter row — shows only starred trades
- Star button in the trade detail page nav bar
- Star button in the edit trade page nav bar
- `is_favourite` persisted in the database and included in all save/update calls

**SQL required (run in Supabase before using these features)**
```sql
alter table trades add column if not exists tags text[] default '{}';
alter table trades add column if not exists is_favourite boolean default false;
```

**New dependencies:** none

---

## 2026-06-23 — PWA (installable app)

### Feature: Progressive Web App

**Files changed**
- `app/manifest.ts` (new)
- `app/icon.tsx` (new — auto-generates 32×32 favicon PNG)
- `app/apple-icon.tsx` (new — auto-generates 180×180 iOS PNG)
- `public/icon.svg` (new — compass icon for Android/Chrome manifest)
- `app/layout.tsx` (viewport export, PWA metadata, manifest link)

**What changed**

Added PWA support so the app can be installed directly from the browser on iOS and Android.

- `app/manifest.ts`: `start_url: /dashboard`, `display: standalone`, references SVG + PNG icons, `theme_color: #1A1A19`
- `app/icon.tsx`: generates favicon using `ImageResponse` — dark rounded square with white compass
- `app/apple-icon.tsx`: generates `apple-touch-icon.png` (180×180) using `ImageResponse` — used by iOS Safari "Add to Home Screen"
- `public/icon.svg`: static SVG used by Android/Chrome manifest (supported since Chrome 93)
- `app/layout.tsx`: added `viewport` export (width, initialScale 1, theme-color media variants); added `appleWebApp: { capable: true }` metadata

**How to install:**
- **iOS**: Open in Safari → Share → Add to Home Screen
- **Android**: Open in Chrome → menu (⋮) → Add to Home Screen / Install app
- **Desktop Chrome**: Click the install icon in the address bar

**New dependencies**
None (`ImageResponse` is built into Next.js)

---

## 2026-06-23 — Dark mode, trade detail fixes, new trade form fields

### Polish + fixes

**Files changed**
- `components/layout/AppShell.tsx`
- `app/globals.css`
- `app/(app)/trades/[id]/page.tsx`
- `app/(app)/trades/new/page.tsx`

**What changed**

**Dark mode toggle**: Added `useDarkMode` hook (reads `localStorage` + system preference on first visit). Toggle button (sun/moon icon) added to sidebar header on desktop and to the mobile top bar. Persisted to `localStorage`.

**Trade detail page — two fixes**:
- Fixed nav bar had `left: 240` hardcoded, breaking on mobile. Replaced with `.page-fixed-bar` CSS class (`left: var(--sidebar-width)`) with a mobile override (`left: 0; top: var(--header-height)`).
- Date was showing `created_at` instead of `trade_date`. Fixed to use `trade_date + T12:00:00` with fallback.

**New trade form — behaviour fields added**: `trade_type` (Planned / Impulsive toggle) and `confidence` (1–10 colour-coded buttons) added to the Analysis card. Previously, only trades edited after logging could have these fields — analytics was blind to trades logged directly. Both fields now saved to the database.

**New dependencies**
None

---

## 2026-06-23 — Design polish: mobile nav + consistency pass

### Polish: full app design consistency

**Files changed**
- `components/layout/AppShell.tsx`
- `app/globals.css`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/coach/page.tsx`

**What changed**

**Mobile navigation** (AppShell): Added `MobileHeader` (fixed top bar with logo, 52px) and `MobileBottomNav` (fixed bottom tab bar, 64px) shown only on screens ≤768px. Added `desktop-sidebar` class to sidebar `<aside>` so CSS hides it on mobile. Updated `globals.css` to add `padding-bottom: 64px` on mobile `<main>` so content isn't hidden behind the tab bar.

**Dashboard header normalised**: Reduced heading from `fontSize: 42` → `28`, padding from `48px 56px 36px` → `40px 48px 28px`, content gap/padding reduced, `maxWidth` from `1500` → `1400`. Log trade button reduced to standard size. All values now match Trades / Analytics / Settings pages.

**Dashboard recent trades**: P&L column was always `var(--text-muted)` (grey). Now coloured `var(--profit)` / `var(--loss)`. Date now correctly uses `trade_date` with fallback to `created_at`.

**Coach page header**: Added a proper full-width page header bar (matching all other pages) with title, BETA badge, subtitle, and Regenerate button. Content moved into a `maxWidth: 680` wrapper with consistent padding.

**New dependencies**
None

---

## 2026-06-23 — AI Coach

### Feature: Real AI-generated trading insights

**Files changed**
- `app/api/coach/route.ts` (new)
- `app/(app)/coach/page.tsx`
- `.env.local` (added `ANTHROPIC_API_KEY` placeholder)
- `package.json` / `package-lock.json` (added `@anthropic-ai/sdk`)

**What changed**

The AI Coach page was previously hardcoded with dummy insights. It now calls a real API route (`POST /api/coach`) that:
1. Authenticates the user server-side using `createServerClient` + cookies
2. Fetches up to 300 of the user's trades from Supabase
3. Computes a statistics summary: win rate, profit factor, direction breakdown, top strategies, top symbols, planned vs impulsive, confidence bands, recent trend
4. Sends the summary as a structured prompt to Claude (`claude-sonnet-4-6`)
5. Parses the JSON response into typed insight objects

**UI changes to coach page:**
- Replaced hardcoded insights with dynamic state
- Added "Generate insights" button / empty state with description
- Loading skeleton cards while Claude analyses
- "Regenerate" button after insights are shown (top-right)
- Error display for API failures or insufficient data (< 5 trades)
- Tabs still work (All / Strength / Watch out / Opportunity / Pattern)

**Setup required:**
Add your Anthropic API key to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

**New dependencies**
- `@anthropic-ai/sdk` ^0.x

---

## 2026-06-22 — Analytics: Long/Short, Monthly chart, Symbol breakdown

### Feature: Three new analytics sections

**Files changed**
- `app/(app)/analytics/page.tsx`

**What changed**

**Long vs Short** — table showing LONG and SHORT rows with: trades count, win rate, winning count + %, losing count + %.

**Monthly performance** — grouped bar chart (green = wins, red = losses per month) ordered chronologically. Includes a small colour legend below the chart. Only renders when data exists.

**Symbol breakdown** — table sorted by trade count showing per-symbol: trades, win rate, winning count + %, losing count + %, total P&L in €. Mirrors the style of the existing Strategy breakdown table.

Volume / average deal size stats from the cTrader screenshot were intentionally skipped — lot size is not stored for imported trades.

**New dependencies**
None

---

## 2026-06-21 — Screenshot upload on edit

### Feature: Edit trade now supports screenshot upload

**Files changed**
- `app/(app)/trades/[id]/edit/page.tsx`

**What changed**
Added screenshot management to the edit form (Analysis card, below Notes):

- **Load**: existing `screenshot_url` is fetched from the trade and displayed as a thumbnail
- **Replace**: clicking "Replace screenshot" opens a file picker; selecting a file uploads it to the `screenshots` Supabase Storage bucket on save and replaces the URL
- **Remove**: "Remove screenshot" link marks the screenshot for deletion; an Undo option is shown until save
- **New upload**: if no existing screenshot, button shows "Upload screenshot"
- **Validation**: file size capped at 10 MB; error shown inline if exceeded
- **Session guard**: calls `supabase.auth.getUser()` before upload (only when a new file is selected)

`screenshot_url` is now explicitly included in the Supabase `update()` call, resolving to:
- `null` if removed
- new public URL if replaced/uploaded
- existing URL if unchanged

**New dependencies**
None

---

## 2026-06-21 — Behaviour Analytics (Phase 3)

### Feature: Behaviour section on analytics page

**Files changed**
- `app/(app)/analytics/page.tsx`

**What changed**

Added a `Behaviour` section at the bottom of the analytics page, rendered only when the user has trades with `trade_type` or `confidence` logged.

**Planned vs Impulsive cards** (shown when `trade_type` data exists):
- Two side-by-side cards with a green top border (Planned) and red top border (Impulsive)
- Each shows: trade count, win rate, total return %, avg return per trade
- Colour-coded values (green/red based on whether metric is above threshold)

**Confidence bands** (shown when `confidence` data exists):
- Three cards in a row: Low (1–4), Mid (5–7), High (8–10)
- Each shows: trade count, win rate, total return %
- Graceful "—" state when a band has zero trades

**Section is hidden entirely** when neither `trade_type` nor `confidence` has been logged on any trade — no empty state clutter.

**Select updated** to include `trade_type, confidence`.

**Why**
Phase 3 roadmap item. Connects behaviour to performance — answers "do planned trades outperform impulsive ones?" and "does confidence level predict outcome?". Data is already collected per-trade; this section surfaces the signal.

**New dependencies**
None

---

## 2026-06-21 — cTrader CSV parser fixes

### Fix: CSV parser now recognises native cTrader export format

**Files changed**
- `app/(app)/trades/import/page.tsx`

**Root cause**
The original parser assumed `lines[0]` was always the header row and used fixed column name aliases that did not match cTrader's actual export columns.

**Actual cTrader CSV columns:**
```
Symbol, Opening Direction, Closing Time (UTC+2), Entry price, Closing Price, Closing Quantity, Net EUR, Balance EUR
```

**Five fixes applied:**

1. **Header row detection** — parser now scans all lines to find the first row containing `symbol`, skipping any account metadata lines cTrader puts at the top (account number, period, currency, etc.)

2. **`Opening Direction`** — added as an alias for the direction column (previously only matched `direction`, `side`, `type`)

3. **`Closing Price`** — added as an alias for the exit price column (previously only matched `close price`, `exit price`)

4. **`Closing Time (UTC+2)`** — the `clean()` function now strips trailing parenthetical suffixes (e.g. `(UTC+2)`, `(UTC+3)`) before matching, so `closing time (utc+2)` matches `closing time`; `closing time` added as an alias

5. **`Net EUR` / `Net USD` / `Net GBP`** — added a fallback that matches any column whose name starts with `net ` (covers any currency cTrader account is denominated in)

**Data rows** — loop now starts at `headerRowIdx + 1` instead of hardcoded `1`, so rows above the header are correctly skipped.

**New dependencies**
None

---

## 2026-06-21 — cTrader CSV Import

### Feature: Import cTrader closed positions CSV

**Files changed**
- `app/(app)/trades/import/page.tsx` (new)
- `app/(app)/trades/page.tsx`

**What changed**

New page at `/trades/import` with a three-step flow:

1. **Upload** — drag-and-drop or click-to-browse drop zone, accepts `.csv` files
2. **Preview** — parsed trades displayed in a table (Symbol, Direction, Date, Entry, Exit, P&L); capped at 50 rows for large files, all rows still imported
3. **Import** — single Supabase `insert` of all rows, then redirect to `/trades`

**Parser supports:**
- UTF-8 BOM stripping
- Auto-detects separator (`;` or `,`)
- Case-insensitive column matching with fallback names (e.g. "Open Price" / "Entry Price" / "open_price")
- Direction mapping: "Buy"/"buy limit" etc → `LONG`, "Sell"/"sell stop" etc → `SHORT`
- Date extraction: prefers `Close Time`, falls back to `Open Time`; handles `YYYY-MM-DD HH:MM:SS` format
- Skips summary/totals rows and any row missing required fields
- Clear error messages for unrecognised formats

**Fields imported:** `symbol`, `direction`, `entry_price`, `exit_price`, `pnl`, `trade_date`, `followed_plan` (set to false)

**Fields left null:** `return_pct`, `rr`, `strategy`, `trade_type`, `confidence`, `notes`, `screenshot_url`, `stop_loss`, `take_profit` — can be filled via the edit form per trade.

**Trades page** — added an "Import" button (`/trades/import`) next to "Log trade" in the page header. Uses the `Upload` lucide icon.

**Instructions card** included on the import page explaining how to export from cTrader (History → right-click → Export CSV → Closed Positions).

**Why**
Phase 2 roadmap item. Manual trade entry is the biggest friction point for new users who already have a trading history in cTrader. Bulk import removes that barrier.

**New dependencies**
None — CSV parsing is done client-side without a library.

---

## 2026-06-21 — Discipline Score

### Feature: Discipline Score on dashboard

**Files changed**
- `app/(app)/dashboard/page.tsx`

**What changed**
Replaced the "—" / "Coming soon" placeholder KPI card with a live Discipline Score (0–100) computed from the user's actual trade data.

**Algorithm — process-based, not profit-based:**

| Component | Weight | Formula |
|---|---|---|
| Planned trade rate | 40 pts | `planned / (planned + impulsive)` — trades with `trade_type` logged |
| Plan adherence | 30 pts | `followed_plan = true / total trades` |
| Confidence quality | 20 pts | `avg(confidence) / 10` — trades with confidence logged |
| Journal completeness | 10 pts | `trades with notes or screenshot / total` |

Score = sum of all components, rounded to integer.

**Colour coding:**
- ≥ 70 → green (`var(--profit)`) — strong process
- 40–69 → amber (`#B45309`) — needs work
- < 40 → red (`var(--loss)`) — focus on process
- null (no trades) → no colour, sub shows "Log trades to unlock"

**Select updated** to include `followed_plan, confidence, notes, screenshot_url` (previously only fetched performance fields).

**Why**
Discipline Score is a Phase 1 MVP item per the roadmap. The score measures process consistency rather than profitability — a user can have a high score despite losing trades if they followed their plan, journalled, and traded intentionally.

**New dependencies**
None

---

## 2026-06-21 — Equity curve now shows return %

### Fix: Equity curve displays cumulative return %, not cumulative dollar P&L

**Files changed**
- `components/charts/EquityCurve.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/analytics/page.tsx`

**What changed**

`EquityCurve.tsx`:
- `CustomTooltip` now renders `+2.45%` / `-1.20%` instead of `+$245.00`
- `formatAxis` now renders `+2.5%` / `-1.2%` instead of `$245` / `$1.2k`
- `isUp` changed from `data[last].value >= data[0].value` to `data[last].value >= 0` — curve is green when total return is positive, red when negative

`dashboard/page.tsx`:
- `equityData` now accumulates `trade.return_pct` instead of `trade.pnl`

`analytics/page.tsx`:
- `return_pct` added to Supabase select
- `equityData` now accumulates `trade.return_pct` instead of `trade.pnl`

**Why**
`PROJECT_CONTEXT.md` and `DESIGN_GUIDE.md` both specify the equity curve should show return % rather than dollar amounts. The old curve showed cumulative dollar P&L, which is meaningless without knowing account size and varies wildly between users. Cumulative return % is consistent and comparable.

**New dependencies**
None

---

## 2026-06-21 — Behaviour display + Settings page

### Feature: Trade detail page now shows trade_type and confidence

**Files changed**
- `app/(app)/trades/[id]/page.tsx`

**What changed**
- Added `Activity` icon to imports
- Left column restructured from a single Setup details card to a stacked flex column: Setup details card on top, conditional Behaviour card below
- Behaviour card renders only when `trade.trade_type` or `trade.confidence` is non-null (no empty card for trades logged before these fields existed)
- `trade_type` shown as a coloured row value: Planned → `var(--profit)`, Impulsive → `var(--loss)`
- `confidence` shown as `X / 10` with colour based on level: ≥7 green, ≥4 amber (#B45309), <4 red

**Why**
`trade_type` and `confidence` were being collected and stored but never displayed on the detail page. Users had no way to see the behaviour data they logged after saving a trade.

**New dependencies**
None

---

### Fix: Settings page now functional

**Files changed**
- `app/(app)/settings/page.tsx` (full rewrite from stub)

**What changed**
Replaced the "Coming soon" placeholder with a working settings page containing two sections:

1. **Account** — displays the authenticated user's email (read-only, fetched via `supabase.auth.getUser()`)
2. **Change password** — new password + confirm fields with:
   - Client-side validation (both fields required, min 8 chars, passwords must match)
   - Calls `supabase.auth.updateUser({ password })` on submit
   - Inline success banner on update
   - Inline error banner on failure
   - Inputs clear and loading state set during the request

**Why**
The settings page was a stub that showed "Coming soon" with no functionality. The sidebar nav linked to it, creating a dead end.

**New dependencies**
None

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
