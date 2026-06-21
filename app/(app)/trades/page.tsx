'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Direction = 'LONG' | 'SHORT'

interface Trade {
  id: string
  symbol: string
  direction: Direction
  strategy: string | null
  pnl: number
  return_pct: number | null
  rr: number | null
  trade_date: string | null
  created_at: string
  trade_type: 'planned' | 'impulsive' | null
}

const DIRECTION_OPTS = ['All', 'LONG', 'SHORT'] as const
const RESULT_OPTS = ['All', 'Win', 'Loss'] as const

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<'All' | Direction>('All')
  const [result, setResult] = useState<'All' | 'Win' | 'Loss'>('All')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('id, symbol, direction, strategy, pnl, return_pct, rr, trade_date, created_at, trade_type')
        .order('trade_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      setTrades((data as Trade[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = trades.filter(t => {
    if (search && !t.symbol?.toLowerCase().includes(search.toLowerCase()) && !t.strategy?.toLowerCase().includes(search.toLowerCase())) return false
    if (direction !== 'All' && t.direction !== direction) return false
    if (result === 'Win' && Number(t.pnl) <= 0) return false
    if (result === 'Loss' && Number(t.pnl) >= 0) return false
    return true
  })

  const wins = trades.filter(t => Number(t.pnl) > 0).length
  const losses = trades.filter(t => Number(t.pnl) < 0).length
  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)

  const dateLabel = (t: Trade) => {
    const raw = t.trade_date || t.created_at
    return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Trades</h1>
            {!loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: 'var(--text-muted)' }}>
                <span>{trades.length} total</span>
                <span style={{ color: 'var(--profit)' }}>{wins}W</span>
                <span style={{ color: 'var(--loss)' }}>{losses}L</span>
                <span style={{ color: totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <Link href="/trades/new" className="btn-primary" style={{ fontSize: 14, padding: '10px 20px' }}>
            + Log trade
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 48px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: 200, maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="input"
              placeholder="Search symbol or strategy…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SlidersHorizontal size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Filter:</span>
          </div>

          {/* Direction filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {DIRECTION_OPTS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setDirection(opt as typeof direction)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: direction === opt ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
                  color: direction === opt ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: `1px solid ${direction === opt ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                }}
              >{opt}</button>
            ))}
          </div>

          {/* Result filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {RESULT_OPTS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setResult(opt as typeof result)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: result === opt ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
                  color: result === opt
                    ? opt === 'Win' ? 'var(--profit)' : opt === 'Loss' ? 'var(--loss)' : 'var(--text-primary)'
                    : 'var(--text-muted)',
                  border: `1px solid ${result === opt ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                }}
              >{opt}</button>
            ))}
          </div>

          {(search || direction !== 'All' || result !== 'All') && (
            <button
              type="button"
              onClick={() => { setSearch(''); setDirection('All'); setResult('All') }}
              style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >Clear</button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 1fr', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              {['Symbol', 'Strategy', 'Date', 'Return', 'P&L', 'R:R'].map(h => (
                <p key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', textAlign: h === 'Symbol' || h === 'Strategy' ? 'left' : 'right' }}>{h}</p>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '72px 24px', textAlign: 'center' }}>
                {trades.length === 0 ? (
                  <>
                    <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>No trades yet</p>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Start logging to build your journal</p>
                    <Link href="/trades/new" className="btn-primary" style={{ fontSize: 14 }}>Log your first trade</Link>
                  </>
                ) : (
                  <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No trades match your filters</p>
                )}
              </div>
            ) : filtered.map((t, i) => {
              const up = Number(t.pnl) >= 0
              return (
                <Link
                  key={t.id}
                  href={`/trades/${t.id}`}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 1fr',
                    padding: '15px 24px',
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    textDecoration: 'none', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {/* Symbol + direction */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 7,
                      background: up ? 'var(--profit-dim)' : 'var(--loss-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {up
                        ? <ArrowUpRight size={15} style={{ color: 'var(--profit)' }} />
                        : <ArrowDownRight size={15} style={{ color: 'var(--loss)' }} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{t.symbol?.toUpperCase()}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3,
                          background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)',
                          color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)',
                        }}>{t.direction}</span>
                        {t.trade_type && (
                          <span style={{
                            fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3,
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-muted)',
                            textTransform: 'capitalize',
                          }}>{t.trade_type}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Strategy */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.strategy || '—'}</span>
                  </div>

                  {/* Date */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dateLabel(t)}</span>
                  </div>

                  {/* Return % */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                      {t.return_pct != null ? `${Number(t.return_pct) >= 0 ? '+' : ''}${Number(t.return_pct).toFixed(2)}%` : '—'}
                    </span>
                  </div>

                  {/* P&L */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                      {up ? '+' : '-'}${Math.abs(Number(t.pnl)).toFixed(2)}
                    </span>
                  </div>

                  {/* R:R */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {t.rr != null ? `${Number(t.rr).toFixed(1)}R` : '—'}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && filtered.length !== trades.length && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, textAlign: 'right' }}>
            Showing {filtered.length} of {trades.length} trades
          </p>
        )}
      </div>
    </div>
  )
}
