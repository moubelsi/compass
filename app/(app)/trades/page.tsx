'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, SlidersHorizontal, Upload, Star, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency, localDateStr } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const DIRECTION_OPTS = ['All', 'LONG', 'SHORT'] as const
const RESULT_OPTS    = ['All', 'Win', 'Loss'] as const
const GRID           = '28px 2fr 1.2fr 1fr 0.9fr 0.9fr 0.8fr'

// ── Helpers ───────────────────────────────────────────────────────────────────

function tradeEffectiveDate(t: Trade): string | null {
  if (t.trade_date) {
    const d = t.trade_date.slice(0, 10)  // handles 'YYYY-MM-DD' and 'YYYY-MM-DDT...' timestamp variants
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  }
  if (t.created_at) {
    const d = new Date(t.created_at)
    if (!isNaN(d.getTime())) return localDateStr(d)
  }
  return null
}

function formatTradeDate(t: Trade): string {
  const d = tradeEffectiveDate(t)
  if (!d) return '—'
  const now       = new Date()
  const today     = localDateStr(now)
  const yesterday = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  if (d === today)     return 'Today'
  if (d === yesterday) return 'Yesterday'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Overall metric card (header) ─────────────────────────────────────────────

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '16px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 600, color: color || 'var(--text-primary)', letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TradesPage() {
  const { symbol }                = useCurrency()
  const [trades, setTrades]       = useState<Trade[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [direction, setDirection] = useState<'All' | Direction>('All')
  const [result, setResult]       = useState<'All' | 'Win' | 'Loss'>('All')
  const [starred, setStarred]     = useState(false)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [sortKey, setSortKey]     = useState<'date' | 'return_pct' | 'pnl' | null>(null)
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')
  const [dailyLimit, setDailyLimit]       = useState<number | null>(null)
  const [editingLimit, setEditingLimit]   = useState(false)
  const [limitInput, setLimitInput]       = useState('')

  useEffect(() => {
    const l = localStorage.getItem('dailyTradeLimit')
    if (l) setDailyLimit(parseInt(l))

    supabase.from('trades')
      .select('*')
      .order('trade_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTrades((data as Trade[]) || [])
        setLoading(false)
      })
  }, [])

  function saveLimit() {
    const n = parseInt(limitInput)
    if (n > 0) { setDailyLimit(n); localStorage.setItem('dailyTradeLimit', String(n)) }
    else { setDailyLimit(null); localStorage.removeItem('dailyTradeLimit') }
    setEditingLimit(false)
  }

  async function toggleFavourite(id: string, current: boolean, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setTrades(prev => prev.map(t => t.id === id ? { ...t, is_favourite: !current } : t))
    await supabase.from('trades').update({ is_favourite: !current }).eq('id', id)
  }

  // ── Overall metrics (all trades) ──
  const wins         = trades.filter(t => Number(t.pnl) > 0)
  const losses       = trades.filter(t => Number(t.pnl) < 0)
  const totalPnl     = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const grossProfit  = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss    = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null
  const winRate      = trades.length > 0 ? (wins.length / trades.length) * 100 : 0
  const avgWin       = wins.length > 0 ? grossProfit / wins.length : 0
  const avgLoss      = losses.length > 0 ? grossLoss / losses.length : 0
  const expectancy   = trades.length > 0
    ? ((wins.length / trades.length) * avgWin) - ((losses.length / trades.length) * avgLoss)
    : null

  // ── Today ──
  const todayStr      = localDateStr()
  const todayCount    = trades.filter(t => (t.trade_date?.slice(0, 10) || t.created_at.slice(0, 10)) === todayStr).length
  const limitExceeded = dailyLimit ? todayCount > dailyLimit : false
  const limitAtLimit  = dailyLimit ? todayCount === dailyLimit : false
  const limitColor    = limitExceeded ? 'var(--loss)' : limitAtLimit ? '#B45309' : 'var(--text-secondary)'

  // ── Filter ──
  const allTags  = Array.from(new Set(trades.flatMap(t => t.tags || []))).sort()
  const filtered = trades.filter(t => {
    if (search && !t.symbol?.toLowerCase().includes(search.toLowerCase()) && !t.strategy?.toLowerCase().includes(search.toLowerCase())) return false
    if (direction !== 'All' && t.direction !== direction) return false
    if (result === 'Win'  && Number(t.pnl) <= 0) return false
    if (result === 'Loss' && Number(t.pnl) >= 0) return false
    if (starred && !t.is_favourite) return false
    if (tagFilter && !(t.tags || []).includes(tagFilter)) return false
    return true
  })

  // ── Sort ──
  const sortedFiltered = useMemo(() => {
    if (!sortKey || sortKey === 'date') {
      if (sortDir === 'asc') {
        return [...filtered].sort((a, b) => {
          const aD = tradeEffectiveDate(a) || ''
          const bD = tradeEffectiveDate(b) || ''
          return aD.localeCompare(bD)
        })
      }
      return filtered // already date-desc from Supabase
    }
    return [...filtered].sort((a, b) => {
      const aVal = sortKey === 'pnl' ? Number(a.pnl) : Number(a.return_pct ?? 0)
      const bVal = sortKey === 'pnl' ? Number(b.pnl) : Number(b.return_pct ?? 0)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const hasActiveFilter = search || direction !== 'All' || result !== 'All' || starred || tagFilter

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* ── Page header ── */}
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Trades</h1>
              {!loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: 'var(--text-muted)' }}>
                  <span>{trades.length} total</span>
                  <span style={{ color: 'var(--profit)' }}>{wins.length}W</span>
                  <span style={{ color: 'var(--loss)' }}>{losses.length}L</span>
                  <span style={{ color: totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(totalPnl, true, symbol)}
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Daily limit chip */}
              {editingLimit ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input className="input" type="number" min="1" placeholder="Daily limit" value={limitInput} onChange={e => setLimitInput(e.target.value)} style={{ fontSize: 12, padding: '5px 10px', width: 120 }} autoFocus onKeyDown={e => e.key === 'Enter' && saveLimit()} />
                  <button className="btn-primary" style={{ fontSize: 12 }} onClick={saveLimit}>Save</button>
                  <button style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setEditingLimit(false)}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setLimitInput(dailyLimit ? String(dailyLimit) : ''); setEditingLimit(true) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--bg-elevated)', color: limitColor, border: `1px solid ${limitExceeded ? 'rgba(192,57,43,0.25)' : limitAtLimit ? 'rgba(180,83,9,0.25)' : 'var(--border-subtle)'}`, transition: 'all 0.1s' }}>
                  <Zap size={11} style={{ color: limitColor }} />
                  {dailyLimit ? `${todayCount} / ${dailyLimit} today` : 'Set daily limit'}
                </button>
              )}
              <Link href="/trades/import" className="btn-secondary" style={{ fontSize: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
                <Upload size={13} />Import
              </Link>
              <Link href="/trades/new" className="btn-primary" style={{ fontSize: 14, padding: '10px 20px' }}>+ Log trade</Link>
            </div>
          </div>

          {/* Overall metric cards */}
          {!loading && trades.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <MetricCard label="Profit factor" value={profitFactor ? `${profitFactor.toFixed(2)}×` : '—'} color={profitFactor && profitFactor >= 1 ? 'var(--profit)' : profitFactor ? 'var(--loss)' : undefined} sub="Gross profit / loss" />
              <MetricCard label="Win rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 50 ? 'var(--profit)' : 'var(--loss)'} sub={`${wins.length}W · ${losses.length}L`} />
              <MetricCard label="Avg win" value={avgWin > 0 ? formatCurrency(avgWin, true, symbol) : '—'} color={avgWin > 0 ? 'var(--profit)' : undefined} />
              <MetricCard label="Avg loss" value={avgLoss > 0 ? `-${symbol}${avgLoss.toFixed(2)}` : '—'} color={avgLoss > 0 ? 'var(--loss)' : undefined} />
              <MetricCard label="Expectancy" value={expectancy !== null ? formatCurrency(expectancy, true, symbol) : '—'} color={expectancy !== null ? (expectancy >= 0 ? 'var(--profit)' : 'var(--loss)') : undefined} sub="Per trade avg" />
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 48px' }}>

        {/* ── Filters ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: 200, maxWidth: 320 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input className="input" placeholder="Search symbol or strategy…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SlidersHorizontal size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Filter:</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {DIRECTION_OPTS.map(opt => (
                <button key={opt} type="button" onClick={() => setDirection(opt as typeof direction)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: direction === opt ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: direction === opt ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${direction === opt ? 'var(--border-default)' : 'var(--border-subtle)'}` }}>{opt}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {RESULT_OPTS.map(opt => (
                <button key={opt} type="button" onClick={() => setResult(opt as typeof result)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: result === opt ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: result === opt ? (opt === 'Win' ? 'var(--profit)' : opt === 'Loss' ? 'var(--loss)' : 'var(--text-primary)') : 'var(--text-muted)', border: `1px solid ${result === opt ? 'var(--border-default)' : 'var(--border-subtle)'}` }}>{opt}</button>
              ))}
            </div>
            <button type="button" onClick={() => setStarred(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: starred ? 'rgba(180,83,9,0.08)' : 'var(--bg-elevated)', color: starred ? '#B45309' : 'var(--text-muted)', border: `1px solid ${starred ? 'rgba(180,83,9,0.25)' : 'var(--border-subtle)'}` }}>
              <Star size={11} fill={starred ? '#B45309' : 'none'} style={{ color: starred ? '#B45309' : 'var(--text-muted)' }} />Starred
            </button>
            {hasActiveFilter && (
              <button type="button" onClick={() => { setSearch(''); setDirection('All'); setResult('All'); setStarred(false); setTagFilter(null) }} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
            )}
          </div>
          {allTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 2 }}>
              {allTags.map(tag => (
                <button key={tag} type="button" onClick={() => setTagFilter(tagFilter === tag ? null : tag)} style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.1s', background: tagFilter === tag ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: tagFilter === tag ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${tagFilter === tag ? 'var(--border-default)' : 'var(--border-subtle)'}` }}>#{tag}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '72px 24px', textAlign: 'center' }}>
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
        ) : (
          <>
            {filtered.length !== trades.length && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                {filtered.length} of {trades.length} trades
              </p>
            )}

            {/* Column header */}
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', alignItems: 'center' }}>
                <Star size={11} style={{ color: 'var(--border-default)' }} />
                {(['Symbol', 'Strategy', 'Date', 'Return', 'P&L', 'R:R'] as const).map(h => {
                  const key = h === 'Return' ? 'return_pct' : h === 'P&L' ? 'pnl' : h === 'Date' ? 'date' : null
                  const active = key && sortKey === key
                  const arrow = active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''
                  return key ? (
                    <button key={h} onClick={() => toggleSort(key as typeof sortKey)} style={{ fontSize: 11, fontWeight: active ? 600 : 500, color: active ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '0.04em', textAlign: h === 'Symbol' || h === 'Strategy' || h === 'Date' ? 'left' : 'right', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block', width: '100%' }}>
                      {h}{arrow}
                    </button>
                  ) : (
                    <p key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', textAlign: h === 'Symbol' || h === 'Strategy' ? 'left' : 'right' }}>{h}</p>
                  )
                })}
              </div>

              {/* Trade rows */}
              {sortedFiltered.map(t => {
                const up   = Number(t.pnl) >= 0
                const tags = t.tags || []
                return (
                  <div key={t.id} style={{ position: 'relative' }}>
                    <Link
                      href={`/trades/${t.id}`}
                      style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', textDecoration: 'none', transition: 'background 0.1s', alignItems: 'center', background: 'var(--bg-base)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-base)')}
                    >
                      {/* Star */}
                      <button onClick={e => toggleFavourite(t.id, t.is_favourite, e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, padding: 0 }}>
                        <Star size={13} fill={t.is_favourite ? '#B45309' : 'none'} style={{ color: t.is_favourite ? '#B45309' : 'var(--border-default)', transition: 'color 0.15s' }} />
                      </button>

                      {/* Symbol */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {t.screenshot_url && t.screenshot_url !== 'EMPTY' ? (
                          <img src={t.screenshot_url} alt="" style={{ width: 52, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 7, background: up ? 'var(--profit-dim)' : 'var(--loss-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: up ? 'var(--profit)' : 'var(--loss)', letterSpacing: '0.02em' }}>{up ? 'WIN' : 'LOSS'}</span>
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{t.symbol?.toUpperCase()}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)', letterSpacing: '0.04em' }}>{t.direction}</span>
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
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.strategy || '—'}</span>

                      {/* Date */}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatTradeDate(t)}</span>

                      {/* Return % */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                          {t.return_pct != null ? `${Number(t.return_pct) >= 0 ? '+' : ''}${Number(t.return_pct).toFixed(2)}%` : '—'}
                        </span>
                      </div>

                      {/* P&L */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(Number(t.pnl), true, symbol)}
                        </span>
                      </div>

                      {/* R:R */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {t.rr != null ? `${Number(t.rr).toFixed(1)}R` : '—'}
                        </span>
                      </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
