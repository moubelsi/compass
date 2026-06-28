'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, BookOpen, TrendingUp, AlertCircle, Brain, Lightbulb, LineChart, FlaskConical, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trade {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  strategy: string | null
  pnl: number
  return_pct: number | null
  trade_date: string | null
  created_at: string
}

interface JournalEntry {
  entry_date: string
  content: string | null
  went_well: string | null
  went_wrong: string | null
  biggest_lesson: string | null
  focus_tomorrow: string | null
  mood: string | null
}

interface NotebookPage {
  id: string
  slug: string
  title: string
  content: string | null
  updated_at: string
}

interface DayData {
  pnl: number
  trades: Trade[]
  entry: JournalEntry | null
}

// ─── Knowledge page config ────────────────────────────────────────────────────

const KNOWLEDGE_PAGES = [
  { slug: 'mistakes',     title: 'Trading Mistakes',     icon: AlertCircle,  color: 'var(--loss)',     dim: 'var(--loss-dim)' },
  { slug: 'lessons',      title: 'Lessons Learned',      icon: Lightbulb,    color: '#B45309',         dim: 'rgba(180,83,9,0.1)' },
  { slug: 'psychology',   title: 'Psychology',           icon: Brain,        color: 'var(--ai-accent)',dim: 'var(--ai-dim)' },
  { slug: 'observations', title: 'Market Observations',  icon: LineChart,    color: 'var(--profit)',   dim: 'var(--profit-dim)' },
  { slug: 'strategy',     title: 'Strategy Notes',       icon: BookOpen,     color: 'var(--accent)',   dim: 'rgba(100,116,139,0.1)' },
  { slug: 'ideas',        title: 'Ideas',                icon: FlaskConical, color: 'var(--text-secondary)', dim: 'var(--bg-elevated)' },
] as const

// ─── Slide-over panel ─────────────────────────────────────────────────────────

function DaySlideOver({ date, data, onClose }: { date: string; data: DayData; onClose: () => void }) {
  const { symbol } = useCurrency()
  const { pnl, trades, entry } = data
  const wins    = trades.filter(t => Number(t.pnl) > 0)
  const losses  = trades.filter(t => Number(t.pnl) < 0)
  const winRate = trades.length > 0 ? Math.round(wins.length / trades.length * 100) : 0
  const ret     = trades.reduce((s, t) => s + Number(t.return_pct || 0), 0)

  const d = new Date(date + 'T12:00:00')
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, backdropFilter: 'blur(2px)' }} />

      {/* Panel */}
      <div ref={panelRef} style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 51,
        width: 480, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        boxShadow: '-16px 0 40px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0, position: 'sticky', top: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                {d.toLocaleDateString('en-US', { weekday: 'long' })}
              </p>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
                {d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
            </div>
            <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Stats row */}
          {trades.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'P&L',     value: formatCurrency(pnl, true, symbol), color: pnl >= 0 ? 'var(--profit)' : 'var(--loss)' },
                { label: 'Return',  value: `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%`,             color: ret >= 0 ? 'var(--profit)' : 'var(--loss)' },
                { label: 'Trades',  value: String(trades.length),                                  color: 'var(--text-primary)' },
                { label: 'Win %',   value: `${winRate}%`,                                          color: winRate >= 50 ? 'var(--profit)' : 'var(--loss)' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: s.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Trades list */}
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
                      <span style={{ fontSize: 12, color: up ? 'var(--profit)' : 'var(--loss)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
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
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No trades on this day</p>
              <Link href="/trades/new" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', marginTop: 6, display: 'inline-block' }}>Log a trade →</Link>
            </div>
          )}

          {/* Journal entry */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Journal</p>
              <Link href={`/journal?date=${date}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Edit →</Link>
            </div>
            {entry ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {entry.mood && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{entry.mood}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mood</span>
                  </div>
                )}
                {[
                  { label: 'Session notes',   value: entry.content },
                  { label: 'Went well',       value: entry.went_well },
                  { label: 'Went wrong',      value: entry.went_wrong },
                  { label: 'Biggest lesson',  value: entry.biggest_lesson },
                  { label: 'Focus tomorrow',  value: entry.focus_tomorrow },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{f.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No journal entry for this day</p>
              </div>
            )}
          </div>

          {/* AI placeholder */}
          <div style={{ padding: '16px 18px', borderRadius: 8, background: 'var(--ai-dim)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Sparkles size={13} style={{ color: 'var(--ai-accent)' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai-accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI Day Summary</p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ai-accent)', opacity: 0.7, lineHeight: 1.55 }}>
              AI-powered summaries and pattern detection will appear here once enabled.
            </p>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── Knowledge page editor ────────────────────────────────────────────────────

function KnowledgeEditor({ page, onClose, onSaved }: { page: typeof KNOWLEDGE_PAGES[number]; onClose: () => void; onSaved: (content: string) => void }) {
  const [content, setContent] = useState('')
  const [saving, setSaving]   = useState(false)
  const [loaded, setLoaded]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    supabase.from('notebook_pages').select('content').eq('slug', page.slug).maybeSingle()
      .then(({ data }) => { setContent(data?.content || ''); setLoaded(true) })
  }, [page.slug])

  async function save() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }
    const { error: err } = await supabase.from('notebook_pages').upsert(
      { user_id: user.id, slug: page.slug, title: page.title, content, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,slug' }
    )
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(content)
    setSaving(false)
    onClose()
  }

  const Icon = page.icon

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 51, width: 560, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', boxShadow: '-16px 0 40px rgba(0,0,0,0.12)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: page.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} style={{ color: page.color }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{page.title}</h2>
            </div>
          </div>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>
        {loaded ? (
          <>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Write your ${page.title.toLowerCase()} here…\n\nMarkdown is supported. Use ## for headings, - for bullets, **bold**, etc.`}
              style={{ flex: 1, padding: '20px 24px', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, fontFamily: 'inherit' }}
              autoFocus
            />
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              {error && <p style={{ fontSize: 12, color: 'var(--loss)', flex: 1 }}>{error}</p>}
              <button onClick={onClose} style={{ fontSize: 13, padding: '8px 16px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotebookPage() {
  const { symbol } = useCurrency()
  const today    = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [trades, setTrades]     = useState<Trade[]>([])
  const [entries, setEntries]   = useState<JournalEntry[]>([])
  const [kbPages, setKbPages]   = useState<Record<string, NotebookPage>>({})
  const [loading, setLoading]   = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [kbOpen, setKbOpen]     = useState<string | null>(null)

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthStart = new Date(year, month, 1).toISOString().split('T')[0]
  const monthEnd   = new Date(year, month + 1, 0).toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: tData }, { data: eData }, { data: kData }] = await Promise.all([
        supabase.from('trades')
          .select('id, symbol, direction, strategy, pnl, return_pct, trade_date, created_at')
          .gte('trade_date', monthStart)
          .lte('trade_date', monthEnd)
          .order('trade_date'),
        supabase.from('journal_entries')
          .select('entry_date, content, went_well, went_wrong, biggest_lesson, focus_tomorrow, mood')
          .gte('entry_date', monthStart)
          .lte('entry_date', monthEnd),
        supabase.from('notebook_pages').select('*'),
      ])
      setTrades(tData || [])
      setEntries(eData || [])
      const map: Record<string, NotebookPage> = {}
      ;(kData || []).forEach((p: NotebookPage) => { map[p.slug] = p })
      setKbPages(map)
      setLoading(false)
    }
    load()
  }, [monthStart, monthEnd])

  // Build day map
  const dayMap: Record<string, DayData> = {}
  trades.forEach(t => {
    const d = t.trade_date || t.created_at.split('T')[0]
    if (!dayMap[d]) dayMap[d] = { pnl: 0, trades: [], entry: null }
    dayMap[d].pnl += Number(t.pnl || 0)
    dayMap[d].trades.push(t)
  })
  entries.forEach(e => {
    const d = e.entry_date
    if (!dayMap[d]) dayMap[d] = { pnl: 0, trades: [], entry: null }
    dayMap[d].entry = e
  })

  // Calendar cells
  const daysInMonth: { date: string; n: number }[] = []
  for (let d = new Date(year, month, 1); d.getMonth() === month; d.setDate(d.getDate() + 1))
    daysInMonth.push({ date: d.toISOString().split('T')[0], n: d.getDate() })

  const firstDow = new Date(year, month, 1).getDay()
  const offset   = firstDow === 0 ? 6 : firstDow - 1
  const totalCells = Math.ceil((offset + daysInMonth.length) / 7) * 7
  const cells: ({ date: string; n: number } | null)[] = [
    ...Array(offset).fill(null),
    ...daysInMonth,
    ...Array(totalCells - offset - daysInMonth.length).fill(null),
  ]

  const todayStr = today.toISOString().split('T')[0]
  const canNext  = new Date(year, month + 1, 1) <= today

  // Weekly totals
  const weeks: { days: typeof cells; pnl: number; trades: number }[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const wDays = cells.slice(i, i + 7)
    let wPnl = 0, wTrades = 0
    wDays.forEach(d => { if (d && dayMap[d.date]) { wPnl += dayMap[d.date].pnl; wTrades += dayMap[d.date].trades.length } })
    weeks.push({ days: wDays, pnl: wPnl, trades: wTrades })
  }

  // Month stats
  const monthPnl    = Object.values(dayMap).reduce((s, d) => s + d.pnl, 0)
  const monthTrades = trades.length
  const monthWins   = trades.filter(t => Number(t.pnl) > 0).length
  const tradingDays = Object.keys(dayMap).filter(d => dayMap[d].trades.length > 0).length
  const maxAbs      = Math.max(...daysInMonth.map(d => Math.abs(dayMap[d.date]?.pnl ?? 0)), 1)

  const selectedData = selectedDay ? (dayMap[selectedDay] || { pnl: 0, trades: [], entry: null }) : null

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '36px 56px 28px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>Notebook</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Daily review, monthly calendar, and knowledge base</p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 56px 64px', display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* Calendar */}
        <div>
          {/* Month nav + stats */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <ChevronLeft size={14} />
              </button>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', minWidth: 160 }}>
                {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => canNext && setViewDate(new Date(year, month + 1, 1))} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', cursor: canNext ? 'pointer' : 'default', color: canNext ? 'var(--text-muted)' : 'var(--border-default)', opacity: canNext ? 1 : 0.4 }}>
                <ChevronRight size={14} />
              </button>
              {viewDate.getMonth() !== today.getMonth() || viewDate.getFullYear() !== today.getFullYear() ? (
                <button onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                  Today
                </button>
              ) : null}
            </div>
            {!loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Month P&L</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: monthPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>
                    {formatCurrency(monthPnl, true, symbol)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Trades</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>{monthTrades}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Trading days</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>{tradingDays}</p>
                </div>
                {monthTrades > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Win %</p>
                    <p style={{ fontSize: 20, fontWeight: 600, color: monthWins / monthTrades >= 0.5 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>
                      {Math.round(monthWins / monthTrades * 100)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '20px 24px', overflow: 'hidden' }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 80px', gap: 4, marginBottom: 6 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textAlign: 'center', paddingBottom: 4 }}>{d}</div>
              ))}
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textAlign: 'center', paddingBottom: 4 }}>Week</div>
            </div>

            {/* Weeks */}
            {loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
              </div>
            ) : weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 80px', gap: 4, marginBottom: 4 }}>
                {week.days.map((cell, ci) => {
                  if (!cell) return <div key={ci} />
                  const data     = dayMap[cell.date]
                  const isToday  = cell.date === todayStr
                  const isFuture = cell.date > todayStr
                  const isSelected = cell.date === selectedDay
                  const hasTrades = (data?.trades.length ?? 0) > 0
                  const hasJournal = !!data?.entry
                  const alpha = data && hasTrades ? Math.max(0.08, Math.abs(data.pnl) / maxAbs) * 0.4 : 0
                  const bg = isSelected
                    ? 'var(--bg-overlay)'
                    : data && hasTrades
                    ? data.pnl >= 0 ? `rgba(61,153,112,${alpha})` : `rgba(192,57,43,${alpha})`
                    : 'var(--bg-elevated)'

                  return (
                    <button key={cell.date}
                      onClick={() => setSelectedDay(isSelected ? null : cell.date)}
                      disabled={isFuture}
                      style={{
                        borderRadius: 8, padding: '8px 6px 6px', textAlign: 'center', cursor: isFuture ? 'default' : 'pointer',
                        background: bg, opacity: isFuture ? 0.25 : 1,
                        border: isToday
                          ? `2px solid var(--accent)`
                          : isSelected
                          ? `2px solid var(--border-strong)`
                          : `1px solid ${(data && hasTrades) ? 'transparent' : 'var(--border-subtle)'}`,
                        minHeight: 68, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 3,
                        transition: 'all 0.1s',
                      }}>
                      <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--text-secondary)', lineHeight: 1 }}>{cell.n}</span>
                      {data && hasTrades && (
                        <>
                          <span style={{ fontSize: 10, fontWeight: 700, color: data.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                            {data.pnl >= 0 ? '+' : ''}{symbol}{Math.abs(data.pnl) >= 1000 ? (data.pnl / 1000).toFixed(1) + 'k' : Math.abs(data.pnl).toFixed(0)}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1 }}>{data.trades.length}t</span>
                        </>
                      )}
                      {hasJournal && !hasTrades && (
                        <span style={{ fontSize: 9, color: 'var(--journal-rose)', fontWeight: 500 }}>📔</span>
                      )}
                      {hasJournal && hasTrades && (
                        <span style={{ fontSize: 8, color: 'var(--journal-rose)', lineHeight: 1, opacity: 0.8 }}>●</span>
                      )}
                    </button>
                  )
                })}
                {/* Weekly total */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', borderRadius: 8, background: week.pnl !== 0 ? (week.pnl > 0 ? 'var(--profit-dim)' : 'var(--loss-dim)') : 'transparent' }}>
                  {week.trades > 0 ? (
                    <>
                      <span style={{ fontSize: 11, fontWeight: 700, color: week.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {week.pnl >= 0 ? '+' : ''}{symbol}{Math.abs(week.pnl) >= 1000 ? (week.pnl / 1000).toFixed(1) + 'k' : Math.abs(week.pnl).toFixed(0)}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{week.trades}t</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge pages */}
        <div>
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>Knowledge Base</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Capture patterns, mistakes, and insights that compound over time</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {KNOWLEDGE_PAGES.map(pg => {
              const Icon    = pg.icon
              const saved   = kbPages[pg.slug]
              const preview = saved?.content?.slice(0, 80)
              const words   = saved?.content?.trim().split(/\s+/).filter(Boolean).length ?? 0
              const updated = saved ? new Date(saved.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
              return (
                <button key={pg.slug}
                  onClick={() => setKbOpen(pg.slug)}
                  style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '20px', transition: 'all 0.12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = `1px solid ${pg.color}40`; (e.currentTarget as HTMLElement).style.background = pg.dim }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.border = '1px solid var(--border-subtle)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: pg.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} style={{ color: pg.color }} />
                    </div>
                    {saved && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-disabled)', marginTop: 4 }}>{updated}</span>}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 6 }}>{pg.title}</p>
                  {preview ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {preview}{saved?.content && saved.content.length > 80 ? '…' : ''}
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Nothing written yet — tap to start</p>
                  )}
                  {words > 0 && <p style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 8 }}>{words} words</p>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Slide-over: day detail */}
      {selectedDay && selectedData && (
        <DaySlideOver date={selectedDay} data={selectedData} onClose={() => setSelectedDay(null)} />
      )}

      {/* Slide-over: knowledge editor */}
      {kbOpen && (() => {
        const pg = KNOWLEDGE_PAGES.find(p => p.slug === kbOpen)!
        return (
          <KnowledgeEditor
            page={pg}
            onClose={() => setKbOpen(null)}
            onSaved={content => {
              setKbPages(prev => ({
                ...prev,
                [pg.slug]: { ...prev[pg.slug], slug: pg.slug, title: pg.title, content, updated_at: new Date().toISOString(), id: prev[pg.slug]?.id || '' },
              }))
            }}
          />
        )
      })()}
    </div>
  )
}
