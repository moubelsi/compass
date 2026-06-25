'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronLeft, TrendingUp, TrendingDown, Plus, Target } from 'lucide-react'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { supabase } from '@/lib/supabase'

// ─── Calendar ─────────────────────────────────────────────────────────────────

function PnLCalendar({ trades }: { trades: any[] }) {
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
    days.push({ date: d.toISOString().split('T')[0], n: d.getDate() })

  const firstDow   = new Date(year, month, 1).getDay()
  const offset     = firstDow === 0 ? 6 : firstDow - 1
  const totalCells = Math.ceil((offset + days.length) / 7) * 7
  const cells: (typeof days[0] | null)[] = [
    ...Array(offset).fill(null),
    ...days,
    ...Array(totalCells - offset - days.length).fill(null),
  ]

  const monthTrades = trades.filter(t => {
    const d = (t.trade_date || t.created_at || '').split('T')[0]
    return days.length > 0 && d >= days[0].date && d <= days[days.length - 1].date
  })
  const monthPnl    = monthTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const monthReturn = monthTrades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const tradingDays = days.filter(d => dayMap[d.date]).length
  const maxAbs      = Math.max(...days.map(d => Math.abs(dayMap[d.date]?.pnl ?? 0)), 1)
  const todayStr    = today.toISOString().split('T')[0]
  const canNext     = new Date(year, month + 1, 1) <= today

  return (
    <div>
      {/* nav row */}
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

      {/* day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-disabled)', textAlign: 'center', letterSpacing: '0.04em', paddingBottom: 2 }}>{d}</div>
        ))}
      </div>

      {/* grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />
          const data     = dayMap[cell.date]
          const isToday  = cell.date === todayStr
          const isFuture = cell.date > todayStr
          const alpha    = data ? Math.max(0.1, Math.abs(data.pnl) / maxAbs) * 0.5 : 0
          const bg = data
            ? data.pnl >= 0 ? `rgba(61,153,112,${alpha})` : `rgba(192,57,43,${alpha})`
            : 'transparent'
          return (
            <div key={cell.date}
              title={data ? `${data.pnl >= 0 ? '+' : ''}$${data.pnl.toFixed(2)} · ${data.count}t` : undefined}
              style={{
                borderRadius: 4, padding: '5px 2px 4px', textAlign: 'center',
                background: bg,
                border: isToday ? '1.5px solid var(--accent)' : '1px solid transparent',
                opacity: isFuture ? 0.2 : 1,
                minHeight: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 1,
              }}>
              <span style={{ fontSize: 9.5, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : data ? 'var(--text-secondary)' : 'var(--text-disabled)', lineHeight: 1 }}>{cell.n}</span>
              {data && (
                <span style={{ fontSize: 8, fontWeight: 600, color: data.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginTop: 1 }}>
                  {data.pnl >= 0 ? '+' : ''}${Math.abs(data.pnl) >= 1000 ? (data.pnl / 1000).toFixed(1) + 'k' : data.pnl.toFixed(0)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Period = '1M' | '3M' | '6M' | 'All'
const PERIODS: Period[] = ['1M', '3M', '6M', 'All']

export default function DashboardPage() {
  const [trades, setTrades]             = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [period, setPeriod]             = useState<Period>('All')
  const [weeklyGoal, setWeeklyGoal]     = useState('')
  const [weeklyGoalMode, setWeeklyGoalMode] = useState<'dollar' | 'percent'>('dollar')
  const [accountSize, setAccountSize]   = useState('')
  const [editingGoal, setEditingGoal]   = useState(false)
  const [goalInput, setGoalInput]       = useState('')
  const [accountInput, setAccountInput] = useState('')

  useEffect(() => {
    const g = localStorage.getItem('weeklyGoal')
    const m = localStorage.getItem('weeklyGoalMode') as 'dollar' | 'percent' | null
    const a = localStorage.getItem('accountSize')
    if (g) setWeeklyGoal(g)
    if (m) setWeeklyGoalMode(m)
    if (a) setAccountSize(a)

    supabase.from('trades')
      .select('id, symbol, direction, strategy, pnl, return_pct, created_at, trade_date, trade_type, followed_plan, confidence, notes, screenshot_url')
      .order('trade_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTrades(data || []); setLoading(false) })
  }, [])

  // ── stats ──
  const totalTrades  = trades.length
  const wins         = trades.filter(t => Number(t.pnl) > 0)
  const losses       = trades.filter(t => Number(t.pnl) < 0)
  const winRate      = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0
  const totalReturn  = trades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const totalPnl     = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const grossProfit  = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss    = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

  // ── streak ──
  let currentStreak = 0, streakIsWin = false
  for (let i = 0; i < trades.length; i++) {
    const w = Number(trades[i].pnl) > 0
    if (currentStreak === 0) { streakIsWin = w; currentStreak = 1 }
    else if (w === streakIsWin) currentStreak++
    else break
  }

  // ── discipline ──
  const typedTrades = trades.filter(t => t.trade_type)
  const plannedPct  = typedTrades.length > 0 ? typedTrades.filter(t => t.trade_type === 'planned').length / typedTrades.length : 0
  const followedPct = totalTrades > 0 ? trades.filter(t => t.followed_plan).length / totalTrades : 0
  const confTrades  = trades.filter(t => t.confidence != null)
  const avgConf     = confTrades.length > 0 ? confTrades.reduce((s, t) => s + Number(t.confidence), 0) / confTrades.length : 0
  const journalPct  = totalTrades > 0 ? trades.filter(t => (t.notes && t.notes !== 'EMPTY') || (t.screenshot_url && t.screenshot_url !== 'EMPTY')).length / totalTrades : 0
  const disciplineScore = totalTrades > 0 ? Math.round(plannedPct * 40 + followedPct * 30 + (avgConf / 10) * 20 + journalPct * 10) : null
  const discColor   = disciplineScore == null ? 'var(--text-primary)' : disciplineScore >= 70 ? 'var(--profit)' : disciplineScore >= 40 ? '#B45309' : 'var(--loss)'

  // ── today ──
  const todayStr    = new Date().toDateString()
  const todayTrades = trades.filter(t => new Date(t.trade_date || t.created_at).toDateString() === todayStr)
  const todayPnl    = todayTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const todayReturn = todayTrades.reduce((s, t) => s + Number(t.return_pct || 0), 0)

  // ── equity curve ──
  const curveAll = [...trades].reverse()
  const curveTrades = period === 'All' ? curveAll : (() => {
    const days = period === '1M' ? 30 : period === '3M' ? 90 : 180
    const cutoff = new Date(Date.now() - days * 86400000)
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

  // ── insight ──
  const insightText = (() => {
    if (totalTrades === 0) return 'Log your first trade to unlock performance insights.'
    const planned   = trades.filter(t => t.trade_type === 'planned')
    const impulsive = trades.filter(t => t.trade_type === 'impulsive')
    if (planned.length + impulsive.length === 0)
      return `${totalTrades} trades logged. Tag trade type to unlock behaviour analysis.`
    const pWR = planned.length > 0   ? (planned.filter(t  => Number(t.pnl) > 0).length / planned.length   * 100).toFixed(0) : null
    const iWR = impulsive.length > 0  ? (impulsive.filter(t => Number(t.pnl) > 0).length / impulsive.length * 100).toFixed(0) : null
    if (pWR && iWR) return `Planned ${pWR}% WR (${planned.length}) vs Impulsive ${iWR}% WR (${impulsive.length}).`
    return `${planned.length + impulsive.length} of ${totalTrades} trades have type logged.`
  })()

  // ── weekly goal ──
  const now    = new Date()
  const dow    = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const weekTrades  = trades.filter(t => new Date(t.trade_date || t.created_at) >= monday)
  const weekPnl     = weekTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const weekReturn  = weekTrades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
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

      {/* ═══════════════════════════════════════════════════════════
          HERO — the return number IS the header
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '40px 56px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          {/* top row: greeting + actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{greeting}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {todayTrades.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: todayPnl >= 0 ? 'var(--profit-dim)' : 'var(--loss-dim)', border: `1px solid ${todayPnl >= 0 ? 'rgba(61,153,112,0.2)' : 'rgba(192,57,43,0.2)'}` }}>
                  {todayPnl >= 0 ? <TrendingUp size={12} style={{ color: 'var(--profit)' }} /> : <TrendingDown size={12} style={{ color: 'var(--loss)' }} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: todayPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                    {todayPnl >= 0 ? '+' : ''}${Math.abs(todayPnl).toFixed(2)} today
                  </span>
                  <span style={{ fontSize: 11, color: todayPnl >= 0 ? 'var(--profit)' : 'var(--loss)', opacity: 0.7 }}>
                    {todayReturn >= 0 ? '+' : ''}{todayReturn.toFixed(2)}%
                  </span>
                </div>
              )}
              <Link href="/journal" className="btn-secondary" style={{ fontSize: 12 }}>Journal</Link>
              <Link href="/trades/new" className="btn-primary" style={{ fontSize: 12 }}>
                <Plus size={12} strokeWidth={2.5} />Log trade
              </Link>
            </div>
          </div>

          {/* hero number */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 10 }}>
                <span style={{ fontSize: 64, fontWeight: 700, color: isUp ? 'var(--profit)' : 'var(--loss)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {isUp ? '+' : ''}{totalReturn.toFixed(2)}%
                </span>
                <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 400, letterSpacing: '-0.01em', paddingBottom: 4 }}>
                  all-time return
                </span>
              </div>
              {/* inline secondary stats — no cards, just text */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {[
                  { label: 'P&L',         value: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`,   color: isUp ? 'var(--profit)' : 'var(--loss)' },
                  { label: 'Win rate',    value: `${winRate.toFixed(1)}%`,      color: winRate >= 50 ? 'var(--profit)' : 'var(--loss)' },
                  { label: 'Trades',      value: String(totalTrades),           color: 'var(--text-primary)' },
                  { label: 'Profit factor', value: profitFactor > 0 ? `${profitFactor.toFixed(2)}×` : '—', color: 'var(--text-primary)' },
                  { label: 'Streak',      value: currentStreak > 0 ? `${currentStreak} ${streakIsWin ? 'W' : 'L'}` : '—', color: currentStreak > 0 ? (streakIsWin ? 'var(--profit)' : 'var(--loss)') : 'var(--text-primary)' },
                  { label: 'Discipline',  value: disciplineScore !== null ? String(disciplineScore) : '—', color: discColor },
                ].map((s, i, arr) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ padding: '0 20px', borderRight: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', ...(i === 0 ? { paddingLeft: 0 } : {}) }}>
                      <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                      <p style={{ fontSize: 18, fontWeight: 600, color: s.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Moneytaur quote — right-aligned, editorial */}
            <div style={{ textAlign: 'right', paddingBottom: 6, flexShrink: 0 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.06em', lineHeight: 1.9 }}>
                Find · Plan · Wait · Execute · Review · Repeat
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-disabled)', fontStyle: 'italic', marginTop: 2 }}>— Moneytaur</p>
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 56px 64px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Equity curve — full width, dominant ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Equity curve</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {PERIODS.map(p => (
                  <button key={p} onClick={() => setPeriod(p)} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: period === p ? 'var(--bg-overlay)' : 'transparent', color: period === p ? 'var(--text-primary)' : 'var(--text-muted)', border: period === p ? '1px solid var(--border-default)' : '1px solid transparent', transition: 'all 0.1s' }}>
                    {p}
                  </button>
                ))}
              </div>
              <Link href="/analytics" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                Full analytics <ChevronRight size={11} />
              </Link>
            </div>
          </div>
          <div className="card" style={{ padding: '28px 24px 12px', height: 340 }}>
            {equityData.length > 1 ? (
              <EquityCurve data={equityData} />
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>No equity data yet</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log trades to build your curve</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Middle row: Calendar + Recent trades ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>

          {/* Calendar */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>P&L calendar</p>
            <div className="card" style={{ padding: '18px 20px' }}>
              <PnLCalendar trades={trades} />
            </div>
          </div>

          {/* Recent trades */}
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
                      {up ? '+' : '-'}${Math.abs(Number(t.pnl)).toFixed(2)}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Bottom row: Weekly goal + Insight ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* Weekly goal */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={12} style={{ color: 'var(--text-muted)' }} />
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Weekly goal</p>
              </div>
              {!editingGoal && (
                <button onClick={() => { setGoalInput(weeklyGoal); setAccountInput(accountSize); setEditingGoal(true) }} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {weeklyGoal ? 'Edit' : 'Set goal'}
                </button>
              )}
            </div>

            {editingGoal ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 3, background: 'var(--bg-elevated)', borderRadius: 5, padding: 2, border: '1px solid var(--border-subtle)', alignSelf: 'flex-start' }}>
                  {(['dollar', 'percent'] as const).map(m => (
                    <button key={m} onClick={() => setWeeklyGoalMode(m)} style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: weeklyGoalMode === m ? 'var(--bg-surface)' : 'transparent', color: weeklyGoalMode === m ? 'var(--text-primary)' : 'var(--text-muted)', border: weeklyGoalMode === m ? '1px solid var(--border-subtle)' : '1px solid transparent' }}>
                      {m === 'dollar' ? '$ Fixed' : '% Account'}
                    </button>
                  ))}
                </div>
                <input className="input" type="number" placeholder={weeklyGoalMode === 'percent' ? '5  (= 5%)' : '500'} value={goalInput} onChange={e => setGoalInput(e.target.value)} style={{ fontSize: 13 }} autoFocus />
                {weeklyGoalMode === 'percent' && <input className="input" type="number" placeholder="Account size ($)" value={accountInput} onChange={e => setAccountInput(e.target.value)} style={{ fontSize: 13 }} />}
                {weeklyGoalMode === 'percent' && goalInput && accountInput && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>= ${(parseFloat(accountInput) * parseFloat(goalInput) / 100).toFixed(2)} target</p>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-primary" style={{ fontSize: 12, flex: 1 }} onClick={() => {
                    setWeeklyGoal(goalInput); localStorage.setItem('weeklyGoal', goalInput)
                    localStorage.setItem('weeklyGoalMode', weeklyGoalMode)
                    if (accountInput) { setAccountSize(accountInput); localStorage.setItem('accountSize', accountInput) }
                    setEditingGoal(false)
                  }}>Save</button>
                  <button style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setEditingGoal(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {/* Week numbers in a row */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: weekPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {weekPnl >= 0 ? '+' : '-'}${Math.abs(weekPnl).toFixed(2)}
                  </span>
                  {weekReturn !== 0 && (
                    <span style={{ fontSize: 13, fontWeight: 500, color: weekReturn >= 0 ? 'var(--profit)' : 'var(--loss)', opacity: 0.8 }}>
                      {weekReturn >= 0 ? '+' : ''}{weekReturn.toFixed(2)}%
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>this week</span>
                </div>
                {goalDollar > 0 ? (
                  <>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${goalProgress}%`, borderRadius: 2, background: goalProgress >= 100 ? 'var(--profit)' : 'var(--accent)', transition: 'width 0.5s ease' }} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ${weekPnl.toFixed(2)} of ${goalDollar.toFixed(2)}{weeklyGoalMode === 'percent' && weeklyGoal ? ` (${weeklyGoal}% goal)` : ''} &nbsp;·&nbsp;
                      <span style={{ fontWeight: 600, color: goalProgress >= 100 ? 'var(--profit)' : 'var(--text-secondary)' }}>{goalProgress.toFixed(0)}%</span>
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Set a weekly target to track your progress</p>
                )}
              </>
            )}
          </div>

          {/* Insight + Coach stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '18px 20px', borderLeft: '2px solid var(--ai-accent)', flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai-accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>Compass Insight</p>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{insightText}</p>
            </div>
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai-accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>AI Coach</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pattern analysis from your trade history</p>
              </div>
              <Link href="/coach" style={{ fontSize: 12, color: 'var(--ai-accent)', textDecoration: 'none', fontWeight: 600, flexShrink: 0, marginLeft: 16 }}>Open →</Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
