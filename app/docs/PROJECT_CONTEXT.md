De Bijbel van Compass

# Compass — Project Context

## Project Overview

Compass is a Trading Performance Operating System.

Compass is not a traditional trading journal.

The goal is helping traders improve performance, discipline and consistency through:

* Performance Analytics
* Behaviour Analytics
* Discipline Tracking
* AI Coaching
* Trade Journaling

Compass should feel like a trading operating system rather than a spreadsheet.

The product should help traders understand:

* What works
* What doesn't work
* When they deviate from their process
* How behaviour affects performance
* How to improve consistency

---

# Product Positioning

Compass is NOT:

* Another TradeZella clone
* A psychology diary
* A statistics dashboard

Compass IS:

A Trading Performance Operating System.

Users should feel like Compass helps them stay on course.

The compass metaphor is central to the product.

Compass does not predict markets.

Compass helps traders avoid drifting away from their own process.

---

# Design Philosophy

Compass should feel closer to:

* Notion
* Linear
* Raycast
* Apple Fitness

Than:

* TradeZella
* TraderSync
* Bloomberg Terminal

Design principles:

* Minimal
* Calm
* Premium
* Spacious
* Highly readable
* Light mode first
* No clutter
* No dashboard overload

If there is ever a tradeoff between more analytics and a cleaner experience, choose the cleaner experience.

---

# Visual Style

Colors:

* Warm off-white backgrounds
* Soft greys
* Minimal blue accents
* Green and red only when necessary

Typography:

* Clean
* Professional
* Modern

Compass should feel premium and understated.

---

# Logo Direction

Minimal Compass logo.

Potential concepts:

* Compass needle
* Compass + trend line
* Compass + chart
* Compass arrow integrated into a price line

Avoid crypto-exchange style branding.

Think Linear rather than Binance.

---

# Dashboard Philosophy

The dashboard should stay focused.

Avoid dashboard overload.

Top metrics:

* Return %
* Winrate
* Profit Factor
* Discipline Score

Avoid:

* Total Trades
* Average Return
* Excessive KPI cards

---

# Equity Curve

The equity curve is the most important visual element on the dashboard.

It should occupy most of the available space.

Performance should primarily be displayed in percentages rather than money.

Example:

+12.4%

instead of

+$2,431

Money values can exist inside analytics pages.

---

# Focus Section

The dashboard should contain a simple process reminder.

Example:

Find → Plan → Wait → Execute → Review → Repeat

Purpose:

Keep traders focused on process rather than outcome.

---

# Compass Insight

Dashboard contains a small insight card.

Examples:

"You perform best during London session trades."

"Impulsive trades account for 43% of your losses."

"Your confidence 8+ trades outperform the rest by 12%."

Insights should be short, actionable and useful.

---

# Trade Journal

Each trade contains:

* Symbol
* Direction
* Entry
* Exit
* Stop Loss
* Take Profit
* Return %
* RR
* Screenshot
* Notes

---

# Behaviour Tracking (MVP)

Keep behaviour tracking simple.

For each trade:

Trade Type:

* Planned
* Impulsive

Confidence:

* 1-10

Goal:

Collect useful behavioural data without creating friction.

Do not overcomplicate trade entry.

---

# Future Behaviour Features

Potential future additions:

* Execution Grade
* Emotion Tracking

Not MVP priorities.

---

# Behaviour Analytics

Compass should connect behaviour to performance.

Examples:

Planned Trades:
+14.2%
63% Winrate

Impulsive Trades:
-4.1%
28% Winrate

Confidence 8-10:
+11.3%

Confidence 1-4:
-5.2%

Behaviour analytics should answer:

"How does behaviour affect results?"

---

# Discipline Score

One of the most important Compass features.

The score should NOT be based on profitability.

The score should be based on process.

Inputs may include:

* Planned vs Impulsive trades
* Followed Plan
* Confidence
* Overtrading
* Journal completion
* Trading consistency

Outputs:

* Daily Discipline Score
* Weekly Discipline Score
* Monthly Discipline Score

Range:

0-100

Users should be able to improve their score through better behaviour rather than simply making money.

---

# Trader Goals

Users can define goals.

Examples:

Target Return:
3% per week

Maximum Trades:
20 per week

Maximum Impulsive Trades:
2 per week

These goals will later be used inside Discipline Analytics and AI Coaching.

---

# Import System

High priority.

Workflow:

Upload CSV
→ Preview Trades
→ Import
→ Done

Priority order:

V1

* cTrader CSV Import

V2

* MT5 CSV Import

V3

* API/Broker Integrations

The import process should be extremely simple.

---

# AI Coach

The AI Coach should not act as a chatbot.

It should act as a trading performance coach.

Examples:

"You lose money primarily during impulsive trades."

"Your discipline score improved despite lower returns."

"You perform best when confidence is above 7."

The AI should analyze:

* Performance
* Behaviour
* Discipline

The AI should help traders improve consistency.

---

# Current Tech Stack

* Next.js 16
* React 19
* Tailwind CSS 4
* Supabase
* Vercel

---

# Current File Structure

app/
├── (app)/
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   ├── trades/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── edit/page.tsx
│   ├── analytics/page.tsx
│   └── coach/page.tsx
├── login/page.tsx
├── signup/page.tsx
├── globals.css
└── layout.tsx

components/
├── layout/AppShell.tsx
├── charts/EquityCurve.tsx
└── trades/RecentTrades.tsx

lib/
├── supabase.ts
└── utils.ts

---

# Current Database

Trades table:

id
created_at
trade_date
symbol
direction
entry_price
exit_price
pnl
strategy
setup_score
followed_plan
notes
screenshot_url
return_pct
stop_loss
take_profit
rr
user_id
trade_type
confidence

---

# Current Development Priorities

1. Login/Auth stability
2. Trade CRUD polish
3. Dashboard redesign
4. Analytics redesign
5. Display trade_type and confidence in trade details
6. Discipline Score system
7. CSV Import page
8. Settings page
9. Mobile navigation
10. cTrader import
11. MT5 import
12. Behaviour analytics
13. AI Coach

Always prioritize simplicity, usability and clarity over feature quantity.
