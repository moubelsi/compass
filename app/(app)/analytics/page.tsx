'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { computeDiscipline } from '@/lib/discipline'

// Shape helpers replacing deprecated <Cell> — color each bar based on its value
function pnlBarShape(props: any) {
  const { x, y, width, height } = props
  if (!width || !height) return null
  const fill = Number(props.value) >= 0 ? 'var(--profit)' : 'var(--loss)'
  return <rect x={x} y={y} width={width} height={height} rx={3} fill={fill} fillOpacity={0.8} />
}

function winRateBarShape(props: any) {
  const { x, y, width, height } = props
  if (!width || !height) return null
  const fill = Number(props.value) >= 50 ? 'var(--profit)' : 'var(--loss)'
  return <rect x={x} y={y} width={width} height={height} rx={3} fill={fill} fillOpacity={0.8} />
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 600, color: color ?? 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

function PnlTooltip({ active, payload, label, symbol = '$' }: any) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value as number
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 12px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: v >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(v, true, symbol)}
      </p>
    </div>
  )
}

function MonthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 12px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ fontSize: 13, fontWeight: 500, color: p.name === 'Wins' ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function BarTooltip({ active, payload, label, symbol = '$' }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 12px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ fontSize: 13, fontWeight: 500, color: p.value >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
          {p.name === 'winRate' ? `${p.value.toFixed(1)}%` : formatCurrency(p.value, true, symbol)}
        </p>
      ))}
    </div>
  )
}

type Period = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All'
const PERIODS: Period[] = ['1W', '1M', '3M', '6M', '1Y', 'All']

function filterByPeriod(trades: any[], p: Period) {
  if (p === 'All') return trades
  const days = p === '1W' ? 7 : p === '1M' ? 30 : p === '3M' ? 90 : p === '6M' ? 180 : 365
  const cutoff = new Date(Date.now() - days * 86400000)
  return trades.filter(t => new Date(t.trade_date || t.created_at) >= cutoff)
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</h2>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const { symbol }                = useCurrency()
  const [allTrades, setAllTrades] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [period, setPeriod]       = useState<Period>('All')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('id, symbol, direction, pnl, rr, return_pct, strategy, created_at, trade_date, trade_type, confidence, followed_plan, notes, screenshot_url')
        .order('trade_date', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true })
      setAllTrades(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>

  const trades = filterByPeriod(allTrades, period)

  const totalTrades  = trades.length
  const wins         = trades.filter(t => Number(t.pnl) > 0)
  const losses       = trades.filter(t => Number(t.pnl) < 0)
  const winRate      = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0
  const totalPnl     = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const totalReturn  = trades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const grossProfit  = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss    = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
  const avgWin       = wins.length > 0 ? grossProfit / wins.length : 0
  const avgLoss      = losses.length > 0 ? grossLoss / losses.length : 0
  const avgRR        = totalTrades > 0 ? trades.reduce((s, t) => s + Number(t.rr || 0), 0) / totalTrades : 0
  const bestTrade    = trades.reduce((best, t) => Number(t.pnl) > Number(best.pnl) ? t : best, trades[0] || {})
  const worstTrade   = trades.reduce((worst, t) => Number(t.pnl) < Number(worst.pnl) ? t : worst, trades[0] || {})

  // Equity curve data
  const equityData = trades.reduce((acc: any[], trade, i) => {
    const prev = acc[i - 1] || { value: 0, pnl: 0 }
    acc.push({
      date:  new Date(trade.trade_date || trade.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: prev.value + Number(trade.return_pct || 0),
      pnl:   prev.pnl   + Number(trade.pnl || 0),
    })
    return acc
  }, [])

  // Max drawdown
  let peak = 0, maxDrawdown = 0
  equityData.forEach(d => {
    if (d.value > peak) peak = d.value
    const dd = peak - d.value
    if (dd > maxDrawdown) maxDrawdown = dd
  })

  // Streaks
  let currentStreak = 0, streakIsWin = false
  for (let i = trades.length - 1; i >= 0; i--) {
    const w = Number(trades[i].pnl) > 0
    if (currentStreak === 0) { streakIsWin = w; currentStreak = 1 }
    else if (w === streakIsWin) currentStreak++
    else break
  }
  let bestWinStreak = 0, run = 0
  trades.forEach(t => {
    if (Number(t.pnl) > 0) { run++; if (run > bestWinStreak) bestWinStreak = run }
    else run = 0
  })

  // Calendar heatmap
  const calMap: Record<string, { pnl: number; trades: number }> = {}
  trades.forEach(t => {
    const date = t.trade_date || t.created_at?.split('T')[0]
    if (!date) return
    if (!calMap[date]) calMap[date] = { pnl: 0, trades: 0 }
    calMap[date].pnl += Number(t.pnl || 0)
    calMap[date].trades++
  })
  const calendarData = Object.entries(calMap).map(([date, v]) => ({ date, ...v }))

  // P&L by strategy
  const byStrategy = trades.reduce((acc: any, t) => {
    const s = t.strategy || 'Unknown'
    if (!acc[s]) acc[s] = { name: s, pnl: 0, trades: 0, wins: 0 }
    acc[s].pnl += Number(t.pnl || 0)
    acc[s].trades++
    if (Number(t.pnl) > 0) acc[s].wins++
    return acc
  }, {})
  const strategyData    = Object.values(byStrategy).sort((a: any, b: any) => b.pnl - a.pnl) as any[]
  const strategyWinRate = strategyData.map((s: any) => ({
    name:    s.name,
    winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
    trades:  s.trades,
  }))

  // P&L by day of week
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const byDay = DAYS.map(day => ({ name: day, pnl: 0, trades: 0, wins: 0 }))
  trades.forEach(t => {
    const day = new Date(t.trade_date || t.created_at).getDay()
    byDay[day].pnl += Number(t.pnl || 0)
    byDay[day].trades++
    if (Number(t.pnl) > 0) byDay[day].wins++
  })
  const dayData = byDay.filter(d => d.trades > 0).map(d => ({ ...d, winRate: (d.wins / d.trades) * 100 }))

  // P&L by hour of day
  const byHour: Record<number, { pnl: number; trades: number }> = {}
  trades.forEach(t => {
    const h = new Date(t.created_at).getHours()
    if (!byHour[h]) byHour[h] = { pnl: 0, trades: 0 }
    byHour[h].pnl += Number(t.pnl || 0)
    byHour[h].trades++
  })
  const hourData = Object.entries(byHour)
    .map(([h, v]) => ({ name: `${h}:00`, hour: Number(h), ...v }))
    .sort((a, b) => a.hour - b.hour)

  // Monthly data — P&L and win/loss count
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthMap: Record<string, { name: string; wins: number; losses: number; pnl: number }> = {}
  trades.forEach(t => {
    const d = new Date(t.trade_date || t.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    if (!monthMap[key]) monthMap[key] = { name: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, wins: 0, losses: 0, pnl: 0 }
    monthMap[key].pnl += Number(t.pnl || 0)
    if (Number(t.pnl) > 0) monthMap[key].wins++
    else monthMap[key].losses++
  })
  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)

  // Symbol breakdown
  const symMap: Record<string, { name: string; count: number; wins: number; losses: number; pnl: number }> = {}
  trades.forEach(t => {
    const sym = (t.symbol || 'Unknown').toUpperCase()
    if (!symMap[sym]) symMap[sym] = { name: sym, count: 0, wins: 0, losses: 0, pnl: 0 }
    symMap[sym].count++
    if (Number(t.pnl) > 0) symMap[sym].wins++
    else symMap[sym].losses++
    symMap[sym].pnl += Number(t.pnl || 0)
  })
  const symbolData = Object.values(symMap).sort((a, b) => b.count - a.count)

  // Long vs Short
  const longs  = trades.filter(t => t.direction === 'LONG')
  const shorts = trades.filter(t => t.direction === 'SHORT')

  // Behaviour
  function bStats(group: any[]) {
    const w = group.filter(t => Number(t.pnl) > 0)
    const totalRet = group.reduce((s, t) => s + Number(t.return_pct || 0), 0)
    return { count: group.length, winRate: group.length > 0 ? (w.length / group.length) * 100 : 0, totalReturn: totalRet, avgReturn: group.length > 0 ? totalRet / group.length : 0 }
  }
  const planned         = trades.filter(t => t.trade_type === 'planned')
  const impulsive       = trades.filter(t => t.trade_type === 'impulsive')
  const hasBehaviourData = planned.length + impulsive.length > 0
  const plannedStats    = bStats(planned)
  const impulsiveStats  = bStats(impulsive)

  const confTrades = trades.filter(t => t.confidence != null)
  const hasConfidenceData = confTrades.length > 0
  const confBands = [
    { label: 'Low',  range: '1–4',  group: confTrades.filter(t => Number(t.confidence) <= 4) },
    { label: 'Mid',  range: '5–7',  group: confTrades.filter(t => Number(t.confidence) >= 5 && Number(t.confidence) <= 7) },
    { label: 'High', range: '8–10', group: confTrades.filter(t => Number(t.confidence) >= 8) },
  ].map(b => ({ ...b, ...bStats(b.group) }))

  // Discipline
  const disc            = computeDiscipline(trades)
  const disciplineScore = disc.score
  const discColor       = disciplineScore == null ? 'var(--text-primary)' : disciplineScore >= 70 ? 'var(--profit)' : disciplineScore >= 40 ? '#B45309' : 'var(--loss)'
  const pctColor        = (pct: number) => totalTrades === 0 ? 'var(--text-primary)' : pct >= 0.8 ? 'var(--profit)' : pct >= 0.5 ? '#B45309' : 'var(--loss)'
  const insightText     = (() => {
    if (allTrades.length === 0) return 'Log your first trade to unlock performance insights.'
    if (totalTrades === 0) return 'No trades in this period. Pick a wider range to see insights.'
    if (!hasBehaviourData) return `${totalTrades} trades logged. Tag trade type to unlock behaviour analysis.`
    if (planned.length > 0 && impulsive.length > 0)
      return `Planned ${plannedStats.winRate.toFixed(0)}% WR (${planned.length}) vs Impulsive ${impulsiveStats.winRate.toFixed(0)}% WR (${impulsive.length}).`
    return `${disc.typedCount} of ${totalTrades} trades have type logged.`
  })()

  const chartShared = {
    cartesian: <CartesianGrid strokeDasharray="0" stroke="var(--border-subtle)" vertical={false} />,
    xProps: { tick: { fill: 'var(--text-muted)', fontSize: 11 }, axisLine: false, tickLine: false },
    yProps: { tick: { fill: 'var(--text-muted)', fontSize: 11 }, axisLine: false, tickLine: false },
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '40px 56px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>Analytics</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {totalTrades} trade{totalTrades !== 1 ? 's' : ''}
              {period !== 'All' && <span style={{ color: 'var(--text-disabled)' }}> · {allTrades.length} total</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: period === p ? 'var(--bg-overlay)' : 'transparent', color: period === p ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${period === p ? 'var(--border-default)' : 'transparent'}`, transition: 'all 0.1s' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 56px 64px', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* Overview KPIs */}
        <div>
          <SectionHeader title="Overview" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
            <StatCard label="Return" value={`${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`} sub="Cumulative" color={totalReturn >= 0 ? 'var(--profit)' : 'var(--loss)'} />
            <StatCard label="Total P&L" value={formatCurrency(totalPnl, true, symbol)} sub="All time" color={totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)'} />
            <StatCard label="Win rate" value={`${winRate.toFixed(1)}%`} sub={`${wins.length}W · ${losses.length}L`} color={winRate >= 50 ? 'var(--profit)' : 'var(--loss)'} />
            <StatCard label="Profit factor" value={profitFactor > 0 ? `${profitFactor.toFixed(2)}×` : '—'} sub="Gross profit / loss" />
            <StatCard label="Avg R:R" value={avgRR > 0 ? avgRR.toFixed(2) : '—'} sub="Per trade" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <StatCard label="Avg win" value={avgWin > 0 ? formatCurrency(avgWin, true, symbol) : '—'} color="var(--profit)" />
            <StatCard label="Avg loss" value={avgLoss > 0 ? `-${symbol}${avgLoss.toFixed(2)}` : '—'} color="var(--loss)" />
            <StatCard label="Max drawdown" value={maxDrawdown > 0 ? `-${maxDrawdown.toFixed(2)}%` : '—'} sub="Peak-to-trough" color={maxDrawdown > 0 ? 'var(--loss)' : undefined} />
            <StatCard label="Best trade" value={bestTrade?.symbol ? formatCurrency(Number(bestTrade.pnl), true, symbol) : '—'} sub={bestTrade?.symbol ?? ''} color="var(--profit)" />
            <StatCard label="Worst trade" value={worstTrade?.symbol ? formatCurrency(Number(worstTrade.pnl), true, symbol) : '—'} sub={worstTrade?.symbol ?? ''} color="var(--loss)" />
          </div>
        </div>

        {/* Equity curve */}
        <div>
          <SectionHeader title="Equity curve" sub="Cumulative % return per trade" />
          <div className="card" style={{ height: 320, padding: '20px 16px 10px' }}>
            {equityData.length > 1
              ? <EquityCurve data={equityData} currencySymbol={symbol} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>Not enough data yet</div>
            }
          </div>
        </div>

        {/* Calendar heatmap */}
        {calendarData.length > 0 && (
          <div>
            <SectionHeader title="Trading activity" sub="Daily P&L heatmap" />
            <div className="card" style={{ padding: '20px 24px 16px' }}>
              <CalendarHeatmap data={calendarData} currencySymbol={symbol} />
            </div>
          </div>
        )}

        {/* Monthly performance */}
        {monthlyData.length > 0 && (
          <div>
            <SectionHeader title="Monthly performance" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Monthly P&L */}
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>P&L per month</p>
                <div className="card" style={{ padding: '20px 20px 12px', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      {chartShared.cartesian}
                      <XAxis dataKey="name" {...chartShared.xProps} />
                      <YAxis {...chartShared.yProps} tickFormatter={v => `${symbol}${v}`} width={52} />
                      <ReferenceLine y={0} stroke="var(--border-default)" strokeWidth={1} />
                      <Tooltip content={<PnlTooltip symbol={symbol} />} cursor={{ fill: 'var(--bg-elevated)' }} />
                      <Bar dataKey="pnl" shape={pnlBarShape} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Monthly wins vs losses */}
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Wins vs losses per month</p>
                <div className="card" style={{ padding: '20px 20px 12px', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                      {chartShared.cartesian}
                      <XAxis dataKey="name" {...chartShared.xProps} />
                      <YAxis {...chartShared.yProps} allowDecimals={false} />
                      <Tooltip content={<MonthTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                      <Bar dataKey="wins"   name="Wins"   fill="var(--profit)" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="losses" name="Losses" fill="var(--loss)"   fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--profit)', display: 'inline-block' }} />Wins</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--loss)', display: 'inline-block' }} />Losses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Strategy + Day charts */}
        <div>
          <SectionHeader title="Breakdowns" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* P&L by strategy */}
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>P&L by strategy</p>
              <div className="card" style={{ padding: '20px 20px 12px', height: 260 }}>
                {strategyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategyData} margin={{ top: 4, right: 4, bottom: 24, left: 4 }}>
                      {chartShared.cartesian}
                      <XAxis dataKey="name" {...chartShared.xProps} angle={-20} textAnchor="end" />
                      <YAxis {...chartShared.yProps} tickFormatter={v => `${symbol}${v}`} width={52} />
                      <ReferenceLine y={0} stroke="var(--border-default)" strokeWidth={1} />
                      <Tooltip content={<BarTooltip symbol={symbol} />} cursor={{ fill: 'var(--bg-elevated)' }} />
                      <Bar dataKey="pnl" shape={pnlBarShape} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>}
              </div>
            </div>

            {/* Win rate by strategy */}
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Win rate by strategy</p>
              <div className="card" style={{ padding: '20px 20px 12px', height: 260 }}>
                {strategyWinRate.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategyWinRate} margin={{ top: 4, right: 4, bottom: 24, left: -10 }}>
                      {chartShared.cartesian}
                      <XAxis dataKey="name" {...chartShared.xProps} angle={-20} textAnchor="end" />
                      <YAxis {...chartShared.yProps} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                      <ReferenceLine y={50} stroke="var(--border-default)" strokeDasharray="4 2" strokeWidth={1} />
                      <Tooltip content={<BarTooltip symbol={symbol} />} cursor={{ fill: 'var(--bg-elevated)' }} />
                      <Bar dataKey="winRate" shape={winRateBarShape} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>}
              </div>
            </div>

            {/* P&L by day of week */}
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>P&L by day of week</p>
              <div className="card" style={{ padding: '20px 20px 12px', height: 260 }}>
                {dayData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      {chartShared.cartesian}
                      <XAxis dataKey="name" {...chartShared.xProps} />
                      <YAxis {...chartShared.yProps} tickFormatter={v => `${symbol}${v}`} width={52} />
                      <ReferenceLine y={0} stroke="var(--border-default)" strokeWidth={1} />
                      <Tooltip content={<BarTooltip symbol={symbol} />} cursor={{ fill: 'var(--bg-elevated)' }} />
                      <Bar dataKey="pnl" shape={pnlBarShape} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>}
              </div>
            </div>

            {/* Win rate by day */}
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Win rate by day of week</p>
              <div className="card" style={{ padding: '20px 20px 12px', height: 260 }}>
                {dayData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayData} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                      {chartShared.cartesian}
                      <XAxis dataKey="name" {...chartShared.xProps} />
                      <YAxis {...chartShared.yProps} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                      <ReferenceLine y={50} stroke="var(--border-default)" strokeDasharray="4 2" strokeWidth={1} />
                      <Tooltip content={<BarTooltip symbol={symbol} />} cursor={{ fill: 'var(--bg-elevated)' }} />
                      <Bar dataKey="winRate" shape={winRateBarShape} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Hour of day — full width */}
        {hourData.length > 0 && (
          <div>
            <SectionHeader title="Hour of day" sub="When you trade best (by entry time)" />
            <div className="card" style={{ padding: '20px 20px 12px', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                  {chartShared.cartesian}
                  <XAxis dataKey="name" {...chartShared.xProps} interval={1} />
                  <YAxis {...chartShared.yProps} tickFormatter={v => `${symbol}${v}`} width={52} />
                  <ReferenceLine y={0} stroke="var(--border-default)" strokeWidth={1} />
                  <Tooltip content={<BarTooltip symbol={symbol} />} cursor={{ fill: 'var(--bg-elevated)' }} />
                  <Bar dataKey="pnl" shape={pnlBarShape} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Strategy breakdown table */}
        {strategyData.length > 0 && (
          <div>
            <SectionHeader title="Strategy breakdown" />
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                {['Strategy', 'Trades', 'Win rate', 'Avg R:R', 'Total P&L'].map(h => (
                  <p key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: h === 'Strategy' ? 'left' : 'right' }}>{h}</p>
                ))}
              </div>
              {strategyData.map((s, i) => {
                const wr    = s.trades > 0 ? (s.wins / s.trades) * 100 : 0
                const avgRr = trades.filter(t => t.strategy === s.name).reduce((sum: number, t: any) => sum + Number(t.rr || 0), 0) / s.trades
                return (
                  <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '13px 24px', borderBottom: i < strategyData.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.trades}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: wr >= 50 ? 'var(--profit)' : 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{wr.toFixed(1)}%</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{avgRr.toFixed(2)}R</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: s.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.pnl, true, symbol)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Long vs Short */}
        <div>
          <SectionHeader title="Direction" />
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              {['Direction', 'Trades', 'Win rate', 'Winning', 'Losing'].map(h => (
                <p key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: h === 'Direction' ? 'left' : 'right' }}>{h}</p>
              ))}
            </div>
            {[{ label: 'LONG', group: longs }, { label: 'SHORT', group: shorts }].map(({ label, group }, i) => {
              const w  = group.filter(t => Number(t.pnl) > 0)
              const l  = group.filter(t => Number(t.pnl) <= 0)
              const wr = group.length > 0 ? (w.length / group.length) * 100 : 0
              return (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', padding: '13px 24px', borderBottom: i === 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: label === 'LONG' ? 'var(--profit)' : 'var(--loss)' }}>{label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{group.length}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: wr >= 50 ? 'var(--profit)' : 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{group.length > 0 ? `${wr.toFixed(1)}%` : '—'}</span>
                  <span style={{ fontSize: 13, color: 'var(--profit)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w.length}{group.length > 0 ? ` (${wr.toFixed(1)}%)` : ''}</span>
                  <span style={{ fontSize: 13, color: 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.length}{group.length > 0 ? ` (${(100 - wr).toFixed(1)}%)` : ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Symbol breakdown */}
        {symbolData.length > 0 && (
          <div>
            <SectionHeader title="Symbol breakdown" />
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                {['Symbol', 'Trades', 'Win rate', 'Winning', 'Losing', 'Total P&L'].map(h => (
                  <p key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: h === 'Symbol' ? 'left' : 'right' }}>{h}</p>
                ))}
              </div>
              {symbolData.map((s, i) => {
                const wr = s.count > 0 ? (s.wins / s.count) * 100 : 0
                return (
                  <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '13px 24px', borderBottom: i < symbolData.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: wr >= 50 ? 'var(--profit)' : 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{wr.toFixed(1)}%</span>
                    <span style={{ fontSize: 13, color: 'var(--profit)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.wins} ({wr.toFixed(1)}%)</span>
                    <span style={{ fontSize: 13, color: 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.losses} ({(100 - wr).toFixed(1)}%)</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: s.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.pnl, true, symbol)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Behaviour */}
        {(hasBehaviourData || hasConfidenceData) && (
          <div>
            <SectionHeader title="Behaviour" sub="Trade type and confidence analysis" />
            {hasBehaviourData && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {[
                  { label: 'Planned', stats: plannedStats, accent: 'var(--profit)' },
                  { label: 'Impulsive', stats: impulsiveStats, accent: 'var(--loss)' },
                ].map(({ label, stats, accent }) => (
                  <div key={label} className="card" style={{ padding: 24, borderTop: `2px solid ${accent}` }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>{label}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Trades</p><p style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stats.count}</p></div>
                      <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Win rate</p><p style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: stats.winRate >= 50 ? 'var(--profit)' : 'var(--loss)' }}>{stats.winRate.toFixed(1)}%</p></div>
                      <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Total return</p><p style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: stats.totalReturn >= 0 ? 'var(--profit)' : 'var(--loss)' }}>{stats.totalReturn >= 0 ? '+' : ''}{stats.totalReturn.toFixed(2)}%</p></div>
                      <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Avg/trade</p><p style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: stats.avgReturn >= 0 ? 'var(--profit)' : 'var(--loss)' }}>{stats.avgReturn >= 0 ? '+' : ''}{stats.avgReturn.toFixed(3)}%</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hasConfidenceData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {confBands.map(band => (
                  <div key={band.label} className="card" style={{ padding: 24 }}>
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Confidence {band.range}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{band.count} trade{band.count !== 1 ? 's' : ''}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Win rate</p><p style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: band.winRate >= 50 ? 'var(--profit)' : band.count === 0 ? 'var(--text-muted)' : 'var(--loss)' }}>{band.count === 0 ? '—' : `${band.winRate.toFixed(1)}%`}</p></div>
                      <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Total return</p><p style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: band.totalReturn >= 0 ? 'var(--profit)' : band.count === 0 ? 'var(--text-muted)' : 'var(--loss)' }}>{band.count === 0 ? '—' : `${band.totalReturn >= 0 ? '+' : ''}${band.totalReturn.toFixed(2)}%`}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Discipline */}
        <div>
          <SectionHeader title="Discipline" sub="Plan adherence and consistency score" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <StatCard
              label="Discipline score"
              value={disciplineScore !== null ? String(disciplineScore) : '—'}
              sub="Plan · Follow · Confidence · Journal"
              color={discColor}
            />
            <StatCard
              label="Followed plan"
              value={totalTrades > 0 ? `${Math.round(disc.followedPct * 100)}%` : '—'}
              sub={`${disc.followedCount} of ${totalTrades} trades`}
              color={pctColor(disc.followedPct)}
            />
            <StatCard
              label="Planned trades"
              value={totalTrades > 0 ? `${Math.round(disc.plannedPct * 100)}%` : '—'}
              sub={`${planned.length} planned · ${impulsive.length} impulsive`}
              color={pctColor(disc.plannedPct)}
            />
          </div>
          <div className="card" style={{ padding: '18px 20px', borderLeft: '2px solid var(--ai-accent)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai-accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>Compass Insight</p>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{insightText}</p>
          </div>
        </div>

        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}
