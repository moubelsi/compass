'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronLeft, Plus, X, Sparkles } from 'lucide-react'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { HydrationCard } from '@/components/dashboard/HydrationCard'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency, localDateStr } from '@/lib/utils'
import { fetchAllRows } from '@/lib/fetchAll'

// ─── Weekly focus (synced with Notebook) ─────────────────────────────────────

function isoWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7)
}

/** Slug of this week's Weekly Focus document in the Notebook */
function currentFocusSlug(): string {
  const now = new Date()
  return `focus-${now.getFullYear()}-${String(isoWeekNum(now)).padStart(2, '0')}`
}

// ─── P&L Calendar ────────────────────────────────────────────────────────────

function PnLCalendar({ trades, onDayClick }: { trades: any[]; onDayClick: (date: string) => void }) {
  const { symbol } = useCurrency()
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const dayMap: Record<string, { pnl: number; count: number }> = {}
  trades.forEach(t => {
    const d = (t.trade_date || t.created_at || '').split('T')[0]
    if (!d) return
    if (!dayMap[d]) dayMap[d] = { pnl: 0, count: 0 }
    dayMap[d].pnl   += Number(t.pnl || 0)
    dayMap[d].count += 1
  })

  const monthStart = new Date(year, month, 1)
  const monthEnd   = new Date(year, month + 1, 0)
  const days: { date: string; n: number }[] = []
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1))
    days.push({ date: localDateStr(d), n: d.getDate() })

  const firstDow   = new Date(year, month, 1).getDay()
  const offset     = firstDow === 0 ? 6 : firstDow - 1
  const totalCells = Math.ceil((offset + days.length) / 7) * 7
  const cells: (typeof days[0] | null)[] = [
    ...Array(offset).fill(null),
    ...days,
    ...Array(totalCells - offset - days.length).fill(null),
  ]

  const monthTrades  = trades.filter(t => {
    const d = (t.trade_date || t.created_at || '').split('T')[0]
    return days.length > 0 && d >= days[0].date && d <= days[days.length - 1].date
  })
  const monthPnl    = monthTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const monthReturn = monthTrades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const tradingDays = days.filter(d => dayMap[d.date]).length
  const maxAbs      = Math.max(...days.map(d => Math.abs(dayMap[d.date]?.pnl ?? 0)), 1)
  const todayStr    = localDateStr(today)
  const canNext     = new Date(year, month + 1, 1) <= today

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <ChevronLeft size={12} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 110 }}>
            {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => canNext && setViewDate(new Date(year, month + 1, 1))} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: canNext ? 'pointer' : 'default', color: canNext ? 'var(--text-muted)' : 'var(--border-default)', opacity: canNext ? 1 : 0.4 }}>
            <ChevronRight size={12} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: monthPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
            {monthPnl >= 0 ? '+' : ''}${monthPnl.toFixed(2)}
          </span>
          {monthReturn !== 0 && <span style={{ fontSize: 11, color: monthReturn >= 0 ? 'var(--profit)' : 'var(--loss)', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{monthReturn >= 0 ? '+' : ''}{monthReturn.toFixed(2)}%</span>}
          <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{tradingDays}d</span>
        </div>
      </div>

      {/* Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 52px', gap: 3, marginBottom: 3 }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-disabled)', textAlign: 'center', letterSpacing: '0.04em', paddingBottom: 2 }}>{d}</div>
        ))}
        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-disabled)', textAlign: 'center', letterSpacing: '0.04em', paddingBottom: 2 }}>Wk</div>
      </div>

      {/* Weeks with weekly total column */}
      {Array.from({ length: cells.length / 7 }, (_, wi) => {
        const week     = cells.slice(wi * 7, wi * 7 + 7)
        let wPnl = 0, wTrades = 0
        week.forEach(c => { if (c && dayMap[c.date]) { wPnl += dayMap[c.date].pnl; wTrades += dayMap[c.date].count } })
        return (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 52px', gap: 3, marginBottom: 3 }}>
            {week.map((cell, ci) => {
              if (!cell) return <div key={ci} />
              const data     = dayMap[cell.date]
              const isToday  = cell.date === todayStr
              const isFuture = cell.date > todayStr
              const alpha    = data ? Math.max(0.1, Math.abs(data.pnl) / maxAbs) * 0.5 : 0
              const bg = data
                ? data.pnl >= 0 ? `rgba(61,153,112,${alpha})` : `rgba(192,57,43,${alpha})`
                : 'transparent'
              return (
                <button key={cell.date}
                  onClick={() => !isFuture && onDayClick(cell.date)}
                  title={data ? `${data.pnl >= 0 ? '+' : ''}${symbol}${data.pnl.toFixed(2)} · ${data.count}t` : cell.date}
                  style={{ borderRadius: 4, padding: '5px 2px 4px', textAlign: 'center', background: bg, border: isToday ? '1.5px solid var(--accent)' : '1px solid transparent', opacity: isFuture ? 0.2 : 1, minHeight: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 1, cursor: isFuture ? 'default' : 'pointer', transition: 'filter 0.1s' }}
                  onMouseEnter={e => { if (!isFuture) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = '' }}>
                  <span style={{ fontSize: 9.5, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : data ? 'var(--text-secondary)' : 'var(--text-disabled)', lineHeight: 1 }}>{cell.n}</span>
                  {data && (
                    <span style={{ fontSize: 8, fontWeight: 600, color: data.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginTop: 1 }}>
                      {data.pnl >= 0 ? '+' : ''}{symbol}{Math.abs(data.pnl) >= 1000 ? (data.pnl / 1000).toFixed(1) + 'k' : data.pnl.toFixed(0)}
                    </span>
                  )}
                </button>
              )
            })}
            {/* Weekly total */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 36, borderRadius: 4, background: wTrades > 0 ? (wPnl >= 0 ? 'var(--profit-dim)' : 'var(--loss-dim)') : 'transparent' }}>
              {wTrades > 0 && (
                <>
                  <span style={{ fontSize: 8, fontWeight: 700, color: wPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {wPnl >= 0 ? '+' : ''}{symbol}{Math.abs(wPnl) >= 1000 ? (wPnl / 1000).toFixed(1) + 'k' : Math.abs(wPnl).toFixed(0)}
                  </span>
                  <span style={{ fontSize: 7.5, color: 'var(--text-disabled)', lineHeight: 1, marginTop: 2 }}>{wTrades}t</span>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Day slide-over ───────────────────────────────────────────────────────────

function DayPanel({ date, trades, entry, onClose }: {
  date: string
  trades: any[]
  entry: { mood: string | null; content: string | null; went_well: string | null; went_wrong: string | null; biggest_lesson: string | null; focus_tomorrow: string | null } | null
  onClose: () => void
}) {
  const { symbol } = useCurrency()
  const pnl     = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const ret     = trades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const wins    = trades.filter(t => Number(t.pnl) > 0)
  const winRate = trades.length > 0 ? Math.round(wins.length / trades.length * 100) : 0
  const d       = new Date(date + 'T12:00:00')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 51, width: 460, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '-16px 0 40px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{d.toLocaleDateString('en-US', { weekday: 'long' })}</p>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>{d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          </div>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Stats */}
          {trades.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'P&L',    value: formatCurrency(pnl, true, symbol),       color: pnl >= 0 ? 'var(--profit)' : 'var(--loss)' },
                { label: 'Return', value: `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%`,                  color: ret >= 0 ? 'var(--profit)' : 'var(--loss)' },
                { label: 'Trades', value: String(trades.length),                                        color: 'var(--text-primary)' },
                { label: 'Win %',  value: `${winRate}%`,                                                color: winRate >= 50 ? 'var(--profit)' : 'var(--loss)' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: s.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Trades */}
          {trades.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Trades</p>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                {trades.map((t, i) => {
                  const up = Number(t.pnl) >= 0
                  return (
                    <Link key={t.id} href={`/trades/${t.id}`}
                      style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: i < trades.length - 1 ? '1px solid var(--border-subtle)' : 'none', textDecoration: 'none', background: 'var(--bg-elevated)', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.symbol?.toUpperCase()}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)', letterSpacing: '0.04em' }}>{t.direction}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: up ? 'var(--profit-dim)' : 'var(--loss-dim)', color: up ? 'var(--profit)' : 'var(--loss)', letterSpacing: '0.04em' }}>{up ? 'WIN' : 'LOSS'}</span>
                        </div>
                        {t.strategy && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.strategy}</span>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                        {t.return_pct != null ? `${Number(t.return_pct) >= 0 ? '+' : ''}${Number(t.return_pct).toFixed(2)}%` : '—'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', minWidth: 68, textAlign: 'right' }}>
                        {formatCurrency(Number(t.pnl), true, symbol)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {trades.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No trades on this day</p>
          )}

          {/* Journal */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Journal</p>
              <Link href={`/journal?date=${date}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Edit →</Link>
            </div>
            {entry ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entry.mood && <span style={{ fontSize: 20 }}>{entry.mood}</span>}
                {[
                  { label: 'Notes',          value: entry.content },
                  { label: 'Went well',      value: entry.went_well },
                  { label: 'Went wrong',     value: entry.went_wrong },
                  { label: 'Biggest lesson', value: entry.biggest_lesson },
                  { label: 'Focus tomorrow', value: entry.focus_tomorrow },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{f.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No entry for this day</p>
                <Link href={`/journal?date=${date}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Write →</Link>
              </div>
            )}
          </div>

          {/* AI placeholder */}
          <div style={{ padding: '14px 18px', borderRadius: 8, background: 'var(--ai-dim)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <Sparkles size={12} style={{ color: 'var(--ai-accent)' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai-accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI Day Summary</p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ai-accent)', opacity: 0.7 }}>AI summaries will appear here once enabled.</p>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Daily limit widget ───────────────────────────────────────────────────────

interface SessionConfig {
  dailyLimit: number | null
  dailyLossLimit: number | null
  weeklyGoal: string
  weeklyGoalMode: 'dollar' | 'percent'
  accountSize: string
}

/**
 * The premium status bar answering "can I still trade today?" at a glance:
 * session status, trade count, daily loss and weekly goal in one container
 * with thin dividers and 3px progress bars. All limits are configured inline.
 */
function TradingSession({ symbol, todayCount, todayPnl, weekPnl, goalDollar, goalProgress, dailyLimit, dailyLossLimit, weeklyGoal, weeklyGoalMode, accountSize, onConfigSaved }: {
  symbol: string
  todayCount: number
  todayPnl: number
  weekPnl: number
  goalDollar: number
  goalProgress: number
  weeklyGoal: string
  weeklyGoalMode: 'dollar' | 'percent'
  accountSize: string
  dailyLimit: number | null
  dailyLossLimit: number | null
  onConfigSaved: (c: SessionConfig) => void
}) {
  const [configuring, setConfiguring] = useState(false)
  const [limitIn, setLimitIn] = useState('')
  const [lossIn,  setLossIn]  = useState('')
  const [goalIn,  setGoalIn]  = useState('')
  const [modeIn,  setModeIn]  = useState<'dollar' | 'percent'>('dollar')
  const [acctIn,  setAcctIn]  = useState('')

  const lossToday = Math.max(0, -todayPnl)
  const tradesPct = dailyLimit ? Math.min((todayCount / dailyLimit) * 100, 100) : 0
  const lossPct   = dailyLossLimit ? Math.min((lossToday / dailyLossLimit) * 100, 100) : 0

  const limitReached =
    (dailyLimit != null && todayCount >= dailyLimit) ||
    (dailyLossLimit != null && lossToday >= dailyLossLimit)
  const oneLeft   = !limitReached && dailyLimit != null && dailyLimit - todayCount === 1
  const hasLimits = dailyLimit != null || dailyLossLimit != null
  const status = !hasLimits
    ? { color: 'var(--text-disabled)', label: 'No limits set' }
    : limitReached ? { color: 'var(--loss)',   label: 'Limit reached' }
    : oneLeft      ? { color: '#B45309',       label: 'One trade left' }
    :                { color: 'var(--profit)', label: 'Safe' }

  const zoneLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }
  const zoneValue: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.2 }
  const barTrack: React.CSSProperties  = { height: 3, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden', marginTop: 10 }
  const zone: React.CSSProperties      = { flex: 1, padding: '2px 28px', borderLeft: '1px solid var(--border-subtle)' }
  const dim = (text: string) => <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{text}</span>

  function openConfig() {
    setLimitIn(dailyLimit != null ? String(dailyLimit) : '')
    setLossIn(dailyLossLimit != null ? String(dailyLossLimit) : '')
    setGoalIn(weeklyGoal)
    setModeIn(weeklyGoalMode)
    setAcctIn(accountSize)
    setConfiguring(true)
  }

  function save() {
    const dl = parseInt(limitIn)
    const ll = parseFloat(lossIn)
    const next: SessionConfig = {
      dailyLimit: dl > 0 ? dl : null,
      dailyLossLimit: ll > 0 ? ll : null,
      weeklyGoal: goalIn,
      weeklyGoalMode: modeIn,
      accountSize: acctIn,
    }
    if (next.dailyLimit != null) localStorage.setItem('dailyTradeLimit', String(next.dailyLimit)); else localStorage.removeItem('dailyTradeLimit')
    if (next.dailyLossLimit != null) localStorage.setItem('dailyLossLimit', String(next.dailyLossLimit)); else localStorage.removeItem('dailyLossLimit')
    if (goalIn) localStorage.setItem('weeklyGoal', goalIn); else localStorage.removeItem('weeklyGoal')
    localStorage.setItem('weeklyGoalMode', modeIn)
    if (acctIn) localStorage.setItem('accountSize', acctIn)
    onConfigSaved(next)
    setConfiguring(false)
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Trading session</p>
        <button onClick={() => (configuring ? setConfiguring(false) : openConfig())}
          style={{ fontSize: 11, color: configuring ? 'var(--text-muted)' : 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {configuring ? 'Cancel' : 'Configure'}
        </button>
      </div>

      {configuring ? (
        <div>
          <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={zoneLabel}>Max trades / day</label>
              <input className="input tabular-nums" type="number" min="1" max="20" placeholder="3" value={limitIn} onChange={e => setLimitIn(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div>
              <label style={zoneLabel}>Max loss / day ({symbol})</label>
              <input className="input tabular-nums" type="number" step="any" min="0" placeholder="50" value={lossIn} onChange={e => setLossIn(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div>
              <label style={zoneLabel}>Weekly goal {modeIn === 'percent' ? '(%)' : `(${symbol})`}</label>
              <input className="input tabular-nums" type="number" step="any" min="0" placeholder={modeIn === 'percent' ? '5' : '250'} value={goalIn} onChange={e => setGoalIn(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div>
              <label style={zoneLabel}>Goal type</label>
              <select className="input" value={modeIn} onChange={e => setModeIn(e.target.value as 'dollar' | 'percent')} style={{ fontSize: 13 }}>
                <option value="dollar">Fixed amount</option>
                <option value="percent">% of account</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            {modeIn === 'percent' && (
              <div style={{ width: 200 }}>
                <label style={zoneLabel}>Account size ({symbol})</label>
                <input className="input tabular-nums" type="number" step="any" min="0" placeholder="10000" value={acctIn} onChange={e => setAcctIn(e.target.value)} style={{ fontSize: 13 }} />
              </div>
            )}
            <button className="btn-primary" style={{ fontSize: 12 }} onClick={save}>Save</button>
          </div>
        </div>
      ) : (
        <div className="session-row" style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Status */}
          <div style={{ paddingRight: 28, minWidth: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{status.label}</span>
            </div>
            {limitReached && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>Protect your discipline — stop for today</p>}
          </div>

          {/* Trades */}
          <div style={zone}>
            <p style={zoneLabel}>Trades</p>
            <p style={{ ...zoneValue, color: dailyLimit != null && todayCount >= dailyLimit ? 'var(--loss)' : 'var(--text-primary)' }}>
              {todayCount}{dailyLimit != null && dim(` / ${dailyLimit}`)}
            </p>
            {dailyLimit != null && (
              <div style={barTrack}>
                <div style={{ height: '100%', width: `${tradesPct}%`, borderRadius: 2, background: todayCount >= dailyLimit ? 'var(--loss)' : oneLeft ? '#B45309' : 'var(--accent)', transition: 'width 0.4s ease' }} />
              </div>
            )}
          </div>

          {/* Daily loss */}
          <div style={zone}>
            <p style={zoneLabel}>Daily loss</p>
            <p style={{ ...zoneValue, color: dailyLossLimit != null && lossToday >= dailyLossLimit ? 'var(--loss)' : 'var(--text-primary)' }}>
              {dailyLossLimit != null
                ? <>{symbol}{lossToday.toFixed(2)}{dim(` / ${symbol}${dailyLossLimit.toFixed(0)}`)}</>
                : <span style={{ color: 'var(--text-disabled)', fontWeight: 400 }}>No limit</span>}
            </p>
            {dailyLossLimit != null && (
              <div style={barTrack}>
                <div style={{ height: '100%', width: `${lossPct}%`, borderRadius: 2, background: lossPct >= 100 ? 'var(--loss)' : lossPct >= 60 ? '#B45309' : 'var(--accent)', transition: 'width 0.4s ease' }} />
              </div>
            )}
          </div>

          {/* Weekly goal */}
          <div style={zone}>
            <p style={zoneLabel}>Weekly goal</p>
            <p style={{ ...zoneValue, color: weekPnl < 0 ? 'var(--loss)' : 'var(--text-primary)' }}>
              {goalDollar > 0
                ? <>{formatCurrency(weekPnl, true, symbol)}{dim(` / ${symbol}${goalDollar.toFixed(0)}`)}</>
                : <span style={{ color: 'var(--text-disabled)', fontWeight: 400 }}>No goal set</span>}
            </p>
            {goalDollar > 0 && (
              <div style={barTrack}>
                <div style={{ height: '100%', width: `${goalProgress}%`, borderRadius: 2, background: goalProgress >= 100 ? 'var(--profit)' : 'var(--accent)', transition: 'width 0.4s ease' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Period = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All'
const PERIODS: Period[] = ['1W', '1M', '3M', '6M', '1Y', 'All']

export default function DashboardPage() {
  const { symbol }                        = useCurrency()
  const [trades, setTrades]               = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [period, setPeriod]               = useState<Period>('All')
  const [weeklyGoal, setWeeklyGoal]       = useState('')
  const [weeklyGoalMode, setWeeklyGoalMode] = useState<'dollar' | 'percent'>('dollar')
  const [accountSize, setAccountSize]     = useState('')
  const [dailyLimit, setDailyLimit]       = useState<number | null>(null)
  const [dailyLossLimit, setDailyLossLimit] = useState<number | null>(null)
  const [selectedDay, setSelectedDay]     = useState<string | null>(null)
  const [dayEntry, setDayEntry]           = useState<any>(null)
  const [weeklyFocus, setWeeklyFocus]     = useState<string | null>(null)

  useEffect(() => {
    if (!selectedDay) return
    supabase.from('journal_entries').select('mood, content, went_well, went_wrong, biggest_lesson, focus_tomorrow').eq('entry_date', selectedDay).maybeSingle()
      .then(({ data }) => setDayEntry(data ?? null))
  }, [selectedDay])

  useEffect(() => {
    const g = localStorage.getItem('weeklyGoal')
    const m = localStorage.getItem('weeklyGoalMode') as 'dollar' | 'percent' | null
    const a = localStorage.getItem('accountSize')
    const l = localStorage.getItem('dailyTradeLimit')
    const ll = localStorage.getItem('dailyLossLimit')
    if (g) setWeeklyGoal(g)
    if (m) setWeeklyGoalMode(m)
    if (a) setAccountSize(a)
    if (l) setDailyLimit(parseInt(l))
    if (ll) setDailyLossLimit(parseFloat(ll))

    fetchAllRows((from, to) => supabase.from('trades')
      .select('id, symbol, direction, strategy, pnl, return_pct, created_at, trade_date')
      .order('trade_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to))
      .then(data => { setTrades(data); setLoading(false) })
      .catch(() => setLoading(false))

    supabase.from('notebook_pages')
      .select('content')
      .eq('slug', currentFocusSlug())
      .maybeSingle()
      .then(({ data }) => setWeeklyFocus(data?.content ?? null))
  }, [])

  // ── All-time stats ──
  const totalTrades  = trades.length
  const wins         = trades.filter(t => Number(t.pnl) > 0)
  const losses       = trades.filter(t => Number(t.pnl) < 0)
  const winRate      = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0
  const totalReturn  = trades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const grossProfit  = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss    = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

  // ── Today ──
  const todayStr    = new Date().toDateString()
  const todayTrades = trades.filter(t => new Date(t.trade_date || t.created_at).toDateString() === todayStr)
  const todayPnl    = todayTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const todayReturn = todayTrades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const todayWins   = todayTrades.filter(t => Number(t.pnl) > 0)
  const todayWinPct = todayTrades.length > 0 ? Math.round(todayWins.length / todayTrades.length * 100) : 0
  const todayBest   = todayTrades.length > 0 ? Math.max(...todayTrades.map(t => Number(t.pnl || 0))) : null

  // ── Equity curve ──
  const curveAll = [...trades].reverse()
  const curveTrades = period === 'All' ? curveAll : (() => {
    const daysMap: Record<Period, number> = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'All': 0 }
    const cutoff = new Date(Date.now() - daysMap[period] * 86400000)
    return curveAll.filter(t => new Date(t.trade_date || t.created_at) >= cutoff)
  })()
  const equityData = curveTrades.reduce((acc: any[], t, i) => {
    const prev = acc[i - 1] || { value: 0, pnl: 0 }
    acc.push({
      date:  new Date(t.trade_date || t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: prev.value + Number(t.return_pct || 0),
      pnl:   prev.pnl   + Number(t.pnl || 0),
    })
    return acc
  }, [])

  // ── Weekly goal ──
  const now    = new Date()
  const dow    = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const weekTrades  = trades.filter(t => new Date(t.trade_date || t.created_at) >= monday)
  const weekPnl     = weekTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const acctNum     = parseFloat(accountSize)
  const goalDollar  = weeklyGoalMode === 'percent' && acctNum > 0
    ? acctNum * parseFloat(weeklyGoal) / 100
    : parseFloat(weeklyGoal)
  const goalProgress = goalDollar > 0 ? Math.min((weekPnl / goalDollar) * 100, 100) : 0

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const recentTrades = trades.slice(0, 7)

  if (loading) return <div style={{ padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  const isUp = totalReturn >= 0

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* ── Page header ── */}
      <div className="m-pad" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '40px 56px 28px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 40 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>{greeting}</p>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Dashboard</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Focus on today. Execute your plan.</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
              <Link href="/journal" className="btn-secondary" style={{ fontSize: 12 }}>Journal</Link>
              <Link href="/trades/new" className="btn-primary" style={{ fontSize: 12 }}>
                <Plus size={12} strokeWidth={2.5} />Log trade
              </Link>
            </div>
            <p className="m-hide" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Find · Plan · Wait · Execute · Review · Repeat</p>
            <p className="m-hide" style={{ fontSize: 10, color: 'var(--text-disabled)', fontStyle: 'italic', marginTop: 2 }}>— Moneytaur</p>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="m-pad" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 56px 64px', display: 'flex', flexDirection: 'column', gap: 40 }}>

        {/* 1 · Can I still trade today? */}
        <TradingSession
          symbol={symbol}
          todayCount={todayTrades.length}
          todayPnl={todayPnl}
          weekPnl={weekPnl}
          goalDollar={goalDollar}
          goalProgress={goalProgress}
          weeklyGoal={weeklyGoal}
          weeklyGoalMode={weeklyGoalMode}
          accountSize={accountSize}
          dailyLimit={dailyLimit}
          dailyLossLimit={dailyLossLimit}
          onConfigSaved={c => {
            setDailyLimit(c.dailyLimit)
            setDailyLossLimit(c.dailyLossLimit)
            setWeeklyGoal(c.weeklyGoal)
            setWeeklyGoalMode(c.weeklyGoalMode)
            if (c.accountSize) setAccountSize(c.accountSize)
          }}
        />

        {/* 2 · How is today going?  /  weekly focus  /  3 · overall */}
        <div className="m-grid-1 today-split" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr' }}>
          <div style={{ paddingRight: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Today</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: todayTrades.length > 0 ? 20 : 10 }}>
              <span style={{ fontSize: 30, fontWeight: 600, color: todayTrades.length === 0 ? 'var(--text-disabled)' : todayPnl >= 0 ? 'var(--profit)' : 'var(--loss)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {formatCurrency(todayPnl, true, symbol)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>P&L today</span>
            </div>
            {todayTrades.length > 0 ? (
              <div style={{ display: 'flex' }}>
                {[
                  { label: 'Win rate',   value: `${todayWinPct}%`, color: todayWinPct >= 50 ? 'var(--profit)' : 'var(--loss)' },
                  { label: 'Return',     value: `${todayReturn >= 0 ? '+' : ''}${todayReturn.toFixed(2)}%`, color: todayReturn >= 0 ? 'var(--profit)' : 'var(--loss)' },
                  { label: 'Best trade', value: todayBest != null ? formatCurrency(todayBest, true, symbol) : '—', color: todayBest != null && todayBest > 0 ? 'var(--profit)' : 'var(--text-primary)' },
                ].map((s, i, arr) => (
                  <div key={s.label} style={{ padding: '0 24px', borderRight: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', ...(i === 0 ? { paddingLeft: 0 } : {}) }}>
                    <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>{s.label}</p>
                    <p style={{ fontSize: 18, fontWeight: 600, color: s.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>No trades yet today</p>
            )}
          </div>

          {/* Weekly focus — mirrors this week's Notebook document */}
          <div className="alltime-block" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 36, paddingRight: 36 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Weekly focus</p>
              <Link href={`/notebook?folder=weekly-focus&note=${currentFocusSlug()}`} style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
                {weeklyFocus ? 'Edit →' : 'Set →'}
              </Link>
            </div>
            {weeklyFocus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weeklyFocus
                  .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
                  .split('\n')
                  .map(l => l.trim())
                  .filter(Boolean)
                  .slice(0, 5)
                  .map((line, i) => {
                    const bullet = line.match(/^[-*]\s+(.*)/)
                    const text = (bullet ? bullet[1] : line).replace(/^#{1,3}\s*/, '').replace(/[#*`]/g, '').trim()
                    return (
                      <p key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', display: 'flex', gap: 9 }}>
                        {bullet && <span style={{ color: 'var(--text-disabled)', flexShrink: 0 }}>·</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
                      </p>
                    )
                  })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>No focus set for this week</p>
            )}
          </div>

          {/* All-time snapshot — deliberately quieter */}
          <div className="alltime-block" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>All-time</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
              {[
                { label: 'Return',        value: `${isUp ? '+' : ''}${totalReturn.toFixed(2)}%`, color: isUp ? 'var(--profit)' : 'var(--loss)' },
                { label: 'Trades',        value: String(totalTrades), color: undefined },
                { label: 'Win rate',      value: `${winRate.toFixed(1)}%`, color: undefined },
                { label: 'Profit factor', value: profitFactor > 0 ? `${profitFactor.toFixed(2)}×` : '—', color: undefined },
              ].map(s => (
                <div key={s.label}>
                  <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-disabled)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: s.color ?? 'var(--text-secondary)', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Equity curve */}
        <div>
          <div className="m-wrap" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 2 }}>Equity curve</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cumulative % return per trade</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {PERIODS.map(p => (
                  <button key={p} onClick={() => setPeriod(p)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: period === p ? 'var(--bg-overlay)' : 'transparent', color: period === p ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${period === p ? 'var(--border-default)' : 'transparent'}`, transition: 'all 0.1s' }}>
                    {p}
                  </button>
                ))}
              </div>
              <Link href="/analytics" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                Full analytics <ChevronRight size={11} />
              </Link>
            </div>
          </div>
          <div className="card" style={{ padding: '20px 16px 10px', height: 320 }}>
            {equityData.length > 1 ? (
              <EquityCurve data={equityData} currencySymbol={symbol} />
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>No equity data yet</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log trades to build your curve</p>
              </div>
            )}
          </div>
        </div>

        {/* Middle: Calendar + Recent trades */}
        <div className="m-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>P&L calendar</p>
            <div className="card" style={{ padding: '18px 20px' }}>
              <PnLCalendar trades={trades} onDayClick={date => { setSelectedDay(date); setDayEntry(null) }} />
            </div>
            <div style={{ marginTop: 16 }}>
              <HydrationCard />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recent trades</p>
              <Link href="/trades" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                All trades <ChevronRight size={11} />
              </Link>
            </div>
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              {recentTrades.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>No trades yet</p>
                  <Link href="/trades/new" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Log your first trade →</Link>
                </div>
              ) : recentTrades.map((t, i) => {
                const up = Number(t.pnl) >= 0
                return (
                  <Link key={t.id} href={`/trades/${t.id}`}
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 16, padding: '13px 18px', borderBottom: i < recentTrades.length - 1 ? '1px solid var(--border-subtle)' : 'none', textDecoration: 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.symbol?.toUpperCase()}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)', letterSpacing: '0.04em' }}>{t.direction}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: up ? 'var(--profit-dim)' : 'var(--loss-dim)', color: up ? 'var(--profit)' : 'var(--loss)', letterSpacing: '0.04em' }}>{up ? 'WIN' : 'LOSS'}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.strategy || '—'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {new Date(t.trade_date || t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {t.return_pct != null ? `${Number(t.return_pct) >= 0 ? '+' : ''}${Number(t.return_pct).toFixed(2)}%` : '—'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 72 }}>
                      {formatCurrency(Number(t.pnl), true, symbol)}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* AI Coach */}
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai-accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>AI Coach</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pattern analysis from your trade history</p>
          </div>
          <Link href="/coach" style={{ fontSize: 12, color: 'var(--ai-accent)', textDecoration: 'none', fontWeight: 600, flexShrink: 0, marginLeft: 16 }}>Open →</Link>
        </div>
      </div>

      {selectedDay && (
        <DayPanel
          date={selectedDay}
          trades={trades.filter(t => (t.trade_date || t.created_at?.split('T')[0]) === selectedDay)}
          entry={dayEntry}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
