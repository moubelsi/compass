'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency, localDateStr } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const MOODS = [
  { value: 1, emoji: '😔', label: 'Rough' },
  { value: 2, emoji: '😐', label: 'Flat' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😊', label: 'Great' },
  { value: 5, emoji: '🔥', label: 'Sharp' },
]

const EMPTY_FORM = { content: '', wentWell: '', wentWrong: '', biggestLesson: '', focusTomorrow: '' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date) { return localDateStr(d) }

function formatDisplay(dateStr: string) {
  const today     = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86400000))
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── Botanical ornament ────────────────────────────────────────────────────────

function BotanicalOrnament({ opacity = 0.07, size = 180 }: { opacity?: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" style={{ position: 'absolute', pointerEvents: 'none', opacity }} aria-hidden>
      <path d="M90 170 C90 140 85 110 78 80 C72 55 68 35 72 18" stroke="var(--journal-rose)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M82 95 C72 90 58 88 48 80" stroke="var(--journal-rose)" strokeWidth="1" strokeLinecap="round"/>
      <path d="M80 72 C88 65 100 62 110 56" stroke="var(--journal-rose)" strokeWidth="1" strokeLinecap="round"/>
      <ellipse cx="46" cy="78" rx="10" ry="5" transform="rotate(-20 46 78)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      <ellipse cx="112" cy="54" rx="10" ry="5" transform="rotate(30 112 54)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      <ellipse cx="74" cy="20" rx="7" ry="4" transform="rotate(-40 74 20)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      <circle cx="90" cy="30" r="7" fill="none" stroke="var(--journal-rose)" strokeWidth="1"/>
      <circle cx="90" cy="30" r="4" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="90" cy="21" rx="4" ry="5" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="99" cy="26" rx="4" ry="5" transform="rotate(60 99 26)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="99" cy="35" rx="4" ry="5" transform="rotate(120 99 35)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="90" cy="39" rx="4" ry="5" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="81" cy="35" rx="4" ry="5" transform="rotate(-120 81 35)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="81" cy="26" rx="4" ry="5" transform="rotate(-60 81 26)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="76" cy="50" rx="4" ry="5" transform="rotate(-15 76 50)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <path d="M76 55 C76 58 76 60 76 62" stroke="var(--journal-rose)" strokeWidth="0.8" strokeLinecap="round"/>
    </svg>
  )
}

// ── Intraday equity curve ─────────────────────────────────────────────────────

function DailyEquityCurve({ trades, symbol }: { trades: any[]; symbol: string }) {
  const sorted = [...trades].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const data: { time: string; pnl: number }[] = []
  let cum = 0
  data.push({ time: '', pnl: 0 })
  sorted.forEach(t => {
    cum += Number(t.pnl || 0)
    data.push({ time: formatTime(t.created_at), pnl: parseFloat(cum.toFixed(2)) })
  })

  const isPositive = cum >= 0
  const color      = isPositive ? 'var(--profit)' : 'var(--loss)'
  const fillId     = isPositive ? 'profitFill' : 'lossFill'

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const v = payload[0]?.value as number
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '6px 10px' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{payload[0]?.payload?.time}</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: v >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
          {v >= 0 ? '+' : ''}{symbol}{Math.abs(v).toFixed(2)}
        </p>
      </div>
    )
  }

  if (data.length < 2) return null

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '18px 4px 10px 0', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ paddingLeft: 20, marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Day P&L</span>
        <span style={{ fontSize: 18, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>
          {cum >= 0 ? '+' : ''}{symbol}{Math.abs(cum).toFixed(2)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={76}>
        <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--profit)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--profit)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--loss)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--loss)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={v => `${symbol}${v}`} />
          <ReferenceLine y={0} stroke="var(--border-default)" strokeWidth={1} />
          <RTooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-default)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="pnl" stroke={color} strokeWidth={1.5} fill={`url(#${fillId})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Expandable trade row ──────────────────────────────────────────────────────

function ExpandableTradeRow({ trade, symbol }: { trade: any; symbol: string }) {
  const [open, setOpen] = useState(false)
  const pnl    = Number(trade.pnl || 0)
  const isWin  = pnl > 0
  const ret    = Number(trade.return_pct ?? 0)

  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', overflow: 'hidden', transition: 'border-color 0.1s' }}>
      {/* Row header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--bg-surface)', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
      >
        {/* Screenshot thumbnail */}
        {trade.screenshot_url && trade.screenshot_url !== 'EMPTY' ? (
          <img src={trade.screenshot_url} alt="" style={{ width: 44, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }} />
        ) : (
          <div style={{ width: 30, height: 30, borderRadius: 6, background: isWin ? 'var(--profit-dim)' : 'var(--loss-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: isWin ? 'var(--profit)' : 'var(--loss)', letterSpacing: '0.02em' }}>{isWin ? 'WIN' : 'LOSS'}</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{trade.symbol?.toUpperCase()}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: trade.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: trade.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)', letterSpacing: '0.04em' }}>{trade.direction}</span>
            {trade.trade_type && (
              <span style={{ fontSize: 9, fontWeight: 500, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-elevated)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{trade.trade_type}</span>
            )}
          </div>
          {trade.strategy && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{trade.strategy}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: isWin ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
            {ret !== 0 ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : '—'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: isWin ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>
            {pnl >= 0 ? '+' : '-'}{symbol}{Math.abs(pnl).toFixed(2)}
          </span>
          {trade.rr != null && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(trade.rr).toFixed(1)}R</span>
          )}
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: '14px 14px 14px 14px', borderTop: '1px solid var(--border-subtle)', background: 'var(--journal-ivory)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'Time',      value: formatTime(trade.created_at) },
              { label: 'Confidence',value: trade.confidence != null ? `${trade.confidence}/10` : '—' },
              { label: 'Followed plan', value: trade.followed_plan ? 'Yes' : trade.followed_plan === false ? 'No' : '—' },
              { label: 'R multiple', value: trade.rr != null ? `${Number(trade.rr).toFixed(2)}R` : '—' },
            ].map(s => (
              <div key={s.label} style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: s.label === 'Followed plan' ? (s.value === 'Yes' ? 'var(--profit)' : s.value === 'No' ? 'var(--loss)' : 'var(--text-muted)') : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
              </div>
            ))}
          </div>
          {trade.notes && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>Notes</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{trade.notes}</p>
            </div>
          )}
          {trade.screenshot_url && trade.screenshot_url !== 'EMPTY' && (
            <a href={`/trades/${trade.id}`} style={{ display: 'block', textDecoration: 'none' }}>
              <img src={trade.screenshot_url} alt="Screenshot" style={{ width: '100%', borderRadius: 7, border: '1px solid var(--border-subtle)', display: 'block' }} />
            </a>
          )}
          <Link href={`/trades/${trade.id}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', alignSelf: 'flex-start' }}>
            Open full trade →
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Mini calendar (right sidebar) ─────────────────────────────────────────────

function MiniCalendar({
  selectedDate, onSelect, entryDates, tradeDates,
}: {
  selectedDate: string
  onSelect: (d: string) => void
  entryDates: Set<string>
  tradeDates: Set<string>
}) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(
    parseInt(selectedDate.slice(0, 4)),
    parseInt(selectedDate.slice(5, 7)) - 1,
    1
  ))

  useEffect(() => {
    const y = parseInt(selectedDate.slice(0, 4))
    const m = parseInt(selectedDate.slice(5, 7)) - 1
    if (viewDate.getFullYear() !== y || viewDate.getMonth() !== m)
      setViewDate(new Date(y, m, 1))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const days: { date: string; n: number }[] = []
  for (let d = new Date(year, month, 1); d.getMonth() === month; d.setDate(d.getDate() + 1))
    days.push({ date: localDateStr(d), n: d.getDate() })

  const firstDow   = new Date(year, month, 1).getDay()
  const offset     = firstDow === 0 ? 6 : firstDow - 1
  const totalCells = Math.ceil((offset + days.length) / 7) * 7
  const cells: ({ date: string; n: number } | null)[] = [
    ...Array(offset).fill(null),
    ...days,
    ...Array(totalCells - offset - days.length).fill(null),
  ]

  const todayStr = localDateStr(today)
  const canNext  = new Date(year, month + 1, 1) <= today

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '16px 16px 12px' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <ChevronLeft size={11} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => canNext && setViewDate(new Date(year, month + 1, 1))} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'none', cursor: canNext ? 'pointer' : 'default', color: canNext ? 'var(--text-muted)' : 'var(--border-default)', opacity: canNext ? 1 : 0.35 }}>
          <ChevronRight size={11} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 3 }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--text-disabled)', textAlign: 'center', paddingBottom: 3, letterSpacing: '0.04em' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />
          const isSelected = cell.date === selectedDate
          const isToday    = cell.date === todayStr
          const isFuture   = cell.date > todayStr
          const hasEntry   = entryDates.has(cell.date)
          const hasTrades  = tradeDates.has(cell.date)
          return (
            <button key={cell.date}
              onClick={() => !isFuture && onSelect(cell.date)}
              disabled={isFuture}
              style={{
                position: 'relative',
                height: 28, width: '100%', borderRadius: 5, fontSize: 11,
                fontWeight: isToday ? 700 : isSelected ? 600 : 400,
                background: isSelected ? 'var(--journal-rose)' : isToday ? 'var(--journal-ivory-dark)' : 'transparent',
                color: isSelected ? '#fff' : isToday ? 'var(--journal-rose)' : isFuture ? 'var(--text-disabled)' : 'var(--text-secondary)',
                border: isToday && !isSelected ? '1px solid var(--journal-rose)' : '1px solid transparent',
                cursor: isFuture ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 1,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isFuture && !isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{cell.n}</span>
              {/* Indicators */}
              {(hasEntry || hasTrades) && (
                <div style={{ display: 'flex', gap: 2, position: 'absolute', bottom: 2 }}>
                  {hasEntry  && <span style={{ width: 3, height: 3, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--journal-rose)', display: 'block' }} />}
                  {hasTrades && <span style={{ width: 3, height: 3, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', display: 'block' }} />}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--journal-rose)', display: 'block', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Entry</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', display: 'block', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Trades</span>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const { symbol }       = useCurrency()
  const searchParams     = useSearchParams()
  const paramDate        = searchParams.get('date')
  const initDate         = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : toDateStr(new Date())

  const [selectedDate, setSelectedDate] = useState(initDate)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [savedForm, setSavedForm]       = useState(EMPTY_FORM)
  const [mood, setMood]                 = useState<number | null>(null)
  const [savedMood, setSavedMood]       = useState<number | null>(null)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [saveError, setSaveError]       = useState('')
  const [pastEntries, setPastEntries]   = useState<any[]>([])
  const [recentTrades, setRecentTrades] = useState<any[]>([])
  const [userId, setUserId]             = useState<string | null>(null)
  const [tradesOpen, setTradesOpen]     = useState(false)

  useEffect(() => { setTradesOpen(false) }, [selectedDate])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
    supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(90)
      .then(({ data }) => setPastEntries(data || []))
    const since = new Date(Date.now() - 90 * 86400000).toISOString()
    supabase.from('trades')
      .select('id, symbol, pnl, return_pct, rr, strategy, trade_date, created_at, direction, notes, screenshot_url, followed_plan, trade_type, confidence')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .then(({ data }) => setRecentTrades(data || []))
  }, [])

  useEffect(() => {
    const entry = pastEntries.find(e => e.entry_date === selectedDate)
    const loaded = {
      content:       entry?.content       || '',
      wentWell:      entry?.went_well     || '',
      wentWrong:     entry?.went_wrong    || '',
      biggestLesson: entry?.biggest_lesson || '',
      focusTomorrow: entry?.focus_tomorrow || '',
    }
    setForm(loaded)
    setSavedForm(loaded)
    setMood(entry?.mood ?? null)
    setSavedMood(entry?.mood ?? null)
    setSaved(false)
    setSaveError('')
  }, [selectedDate, pastEntries])

  // ── Day stats ──
  const tEffDate   = (t: any) => (t.trade_date ? t.trade_date.slice(0, 10) : null) || localDateStr(new Date(t.created_at))
  const dayTrades  = recentTrades.filter(t => tEffDate(t) === selectedDate)
  const dayPnl     = dayTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const dayReturn  = dayTrades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const dayWins    = dayTrades.filter(t => Number(t.pnl) > 0)
  const dayLosses  = dayTrades.filter(t => Number(t.pnl) < 0)
  const winRate    = dayTrades.length > 0 ? Math.round(dayWins.length / dayTrades.length * 100) : 0
  const grossProfit = dayWins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss   = Math.abs(dayLosses.reduce((s, t) => s + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : dayWins.length > 0 ? '∞' : '—'
  const avgWin      = dayWins.length > 0 ? grossProfit / dayWins.length : 0
  const avgLoss     = dayLosses.length > 0 ? grossLoss / dayLosses.length : 0
  const rrTrades    = dayTrades.filter(t => t.rr != null)
  const avgR        = rrTrades.length > 0 ? rrTrades.reduce((s, t) => s + Number(t.rr), 0) / rrTrades.length : null
  const bestTrade   = dayTrades.length > 0 ? dayTrades.reduce((b, t) => Number(t.pnl) > Number(b.pnl) ? t : b, dayTrades[0]) : null
  const worstTrade  = dayTrades.length > 0 ? dayTrades.reduce((w, t) => Number(t.pnl) < Number(w.pnl) ? t : w, dayTrades[0]) : null

  // ── Calendar sets ──
  const entryDates = new Set(pastEntries.map(e => e.entry_date))
  const tradeDates = new Set(recentTrades.map(t => tEffDate(t)).filter(Boolean))

  // ── Past entries for sidebar ──
  const tradesByDay: Record<string, { pnl: number; count: number }> = {}
  recentTrades.forEach(t => {
    const d = tEffDate(t)
    if (!d) return
    if (!tradesByDay[d]) tradesByDay[d] = { pnl: 0, count: 0 }
    tradesByDay[d].pnl   += Number(t.pnl || 0)
    tradesByDay[d].count += 1
  })

  const isDirty = form.content       !== savedForm.content       ||
                  form.wentWell      !== savedForm.wentWell      ||
                  form.wentWrong     !== savedForm.wentWrong     ||
                  form.biggestLesson !== savedForm.biggestLesson ||
                  form.focusTomorrow !== savedForm.focusTomorrow ||
                  mood               !== savedMood

  const hasAnyContent = Object.values(form).some(v => v.trim()) || mood !== null

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function save() {
    if (!userId || !isDirty) return
    setSaving(true); setSaveError('')
    const { data, error } = await supabase.from('journal_entries').upsert({
      user_id:        userId,
      entry_date:     selectedDate,
      content:        form.content       || null,
      went_well:      form.wentWell      || null,
      went_wrong:     form.wentWrong     || null,
      biggest_lesson: form.biggestLesson || null,
      focus_tomorrow: form.focusTomorrow || null,
      mood:           mood ?? null,
    }, { onConflict: 'user_id,entry_date' }).select()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    if (data) {
      setSavedForm(form)
      setSavedMood(mood)
      setPastEntries(prev => {
        const filtered = prev.filter(e => e.entry_date !== selectedDate)
        return [data[0], ...filtered].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function navigate(dir: -1 | 1) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + dir)
    if (d > new Date()) return
    setSelectedDate(toDateStr(d))
  }

  const isToday        = selectedDate === toDateStr(new Date())
  const canSave        = isDirty && hasAnyContent && !saving
  const currentMoodObj = MOODS.find(m => m.value === mood)

  const pastWithContent = pastEntries.filter(e =>
    e.entry_date !== selectedDate &&
    (e.content?.trim() || e.went_well || e.went_wrong || e.biggest_lesson || e.focus_tomorrow)
  ).slice(0, 8)

  return (
    <div style={{ background: 'var(--journal-ivory)', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '36px 56px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--journal-ivory-dark)' }}>
        <div style={{ position: 'absolute', top: -20, right: 40 }}>
          <BotanicalOrnament opacity={0.12} size={200} />
        </div>
        <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Trading Journal</p>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--journal-ink)', letterSpacing: '-0.025em', marginBottom: 5, lineHeight: 1.1 }}>Journal</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Reflect. Observe. Improve.</p>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 56px 72px', display: 'grid', gridTemplateColumns: '1fr 296px', gap: 32, alignItems: 'start' }}>

        {/* ════════════════════ LEFT COLUMN ════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* Date nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
              <ChevronLeft size={15} />
            </button>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--journal-ink)', letterSpacing: '-0.015em' }}>
                {formatDisplay(selectedDate)}
              </span>
              {!isToday && (
                <span style={{ fontSize: 12, color: 'var(--text-disabled)', marginLeft: 10 }}>
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
              )}
            </div>
            {!isToday && (
              <button onClick={() => setSelectedDate(toDateStr(new Date()))} style={{ fontSize: 12, color: 'var(--journal-rose)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Back to today
              </button>
            )}
            <button onClick={() => navigate(1)} disabled={isToday} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: isToday ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: isToday ? 0.3 : 1, flexShrink: 0 }}>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* ── No-trades nudge ── */}
          {dayTrades.length === 0 && (
            <div style={{ padding: '13px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                {recentTrades.length > 0
                  ? `No trades on this day · ${recentTrades.length} trade${recentTrades.length === 1 ? '' : 's'} loaded — pick a date with a dot`
                  : 'No trades imported yet'}
              </p>
              <Link href="/trades/import" style={{ fontSize: 12, color: 'var(--journal-rose)', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Import trades →
              </Link>
            </div>
          )}

          {/* ── Intraday equity curve ── */}
          {dayTrades.length > 0 && (
            <DailyEquityCurve trades={dayTrades} symbol={symbol} />
          )}

          {/* ── Daily stats ── */}
          {dayTrades.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                {formatDisplay(selectedDate)} · Statistics
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                {[
                  { label: 'Net P&L',      value: formatCurrency(dayPnl, true, symbol),   color: dayPnl >= 0 ? 'var(--profit)' : 'var(--loss)' },
                  { label: 'Trades',       value: `${dayTrades.length}`,                  sub: `${dayWins.length}W · ${dayLosses.length}L` },
                  { label: 'Win rate',     value: `${winRate}%`,                           color: winRate >= 50 ? 'var(--profit)' : 'var(--loss)' },
                  { label: 'Profit factor',value: profitFactor,                            color: typeof profitFactor === 'string' && parseFloat(profitFactor) >= 1 ? 'var(--profit)' : undefined },
                ].map(s => (
                  <div key={s.label} style={{ padding: '13px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{s.label}</p>
                    <p style={{ fontSize: 17, fontWeight: 600, color: (s as any).color || 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.value}</p>
                    {(s as any).sub && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{(s as any).sub}</p>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Avg win',      value: avgWin > 0  ? `+${symbol}${avgWin.toFixed(2)}`  : '—', color: avgWin > 0  ? 'var(--profit)' : undefined },
                  { label: 'Avg loss',     value: avgLoss > 0 ? `-${symbol}${avgLoss.toFixed(2)}`  : '—', color: avgLoss > 0 ? 'var(--loss)'   : undefined },
                  { label: 'Avg R',        value: avgR != null ? `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R` : '—', color: avgR != null ? (avgR >= 0 ? 'var(--profit)' : 'var(--loss)') : undefined },
                  { label: 'Return',       value: dayReturn !== 0 ? `${dayReturn >= 0 ? '+' : ''}${dayReturn.toFixed(2)}%` : '—', color: dayReturn >= 0 ? 'var(--profit)' : 'var(--loss)' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '13px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{s.label}</p>
                    <p style={{ fontSize: 17, fontWeight: 600, color: s.color || 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.value}</p>
                  </div>
                ))}
              </div>
              {/* Best / Worst */}
              {bestTrade && worstTrade && bestTrade.id !== worstTrade.id && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  {[
                    { label: 'Best trade',  trade: bestTrade,  accent: 'var(--profit)' },
                    { label: 'Worst trade', trade: worstTrade, accent: 'var(--loss)' },
                  ].map(s => (
                    <Link key={s.label} href={`/trades/${s.trade.id}`} style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, textDecoration: 'none', display: 'block', borderLeft: `3px solid ${s.accent}` }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{s.label}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.trade.symbol?.toUpperCase()}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: s.accent, fontVariantNumeric: 'tabular-nums' }}>
                          {Number(s.trade.pnl) >= 0 ? '+' : '-'}{symbol}{Math.abs(Number(s.trade.pnl)).toFixed(2)}
                        </span>
                        {s.trade.strategy && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.trade.strategy}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Trades ── */}
          {dayTrades.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setTradesOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: tradesOpen ? 12 : 0 }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Trades · {dayTrades.length}
                </span>
                {tradesOpen
                  ? <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} />
                  : <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />}
              </button>
              {tradesOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dayTrades.map(t => <ExpandableTradeRow key={t.id} trade={t} symbol={symbol} />)}
                </div>
              )}
            </div>
          )}

          {/* ── Entry card ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '26px 28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--journal-rose-dim) 0%, transparent 55%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Mood */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>How did you feel today?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {MOODS.map(m => {
                    const active = mood === m.value
                    return (
                      <button key={m.value} type="button" onClick={() => setMood(active ? null : m.value)}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', background: active ? 'var(--journal-rose-dim)' : 'var(--journal-ivory)', border: `1.5px solid ${active ? 'var(--journal-rose)' : 'var(--border-subtle)'}`, transform: active ? 'translateY(-1px) scale(1.03)' : 'none' }}>
                        <span style={{ fontSize: 20, display: 'block', transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.15s' }}>{m.emoji}</span>
                        <span style={{ fontSize: 10, fontWeight: 500, color: active ? 'var(--journal-rose)' : 'var(--text-muted)' }}>{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Main notes */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 9 }}>Session notes</p>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="What happened today? What did you execute well? What would you improve tomorrow?"
                  value={form.content}
                  onChange={e => setField('content', e.target.value)}
                  style={{ lineHeight: 1.8, resize: 'none', fontSize: 14, background: 'var(--journal-ivory)', border: '1px solid var(--border-subtle)', letterSpacing: '0.005em' }}
                />
              </div>

              {/* Reflection 2×2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { key: 'wentWell',      label: 'What went well?',     placeholder: 'Good entries, clean execution, patience…' },
                  { key: 'wentWrong',     label: 'What went wrong?',    placeholder: 'Mistakes, hesitations, overtrading…' },
                  { key: 'biggestLesson', label: 'Biggest lesson',       placeholder: 'One insight to carry forward…' },
                  { key: 'focusTomorrow', label: 'Focus for tomorrow',   placeholder: 'Intention for the next session…' },
                ].map(f => (
                  <div key={f.key}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>{f.label}</p>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof EMPTY_FORM]}
                      onChange={e => setField(f.key as keyof typeof EMPTY_FORM, e.target.value)}
                      style={{ lineHeight: 1.7, resize: 'none', fontSize: 13, background: 'var(--journal-ivory)', border: '1px solid var(--border-subtle)' }}
                    />
                  </div>
                ))}
              </div>

              {/* Save row */}
              {saveError && <p style={{ fontSize: 12, color: 'var(--loss)' }}>{saveError}</p>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: saved ? 'var(--profit)' : 'transparent', transition: 'color 0.3s' }}>✓ Saved</span>
                <button
                  onClick={save}
                  disabled={!canSave}
                  style={{ padding: '8px 28px', fontSize: 13, fontWeight: 500, borderRadius: 7, border: 'none', cursor: canSave ? 'pointer' : 'default', background: canSave ? 'var(--journal-rose)' : 'var(--bg-elevated)', color: canSave ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save entry'}
                </button>
              </div>

            </div>
          </div>

          {/* ── AI Reflection ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--ai-dim) 0%, transparent 65%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--ai-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={13} style={{ color: 'var(--ai-accent)' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AI Reflection</span>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 3, background: 'var(--ai-dim)', color: 'var(--ai-accent)', letterSpacing: '0.04em' }}>COMING SOON</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, opacity: 0.45 }}>
                {([
                  { label: 'Strengths',       text: 'Discipline in following your plan. Clean entries on the first two setups.' },
                  { label: 'Watch out',        text: 'Signs of revenge trading after consecutive losses in the afternoon.' },
                  { label: 'Pattern',          text: 'Morning session win rate is consistently higher. Consider limiting afternoon trades.' },
                  { label: "Tomorrow's focus", text: 'Stick to the pre-session plan. One setup, one trigger, full conviction.' },
                ] as const).map(item => (
                  <div key={item.label} style={{ padding: '11px 13px', borderRadius: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ai-accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.text}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 12, fontStyle: 'italic' }}>
                AI analysis will be generated from your actual trading data once this feature launches.
              </p>
            </div>
          </div>

          {/* ── Empty state ── */}
          {pastWithContent.length === 0 && !hasAnyContent && dayTrades.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.16 }}>
                <BotanicalOrnament opacity={1} size={100} />
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>Your first entry begins here.</p>
              <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 5 }}>Every reflection is a step forward.</p>
            </div>
          )}

        </div>

        {/* ════════════════════ RIGHT SIDEBAR ════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>

          {/* Mini calendar */}
          <MiniCalendar
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            entryDates={entryDates}
            tradeDates={tradeDates}
          />

          {/* Daily summary */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Day Summary</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Mood */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mood</span>
                <span style={{ fontSize: 18 }}>{currentMoodObj?.emoji || <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>—</span>}</span>
              </div>
              {/* P&L */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Net P&L</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: dayPnl >= 0 ? 'var(--profit)' : dayPnl < 0 ? 'var(--loss)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {dayTrades.length > 0 ? `${dayPnl >= 0 ? '+' : '-'}${symbol}${Math.abs(dayPnl).toFixed(2)}` : '—'}
                </span>
              </div>
              {/* Trades */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Trades</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {dayTrades.length > 0 ? `${dayTrades.length} (${dayWins.length}W · ${dayLosses.length}L)` : '—'}
                </span>
              </div>
              {/* Win rate */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Win rate</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: dayTrades.length > 0 ? (winRate >= 50 ? 'var(--profit)' : 'var(--loss)') : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {dayTrades.length > 0 ? `${winRate}%` : '—'}
                </span>
              </div>
              {/* Best trade */}
              {bestTrade && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Best trade</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--profit)', fontVariantNumeric: 'tabular-nums' }}>
                    {bestTrade.symbol?.toUpperCase()} +{symbol}{Math.abs(Number(bestTrade.pnl)).toFixed(2)}
                  </span>
                </div>
              )}
              {/* Worst trade */}
              {worstTrade && worstTrade.id !== bestTrade?.id && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Worst trade</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                    {worstTrade.symbol?.toUpperCase()} -{symbol}{Math.abs(Number(worstTrade.pnl)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Recent entries */}
          {pastWithContent.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Recent entries</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pastWithContent.map(entry => {
                  const moodObj  = MOODS.find(m => m.value === entry.mood)
                  const dayStats = tradesByDay[entry.entry_date]
                  const preview  = (entry.content || entry.went_well || entry.went_wrong || '').slice(0, 70)
                  return (
                    <button key={entry.id} type="button" onClick={() => setSelectedDate(entry.entry_date)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', transition: 'border-color 0.1s, background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--journal-rose)'; e.currentTarget.style.background = 'var(--journal-ivory-dark)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>{moodObj?.emoji || '📝'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{formatDisplay(entry.entry_date)}</span>
                          {dayStats && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: dayStats.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                              {dayStats.pnl >= 0 ? '+' : '-'}{symbol}{Math.abs(dayStats.pnl).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {preview && (
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                            {preview}{preview.length >= 70 ? '…' : ''}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>
        {/* ════════════════════ END SIDEBAR ════════════════════ */}

      </div>
    </div>
  )
}
