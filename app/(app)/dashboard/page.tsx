'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { supabase } from '@/lib/supabase'

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '32px 36px' }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.01em' }}>{label}</p>
      <p style={{ fontSize: 40, fontWeight: 600, color: color ?? 'var(--text-primary)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10 }}>{sub}</p>}
    </div>
  )
}

function InsightCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: '24px 28px', borderLeft: '3px solid var(--ai-accent)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ai-accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Compass Insight</p>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  )
}

function PhilosophyBar() {
  const steps = ['Find', 'Plan', 'Wait', 'Execute', 'Review', 'Repeat']
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '20px 36px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
      {steps.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '0.02em' }}>{step}</p>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
              <ChevronRight size={14} style={{ color: 'var(--border-strong)' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('id, symbol, direction, strategy, pnl, return_pct, created_at, trade_date, trade_type, followed_plan, confidence, notes, screenshot_url')
        .order('trade_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      setTrades(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const totalTrades = trades.length
  const wins = trades.filter(t => Number(t.pnl) > 0)
  const losses = trades.filter(t => Number(t.pnl) < 0)
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0
  const totalReturn = trades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const grossProfit = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

  const equityData = [...trades].reverse().reduce((acc: any[], trade, i) => {
    const prev = acc[i - 1]?.value || 0
    acc.push({
      date: new Date(trade.trade_date || trade.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: prev + Number(trade.return_pct || 0)
    })
    return acc
  }, [])

  const todayTrades = trades.filter(t => {
    const d = t.trade_date || t.created_at
    return new Date(d).toDateString() === new Date().toDateString()
  })
  const todayReturn = todayTrades.reduce((s, t) => s + Number(t.return_pct || 0), 0)
  const recentTrades = trades.slice(0, 6)

  const insightText = (() => {
    if (totalTrades === 0) return 'Log your first trade to unlock performance insights.'
    const planned = trades.filter(t => t.trade_type === 'planned')
    const impulsive = trades.filter(t => t.trade_type === 'impulsive')
    if (planned.length + impulsive.length === 0) {
      return `${totalTrades} trade${totalTrades !== 1 ? 's' : ''} logged. Add trade type (Planned / Impulsive) when logging to unlock behaviour insights.`
    }
    const plannedWR = planned.length > 0 ? (planned.filter(t => Number(t.pnl) > 0).length / planned.length * 100).toFixed(0) : null
    const impulsiveWR = impulsive.length > 0 ? (impulsive.filter(t => Number(t.pnl) > 0).length / impulsive.length * 100).toFixed(0) : null
    if (plannedWR !== null && impulsiveWR !== null) {
      return `Planned trades: ${plannedWR}% win rate (${planned.length}). Impulsive trades: ${impulsiveWR}% win rate (${impulsive.length}).`
    }
    return `${planned.length + impulsive.length} of ${totalTrades} trades have trade type logged.`
  })()

  // Discipline Score — process-based, not profit-based
  const typedTrades    = trades.filter(t => t.trade_type)
  const plannedPct     = typedTrades.length > 0 ? typedTrades.filter(t => t.trade_type === 'planned').length / typedTrades.length : 0
  const followedPct    = totalTrades > 0 ? trades.filter(t => t.followed_plan).length / totalTrades : 0
  const confTrades     = trades.filter(t => t.confidence != null)
  const avgConf        = confTrades.length > 0 ? confTrades.reduce((s, t) => s + Number(t.confidence), 0) / confTrades.length : 0
  const journalledPct  = totalTrades > 0 ? trades.filter(t => (t.notes && t.notes !== 'EMPTY') || (t.screenshot_url && t.screenshot_url !== 'EMPTY')).length / totalTrades : 0
  const disciplineScore = totalTrades > 0 ? Math.round(plannedPct * 40 + followedPct * 30 + (avgConf / 10) * 20 + journalledPct * 10) : null
  const disciplineColor = disciplineScore === null ? undefined : disciplineScore >= 70 ? 'var(--profit)' : disciplineScore >= 40 ? '#B45309' : 'var(--loss)'
  const disciplineSub   = disciplineScore === null ? 'Log trades to unlock' : `${totalTrades} trade${totalTrades !== 1 ? 's' : ''} analysed`

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 16 }}>Loading...</div>

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '48px 56px 36px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1500, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 16, color: 'var(--text-muted)', marginBottom: 8 }}>{greeting}</p>
            <h1 style={{ fontSize: 42, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 14 }}>Your performance</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
              {todayReturn !== 0 ? (
                <>
                  {todayReturn > 0
                    ? <TrendingUp size={18} style={{ color: 'var(--profit)' }} />
                    : <TrendingDown size={18} style={{ color: 'var(--loss)' }} />}
                  <span style={{ fontWeight: 500, color: todayReturn >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                    {todayReturn >= 0 ? '+' : ''}{todayReturn.toFixed(2)}% today
                  </span>
                  {todayTrades.length > 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>· {todayTrades.length} trade{todayTrades.length !== 1 ? 's' : ''}</span>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No trades today</span>
              )}
            </div>
          </div>
          <Link href="/trades/new" className="btn-primary" style={{ fontSize: 16, padding: '14px 28px' }}>
            + Log trade
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1500, margin: '0 auto', padding: '40px 56px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Philosophy */}
        <PhilosophyBar />

        {/* 4 KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <KPICard
            label="Total return"
            value={`${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`}
            sub="All time"
            color={totalReturn >= 0 ? 'var(--profit)' : 'var(--loss)'}
          />
          <KPICard
            label="Win rate"
            value={`${winRate.toFixed(1)}%`}
            sub={`${wins.length}W · ${losses.length}L · ${totalTrades} trades`}
            color={winRate >= 50 ? 'var(--profit)' : 'var(--loss)'}
          />
          <KPICard
            label="Profit factor"
            value={profitFactor > 0 ? `${profitFactor.toFixed(2)}×` : '—'}
            sub="Above 1.0 is profitable"
          />
          <KPICard
            label="Discipline score"
            value={disciplineScore !== null ? String(disciplineScore) : '—'}
            sub={disciplineSub}
            color={disciplineColor}
          />
        </div>

        {/* Equity curve */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Equity curve</p>
            <Link href="/analytics" style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Full analytics <ChevronRight size={14} />
            </Link>
          </div>
          <div className="card" style={{ height: 380, padding: '28px 28px 14px' }}>
            {equityData.length > 1 ? (
              <EquityCurve data={equityData} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
                <p style={{ fontSize: 16, color: 'var(--text-secondary)', fontWeight: 500 }}>No equity data yet</p>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Log your first trade to see your curve</p>
              </div>
            )}
          </div>
        </div>

        {/* Insight + Recent trades */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
          {/* Insights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <InsightCard text={insightText} />
            <div className="card" style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12 }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>AI Coach</p>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>Deeper insights available as you log more trades.</p>
              <Link href="/coach" style={{ fontSize: 14, color: 'var(--ai-accent)', textDecoration: 'none', fontWeight: 500, marginTop: 4 }}>View coach →</Link>
            </div>
          </div>

          {/* Recent trades */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recent trades</p>
              <Link href="/trades" style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                All trades <ChevronRight size={14} />
              </Link>
            </div>
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                {['Symbol', 'Strategy', 'Date', 'Return', 'P&L'].map(h => (
                  <p key={h} style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', textAlign: h === 'Symbol' || h === 'Strategy' ? 'left' : 'right' }}>{h}</p>
                ))}
              </div>
              {recentTrades.length === 0 ? (
                <div style={{ padding: '56px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>No trades yet</p>
                  <Link href="/trades/new" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', marginTop: 10, display: 'block' }}>Log your first trade →</Link>
                </div>
              ) : recentTrades.map((t, i) => {
                const up = Number(t.pnl) >= 0
                return (
                  <Link key={t.id} href={`/trades/${t.id}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', padding: '16px 24px', borderBottom: i < recentTrades.length - 1 ? '1px solid var(--border-subtle)' : 'none', textDecoration: 'none', transition: 'background 0.1s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: up ? 'var(--profit-dim)' : 'var(--loss-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {up ? <ArrowUpRight size={16} style={{ color: 'var(--profit)' }} /> : <ArrowDownRight size={16} style={{ color: 'var(--loss)' }} />}
                      </div>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{t.symbol?.toUpperCase()}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 3, background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)', marginLeft: 8 }}>{t.direction}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t.strategy || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                        {t.return_pct != null ? `${Number(t.return_pct) >= 0 ? '+' : ''}${Number(t.return_pct).toFixed(2)}%` : '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {up ? '+' : ''}${Math.abs(Number(t.pnl)).toFixed(2)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}