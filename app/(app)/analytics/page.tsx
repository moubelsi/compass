'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <p className="label" style={{ marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color: color ?? 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '-0.01em' }}>{children}</h2>
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 12px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ fontSize: 13, fontWeight: 500, color: p.value >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
          {typeof p.value === 'number' && p.name === 'winRate' ? `${p.value.toFixed(1)}%` : typeof p.value === 'number' ? `$${Math.abs(p.value).toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('id, symbol, pnl, rr, return_pct, strategy, created_at, trade_date')
        .order('trade_date', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true })
      setTrades(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>

  const totalTrades = trades.length
  const wins = trades.filter(t => Number(t.pnl) > 0)
  const losses = trades.filter(t => Number(t.pnl) < 0)
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0
  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const grossProfit = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0
  const avgRR = totalTrades > 0 ? trades.reduce((s, t) => s + Number(t.rr || 0), 0) / totalTrades : 0
  const bestTrade = trades.reduce((best, t) => Number(t.pnl) > Number(best.pnl) ? t : best, trades[0] || {})
  const worstTrade = trades.reduce((worst, t) => Number(t.pnl) < Number(worst.pnl) ? t : worst, trades[0] || {})

  // Equity curve data
  const equityData = trades.reduce((acc: any[], trade, i) => {
    const prev = acc[i - 1]?.value || 0
    acc.push({
      date: new Date(trade.trade_date || trade.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: prev + Number(trade.return_pct || 0)
    })
    return acc
  }, [])

  // P&L by strategy
  const byStrategy = trades.reduce((acc: any, t) => {
    const s = t.strategy || 'Unknown'
    if (!acc[s]) acc[s] = { name: s, pnl: 0, trades: 0, wins: 0 }
    acc[s].pnl += Number(t.pnl || 0)
    acc[s].trades++
    if (Number(t.pnl) > 0) acc[s].wins++
    return acc
  }, {})
  const strategyData = Object.values(byStrategy).sort((a: any, b: any) => b.pnl - a.pnl)

  // P&L by day of week
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const byDay = DAYS.map(day => ({ name: day, pnl: 0, trades: 0, wins: 0 }))
  trades.forEach(t => {
    const day = new Date(t.created_at).getDay()
    byDay[day].pnl += Number(t.pnl || 0)
    byDay[day].trades++
    if (Number(t.pnl) > 0) byDay[day].wins++
  })
  const dayData = byDay.filter(d => d.trades > 0)

  // Win rate by strategy
  const strategyWinRate = strategyData.map((s: any) => ({
    name: s.name,
    winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
    trades: s.trades,
  }))

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>Analytics</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{totalTrades} trades analysed</p>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 40 }}>

        {/* KPI row */}
        <div>
          <SectionTitle>Overview</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <StatCard label="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} sub="All time" color={totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)'} />
            <StatCard label="Win rate" value={`${winRate.toFixed(1)}%`} sub={`${wins.length}W · ${losses.length}L`} color={winRate >= 50 ? 'var(--profit)' : 'var(--loss)'} />
            <StatCard label="Profit factor" value={profitFactor > 0 ? `${profitFactor.toFixed(2)}×` : '—'} sub="Gross profit / gross loss" />
            <StatCard label="Avg R:R" value={avgRR.toFixed(2)} sub="Per trade" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <StatCard label="Avg win" value={`+$${avgWin.toFixed(2)}`} sub="Per winning trade" color="var(--profit)" />
          <StatCard label="Avg loss" value={`-$${avgLoss.toFixed(2)}`} sub="Per losing trade" color="var(--loss)" />
          <StatCard label="Best trade" value={bestTrade?.symbol ? `+$${Math.abs(Number(bestTrade.pnl)).toFixed(2)}` : '—'} sub={bestTrade?.symbol ?? ''} color="var(--profit)" />
          <StatCard label="Worst trade" value={worstTrade?.symbol ? `-$${Math.abs(Number(worstTrade.pnl)).toFixed(2)}` : '—'} sub={worstTrade?.symbol ?? ''} color="var(--loss)" />
        </div>

        {/* Equity curve */}
        <div>
          <SectionTitle>Equity curve</SectionTitle>
          <div className="card" style={{ height: 300, padding: '20px 20px 10px' }}>
            {equityData.length > 1
              ? <EquityCurve data={equityData} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>Not enough data yet</div>
            }
          </div>
        </div>

        {/* Charts grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* P&L by strategy */}
          <div>
            <SectionTitle>P&L by strategy</SectionTitle>
            <div className="card" style={{ padding: 24, height: 280 }}>
              {strategyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyData} margin={{ top: 4, right: 4, bottom: 20, left: -10 }}>
                    <CartesianGrid strokeDasharray="0" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {strategyData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>No data yet</div>
              )}
            </div>
          </div>

          {/* Win rate by strategy */}
          <div>
            <SectionTitle>Win rate by strategy</SectionTitle>
            <div className="card" style={{ padding: 24, height: 280 }}>
              {strategyWinRate.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyWinRate} margin={{ top: 4, right: 4, bottom: 20, left: -10 }}>
                    <CartesianGrid strokeDasharray="0" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                    <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                      {strategyWinRate.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.winRate >= 50 ? 'var(--profit)' : 'var(--loss)'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>No data yet</div>
              )}
            </div>
          </div>

          {/* P&L by day */}
          <div>
            <SectionTitle>P&L by day of week</SectionTitle>
            <div className="card" style={{ padding: 24, height: 280 }}>
              {dayData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayData} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                    <CartesianGrid strokeDasharray="0" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {dayData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>No data yet</div>
              )}
            </div>
          </div>

          {/* Win rate by day */}
          <div>
            <SectionTitle>Win rate by day of week</SectionTitle>
            <div className="card" style={{ padding: 24, height: 280 }}>
              {dayData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayData} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                    <CartesianGrid strokeDasharray="0" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                    <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                      {dayData.map((entry: any, i: number) => (
                        <Cell key={i} fill={(entry.wins / entry.trades * 100) >= 50 ? 'var(--profit)' : 'var(--loss)'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>No data yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Strategy breakdown table */}
        <div>
          <SectionTitle>Strategy breakdown</SectionTitle>
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              {['Strategy', 'Trades', 'Win rate', 'Avg R:R', 'Total P&L'].map(h => (
                <p key={h} className="label" style={{ textAlign: h === 'Strategy' ? 'left' : 'right' }}>{h}</p>
              ))}
            </div>
            {strategyData.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No trades yet</div>
            ) : (strategyData as any[]).map((s, i) => {
              const wr = s.trades > 0 ? (s.wins / s.trades) * 100 : 0
              const avgRr = trades.filter(t => t.strategy === s.name).reduce((sum: number, t: any) => sum + Number(t.rr || 0), 0) / s.trades
              return (
                <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '14px 24px', borderBottom: i < strategyData.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'right' }}>{s.trades}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: wr >= 50 ? 'var(--profit)' : 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{wr.toFixed(1)}%</span>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{avgRr.toFixed(2)}R</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: s.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.pnl >= 0 ? '+' : ''}${Math.abs(s.pnl).toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}