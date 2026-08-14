'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Bot, Search, Link2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency, getPnlColor } from '@/lib/utils'

interface Strategy {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface VersionSummary {
  strategy_id: string
  status: string
  mode: string
}

interface OpenPositionSummary {
  id: string
  strategyId: string
  strategyName: string
  versionId: string
  versionLabel: string
  symbol: string
  side: 'long' | 'short'
  entryPrice: number
  qty: number
  openedAt: string
  currentPrice: number | null
  unrealizedPnl: number | null
  unrealizedReturnPct: number | null
}

interface AutomationTradeRow {
  pnl: number
  is_live_account: boolean | null
  automation_strategy_version_id: string | null
  automation_strategy_versions: { strategy_id: string; automation_strategies: { name: string } | null } | null
}

interface StrategyAnalytics {
  strategyId: string
  strategyName: string
  count: number
  winRate: number | null
  totalPnl: number
}

interface Analytics {
  count: number
  winRate: number | null
  totalPnlLive: number
  totalPnlDemo: number
  byStrategy: StrategyAnalytics[]
}

function computeAnalytics(rows: AutomationTradeRow[]): Analytics {
  const count = rows.length
  const wins = rows.filter(r => Number(r.pnl) > 0).length
  const totalPnlLive = rows.filter(r => r.is_live_account === true).reduce((s, r) => s + Number(r.pnl || 0), 0)
  const totalPnlDemo = rows.filter(r => r.is_live_account !== true).reduce((s, r) => s + Number(r.pnl || 0), 0)

  const byStrategyMap = new Map<string, { name: string; rows: AutomationTradeRow[] }>()
  for (const r of rows) {
    const strategyId = r.automation_strategy_versions?.strategy_id
    if (!strategyId) continue
    const name = r.automation_strategy_versions?.automation_strategies?.name ?? 'Strategy'
    if (!byStrategyMap.has(strategyId)) byStrategyMap.set(strategyId, { name, rows: [] })
    byStrategyMap.get(strategyId)!.rows.push(r)
  }
  const byStrategy: StrategyAnalytics[] = [...byStrategyMap.entries()].map(([strategyId, { name, rows: sr }]) => {
    const sWins = sr.filter(r => Number(r.pnl) > 0).length
    return {
      strategyId,
      strategyName: name,
      count: sr.length,
      winRate: sr.length > 0 ? (sWins / sr.length) * 100 : null,
      totalPnl: sr.reduce((s, r) => s + Number(r.pnl || 0), 0),
    }
  }).sort((a, b) => b.count - a.count)

  return { count, winRate: count > 0 ? (wins / count) * 100 : null, totalPnlLive, totalPnlDemo, byStrategy }
}

function modeBadge(mode: string) {
  if (mode === 'live') return <span className="badge-loss">Live</span>
  if (mode === 'paper') return <span className="badge-profit">Paper</span>
  return <span className="badge-neutral">Off</span>
}

export default function AutomationPage() {
  const { symbol } = useCurrency()
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [openPositions, setOpenPositions] = useState<OpenPositionSummary[]>([])
  const [pnlLoading, setPnlLoading] = useState(false)
  const [pnlUpdatedAt, setPnlUpdatedAt] = useState<Date | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('automation_strategies').select('*').order('created_at', { ascending: false }),
      supabase.from('automation_strategy_versions').select('strategy_id, status, mode'),
      supabase.from('trades')
        .select('pnl, is_live_account, automation_strategy_version_id, automation_strategy_versions(strategy_id, automation_strategies(name))')
        .eq('source', 'automatic'),
    ]).then(([s, v, t]) => {
      setStrategies(s.data || [])
      setVersions(v.data || [])
      setAnalytics(computeAnalytics((t.data as unknown as AutomationTradeRow[]) || []))
      setLoading(false)
    })
  }, [])

  async function loadOpenPositions() {
    setPnlLoading(true)
    try {
      const res = await fetch('/api/automation/open-positions')
      const data = await res.json().catch(() => null)
      if (res.ok && data?.positions) {
        setOpenPositions(data.positions)
        setPnlUpdatedAt(new Date())
      }
    } finally {
      setPnlLoading(false)
    }
  }

  // Live positions poll every 20s while this page is open — cheap to always
  // try; the endpoint just returns an empty list when nothing's live.
  useEffect(() => {
    Promise.resolve().then(loadOpenPositions)
    const interval = setInterval(loadOpenPositions, 20_000)
    return () => clearInterval(interval)
  }, [])

  async function handleClosePosition(p: OpenPositionSummary) {
    if (!confirm(`Close ${p.side.toUpperCase()} ${p.symbol} (${p.strategyName})? This sends a real close order to the broker right now.`)) return
    setClosingId(p.id)
    try {
      const res = await fetch(`/api/automation/versions/${p.versionId}/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: p.symbol }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.status !== 'position_closed') {
        alert(data?.error || data?.reason || 'Could not close the position.')
        return
      }
      loadOpenPositions()
    } finally {
      setClosingId(null)
    }
  }

  const q = search.toLowerCase()
  const filtered = search
    ? strategies.filter(s => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
    : strategies

  function activeVersionFor(strategyId: string) {
    const vs = versions.filter(v => v.strategy_id === strategyId)
    return vs.find(v => v.status === 'active') ?? vs[0] ?? null
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="m-pad" style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="m-col" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>Automation</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{strategies.length} strateg{strategies.length !== 1 ? 'ies' : 'y'} · TradingView signals → paper trades</p>
          </div>
          <div className="m-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="input"
                placeholder="Search strategies…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 32, width: 200, fontSize: 13 }}
              />
            </div>
            <Link href="/automation/brokers" className="btn-secondary" style={{ fontSize: 14, padding: '10px 16px', textDecoration: 'none' }}>
              <Link2 size={14} />Brokers
            </Link>
            <Link href="/automation/new" className="btn-primary" style={{ fontSize: 14, padding: '10px 20px' }}>
              <Plus size={14} />New strategy
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 48px' }}>
        {openPositions.length > 0 && (() => {
          const values = openPositions.map(p => p.unrealizedPnl).filter((v): v is number => v != null)
          const total = values.length > 0 ? values.reduce((s, v) => s + v, 0) : null
          return (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--profit)' }} />
                  Live positions
                  <span className="badge-neutral">{openPositions.length}</span>
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: total != null ? getPnlColor(total) : 'var(--text-disabled)', fontVariantNumeric: 'tabular-nums' }}>
                    {total != null ? formatCurrency(total, true, symbol) : '—'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                    {pnlLoading ? 'Updating…' : pnlUpdatedAt ? `Updated ${pnlUpdatedAt.toLocaleTimeString()}` : ''}
                  </span>
                  <button className="btn-ghost" onClick={loadOpenPositions} disabled={pnlLoading} style={{ fontSize: 12, padding: '4px 6px' }}>
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {openPositions.map(p => (
                  <div key={p.id} className="m-col" style={{ padding: '10px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg-elevated)' }}>
                    <Link href={`/automation/${p.strategyId}/versions/${p.versionId}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap', flex: 1 }}>
                      <span className={p.side === 'long' ? 'badge-profit' : 'badge-loss'}>{p.side.toUpperCase()}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.symbol}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.strategyName} · {p.versionLabel}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-disabled)', fontVariantNumeric: 'tabular-nums' }}>
                        {p.entryPrice}{p.currentPrice != null && ` → ${p.currentPrice}`}
                      </span>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        {p.unrealizedPnl != null ? (
                          <>
                            <p style={{ fontSize: 13, fontWeight: 500, color: getPnlColor(p.unrealizedPnl), fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.unrealizedPnl, true, symbol)}</p>
                            {p.unrealizedReturnPct != null && (
                              <p style={{ fontSize: 11, color: getPnlColor(p.unrealizedReturnPct) }}>{p.unrealizedReturnPct >= 0 ? '+' : ''}{p.unrealizedReturnPct.toFixed(2)}%</p>
                            )}
                          </>
                        ) : (
                          <p style={{ fontSize: 12, color: 'var(--text-disabled)' }}>—</p>
                        )}
                      </div>
                      <button className="btn-secondary" onClick={() => handleClosePosition(p)} disabled={closingId === p.id} style={{ fontSize: 12, padding: '5px 10px' }}>
                        {closingId === p.id ? 'Closing…' : 'Close'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {analytics && analytics.count > 0 && (
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>Analytics</p>
            <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: analytics.byStrategy.length > 1 ? 18 : 0 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Trades</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{analytics.count}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Win rate</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{analytics.winRate != null ? `${analytics.winRate.toFixed(0)}%` : '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Demo P&amp;L</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: getPnlColor(analytics.totalPnlDemo), fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(analytics.totalPnlDemo, true, symbol)}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Live P&amp;L</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: getPnlColor(analytics.totalPnlLive), fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(analytics.totalPnlLive, true, symbol)}</p>
              </div>
            </div>
            {analytics.byStrategy.length > 1 && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analytics.byStrategy.map(s => (
                  <Link key={s.strategyId} href={`/automation/${s.strategyId}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 4px' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.strategyName}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{s.count} trade{s.count !== 1 ? 's' : ''}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{s.winRate != null ? `${s.winRate.toFixed(0)}% win` : '—'}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: getPnlColor(s.totalPnl), fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>{formatCurrency(s.totalPnl, true, symbol)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : strategies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Bot size={24} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>No strategies yet</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 420, margin: '0 auto 24px' }}>
              Turn a TradingView alert into a paper-traded strategy: define risk rules, get a webhook URL, and every signal shows up as a trade — automatically.
            </p>
            <Link href="/automation/new" className="btn-primary" style={{ fontSize: 14 }}>Create your first strategy</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <Search size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>No strategies match &quot;{search}&quot;</p>
            <button type="button" onClick={() => setSearch('')} style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear search</button>
          </div>
        ) : (
          <div className="m-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {filtered.map(strategy => {
              const active = activeVersionFor(strategy.id)
              const versionCount = versions.filter(v => v.strategy_id === strategy.id).length
              return (
                <Link key={strategy.id} href={`/automation/${strategy.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: '22px 24px', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{strategy.name}</h3>
                      {active && modeBadge(active.mode)}
                    </div>
                    {strategy.description && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {strategy.description}
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 'auto' }}>
                      {versionCount} version{versionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
