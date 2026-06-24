'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Search, SlidersHorizontal, Upload, Star } from 'lucide-react'
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
  screenshot_url: string | null
  is_favourite: boolean
  tags: string[]
}

const DIRECTION_OPTS = ['All', 'LONG', 'SHORT'] as const
const RESULT_OPTS    = ['All', 'Win', 'Loss'] as const

const GRID = '28px 2fr 1.2fr 1fr 1fr 1fr 1fr'

export default function TradesPage() {
  const [trades, setTrades]       = useState<Trade[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [direction, setDirection] = useState<'All' | Direction>('All')
  const [result, setResult]       = useState<'All' | 'Win' | 'Loss'>('All')
  const [starred, setStarred]     = useState(false)
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .order('trade_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      setTrades((data as Trade[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  async function toggleFavourite(id: string, current: boolean, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setTrades(prev => prev.map(t => t.id === id ? { ...t, is_favourite: !current } : t))
    await supabase.from('trades').update({ is_favourite: !current }).eq('id', id)
  }

  const allTags = Array.from(new Set(trades.flatMap(t => t.tags || []))).sort()

  const filtered = trades.filter(t => {
    if (search && !t.symbol?.toLowerCase().includes(search.toLowerCase()) && !t.strategy?.toLowerCase().includes(search.toLowerCase())) return false
    if (direction !== 'All' && t.direction !== direction) return false
    if (result === 'Win' && Number(t.pnl) <= 0) return false
    if (result === 'Loss' && Number(t.pnl) >= 0) return false
    if (starred && !t.is_favourite) return false
    if (tagFilter && !(t.tags || []).includes(tagFilter)) return false
    return true
  })

  const wins     = trades.filter(t => Number(t.pnl) > 0).length
  const losses   = trades.filter(t => Number(t.pnl) < 0).length
  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)

  const dateLabel = (t: Trade) => {
    const raw = t.trade_date || t.created_at
    return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const hasActiveFilter = search || direction !== 'All' || result !== 'All' || starred || tagFilter

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
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/trades/import" className="btn-secondary" style={{ fontSize: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
              <Upload size={13} />Import
            </Link>
            <Link href="/trades/new" className="btn-primary" style={{ fontSize: 14, padding: '10px 20px' }}>
              + Log trade
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 48px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1', minWidth: 200, maxWidth: 320 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input className="input" placeholder="Search symbol or strategy…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, fontSize: 13 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SlidersHorizontal size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Filter:</span>
            </div>

            {/* Direction */}
            <div style={{ display: 'flex', gap: 4 }}>
              {DIRECTION_OPTS.map(opt => (
                <button key={opt} type="button" onClick={() => setDirection(opt as typeof direction)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: direction === opt ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: direction === opt ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${direction === opt ? 'var(--border-default)' : 'var(--border-subtle)'}` }}>{opt}</button>
              ))}
            </div>

            {/* Result */}
            <div style={{ display: 'flex', gap: 4 }}>
              {RESULT_OPTS.map(opt => (
                <button key={opt} type="button" onClick={() => setResult(opt as typeof result)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: result === opt ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: result === opt ? (opt === 'Win' ? 'var(--profit)' : opt === 'Loss' ? 'var(--loss)' : 'var(--text-primary)') : 'var(--text-muted)', border: `1px solid ${result === opt ? 'var(--border-default)' : 'var(--border-subtle)'}` }}>{opt}</button>
              ))}
            </div>

            {/* Starred */}
            <button type="button" onClick={() => setStarred(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: starred ? 'rgba(180,83,9,0.08)' : 'var(--bg-elevated)', color: starred ? '#B45309' : 'var(--text-muted)', border: `1px solid ${starred ? 'rgba(180,83,9,0.25)' : 'var(--border-subtle)'}` }}>
              <Star size={11} fill={starred ? '#B45309' : 'none'} style={{ color: starred ? '#B45309' : 'var(--text-muted)' }} />Starred
            </button>

            {hasActiveFilter && (
              <button type="button" onClick={() => { setSearch(''); setDirection('All'); setResult('All'); setStarred(false); setTagFilter(null) }} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
            )}
          </div>

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 2 }}>
              {allTags.map(tag => (
                <button key={tag} type="button" onClick={() => setTagFilter(tagFilter === tag ? null : tag)} style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.1s', background: tagFilter === tag ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: tagFilter === tag ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${tagFilter === tag ? 'var(--border-default)' : 'var(--border-subtle)'}` }}>
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', alignItems: 'center' }}>
              <Star size={11} style={{ color: 'var(--border-default)' }} />
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
              const up   = Number(t.pnl) >= 0
              const tags = t.tags || []
              return (
                <div key={t.id} style={{ position: 'relative' }}>
                  <Link
                    href={`/trades/${t.id}`}
                    style={{ display: 'grid', gridTemplateColumns: GRID, padding: '14px 24px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', textDecoration: 'none', transition: 'background 0.1s', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {/* Star */}
                    <button
                      onClick={e => toggleFavourite(t.id, t.is_favourite, e)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, padding: 0 }}
                    >
                      <Star size={13} fill={t.is_favourite ? '#B45309' : 'none'} style={{ color: t.is_favourite ? '#B45309' : 'var(--border-default)', transition: 'color 0.15s' }} />
                    </button>

                    {/* Symbol */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {t.screenshot_url && t.screenshot_url !== 'EMPTY' ? (
                        <img src={t.screenshot_url} alt="" style={{ width: 52, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 7, background: up ? 'var(--profit-dim)' : 'var(--loss-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {up ? <ArrowUpRight size={15} style={{ color: 'var(--profit)' }} /> : <ArrowDownRight size={15} style={{ color: 'var(--loss)' }} />}
                        </div>
                      )}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{t.symbol?.toUpperCase()}</span>
                          <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3, background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)' }}>{t.direction}</span>
                          {t.trade_type && <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-elevated)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{t.trade_type}</span>}
                        </div>
                        {tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {tags.map(tag => (
                              <span key={tag} style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 10, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>#{tag}</span>
                            ))}
                          </div>
                        )}
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
                </div>
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
