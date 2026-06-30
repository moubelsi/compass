'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency, localDateStr } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trade {
  id: string; symbol: string; direction: 'LONG' | 'SHORT'
  pnl: number; return_pct: number | null; rr: number | null
  trade_date: string | null; created_at: string
}

interface NotebookPage {
  id: string; slug: string; title: string; content: string | null; updated_at: string
}

interface WeekInfo {
  year: number; week: number; slug: string; start: string; end: string; label: string
}

interface MonthInfo {
  year: number; month: number; slug: string; label: string; start: string; end: string
}

// ─── Folder config ────────────────────────────────────────────────────────────

const KB_FOLDERS = [
  { id: 'mistakes',     label: 'Trading Mistakes',    slug: 'mistakes' },
  { id: 'lessons',      label: 'Lessons Learned',     slug: 'lessons' },
  { id: 'psychology',   label: 'Psychology',          slug: 'psychology' },
  { id: 'observations', label: 'Market Observations', slug: 'observations' },
  { id: 'strategy',     label: 'Strategy Notes',      slug: 'strategy' },
  { id: 'ideas',        label: 'Ideas',               slug: 'ideas' },
] as const

const PLANNING_FOLDERS = [
  { id: 'weekly-focus',  label: 'Weekly Focus',  slug: 'planning-weekly-focus' },
  { id: 'trading-goals', label: 'Trading Goals', slug: 'planning-trading-goals' },
] as const

// ─── Week / month helpers ─────────────────────────────────────────────────────

function isoWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7)
}

function weekMondayUTC(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const day  = jan4.getUTCDay() || 7
  const mon  = new Date(jan4)
  mon.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7)
  return mon
}

function getWeeksForYear(year: number): WeekInfo[] {
  const today  = new Date()
  const dec28  = new Date(Date.UTC(year, 11, 28))
  const total  = isoWeekNum(dec28)
  const result: WeekInfo[] = []
  for (let w = 1; w <= total; w++) {
    const mon = weekMondayUTC(year, w)
    if (mon > today) break
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    result.push({
      year, week: w,
      slug: `week-${year}-${String(w).padStart(2, '0')}`,
      start: mon.toISOString().slice(0, 10),
      end:   sun.toISOString().slice(0, 10),
      label: `${fmt(mon)} – ${fmt(sun)}`,
    })
  }
  return result.reverse()
}

function getMonthsForYear(year: number): MonthInfo[] {
  const today  = new Date()
  const result: MonthInfo[] = []
  for (let m = 0; m <= 11; m++) {
    const date = new Date(year, m, 1)
    if (date > today) break
    result.push({
      year, month: m,
      slug:  `monthly-${year}-${String(m + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      start: localDateStr(new Date(year, m, 1)),
      end:   localDateStr(new Date(year, m + 1, 0)),
    })
  }
  return result.reverse()
}

function tradeDay(t: Trade): string {
  return (t.trade_date ? t.trade_date.slice(0, 10) : null) || localDateStr(new Date(t.created_at))
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────

function FolderNav({ active, onSelect }: { active: string | null; onSelect: (id: string) => void }) {
  const sectionLabel = (text: string) => (
    <p key={text} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '20px 16px 6px', margin: 0 }}>
      {text}
    </p>
  )

  const folderBtn = (id: string, label: string) => {
    const on = active === id
    return (
      <button key={id} onClick={() => onSelect(id)} style={{ width: '100%', textAlign: 'left', padding: '7px 16px', background: on ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderLeft: `2px solid ${on ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', fontSize: 13, color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: on ? 500 : 400, transition: 'all 0.1s' }}
        onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-elevated)' }}
        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
      >{label}</button>
    )
  }

  return (
    <div style={{ padding: '28px 0 20px' }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', padding: '0 16px', marginBottom: 20 }}>Notebook</p>
      {sectionLabel('Knowledge Base')}
      {KB_FOLDERS.map(f => folderBtn(f.id, f.label))}
      {sectionLabel('Performance')}
      {folderBtn('weekly-recaps', 'Weekly Recaps')}
      {folderBtn('monthly-reviews', 'Monthly Reviews')}
      {sectionLabel('Planning')}
      {PLANNING_FOLDERS.map(f => folderBtn(f.id, f.label))}
    </div>
  )
}

// ─── Middle list ──────────────────────────────────────────────────────────────

function MiddleList({ active, trades, pages, selectedNote, onSelect }: {
  active: string | null
  trades: Trade[]
  pages: Record<string, NotebookPage>
  selectedNote: string | null
  onSelect: (note: string) => void
}) {
  if (!active) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Select a folder</p>
      </div>
    )
  }

  // Knowledge Base
  const kbFolder = KB_FOLDERS.find(f => f.id === active)
  if (kbFolder) {
    const page    = pages[kbFolder.slug]
    const bullets = (page?.content ?? '').split('\n')
      .filter(l => /^[-•*]\s/.test(l.trim()))
      .map(l => l.trim().replace(/^[-•*]\s*/, ''))
      .filter(Boolean).slice(0, 14)
    const updated = page ? new Date(page.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{kbFolder.label}</p>
          {updated && <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>Updated {updated}</p>}
        </div>
        <div style={{ padding: '8px 20px' }}>
          {bullets.length > 0 ? bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0' }}>
              <span style={{ color: 'var(--text-disabled)', fontSize: 12, lineHeight: '20px', flexShrink: 0 }}>·</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{b}</span>
            </div>
          )) : (
            <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic', paddingTop: 8 }}>Nothing written yet</p>
          )}
        </div>
      </div>
    )
  }

  // Weekly Recaps
  if (active === 'weekly-recaps') {
    const year  = new Date().getFullYear()
    const weeks = getWeeksForYear(year)

    const weekStats: Record<string, { pnl: number; count: number }> = {}
    trades.forEach(t => {
      const d   = tradeDay(t)
      const dt  = new Date(d + 'T12:00:00')
      const slug = `week-${dt.getFullYear()}-${String(isoWeekNum(dt)).padStart(2, '0')}`
      if (!weekStats[slug]) weekStats[slug] = { pnl: 0, count: 0 }
      weekStats[slug].pnl   += Number(t.pnl || 0)
      weekStats[slug].count += 1
    })

    return (
      <div>
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Weekly Recaps</p>
          <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>{year}</p>
        </div>
        {weeks.map(w => {
          const s  = weekStats[w.slug]
          const on = selectedNote === w.slug
          return (
            <button key={w.slug} onClick={() => onSelect(w.slug)} style={{ width: '100%', textAlign: 'left', padding: '10px 20px', background: on ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>
                W{String(w.week).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>{w.label}</span>
              {s?.count ? (
                <span style={{ fontSize: 11, fontWeight: 500, color: s.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.pnl >= 0 ? '+' : ''}${Math.abs(s.pnl).toFixed(0)}
                </span>
              ) : <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>—</span>}
              {pages[w.slug] && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'block', opacity: 0.5, flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    )
  }

  // Monthly Reviews
  if (active === 'monthly-reviews') {
    const year   = new Date().getFullYear()
    const months = getMonthsForYear(year)

    const monthStats: Record<string, { pnl: number; count: number; wins: number }> = {}
    trades.forEach(t => {
      const d    = tradeDay(t)
      const slug = `monthly-${d.slice(0, 4)}-${d.slice(5, 7)}`
      if (!monthStats[slug]) monthStats[slug] = { pnl: 0, count: 0, wins: 0 }
      monthStats[slug].pnl   += Number(t.pnl || 0)
      monthStats[slug].count += 1
      if (Number(t.pnl) > 0) monthStats[slug].wins += 1
    })

    return (
      <div>
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Monthly Reviews</p>
          <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>{year}</p>
        </div>
        {months.map(m => {
          const s  = monthStats[m.slug]
          const on = selectedNote === m.slug
          return (
            <button key={m.slug} onClick={() => onSelect(m.slug)} style={{ width: '100%', textAlign: 'left', padding: '12px 20px', background: on ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: on ? 500 : 400, marginBottom: s ? 2 : 0 }}>{m.label}</p>
                {s && <p style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{s.count} trade{s.count !== 1 ? 's' : ''} · {Math.round(s.wins / s.count * 100)}% win</p>}
              </div>
              {s ? (
                <span style={{ fontSize: 12, fontWeight: 500, color: s.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.pnl >= 0 ? '+' : ''}${Math.abs(s.pnl).toFixed(0)}
                </span>
              ) : <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>—</span>}
            </button>
          )
        })}
      </div>
    )
  }

  // Planning
  const planFolder = PLANNING_FOLDERS.find(f => f.id === active)
  if (planFolder) {
    const page    = pages[planFolder.slug]
    const preview = page?.content?.trim().slice(0, 160)
    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{planFolder.label}</p>
        </div>
        <div style={{ padding: '12px 20px' }}>
          {preview
            ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{preview}</p>
            : <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Nothing written yet</p>}
        </div>
      </div>
    )
  }

  return null
}

// ─── Page editor (KB + Planning) ─────────────────────────────────────────────

function PageEditor({ slug, title, page, onSaved }: {
  slug: string; title: string; page: NotebookPage | null
  onSaved: (p: NotebookPage) => void
}) {
  const [content, setContent] = useState(page?.content ?? '')
  const [dirty,   setDirty]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => { setContent(page?.content ?? ''); setDirty(false) }, [slug, page?.content])

  async function save() {
    setSaving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }
    const { data, error: err } = await supabase.from('notebook_pages').upsert(
      { user_id: user.id, slug, title, content, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,slug' }
    ).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(data as NotebookPage)
    setDirty(false); setSaving(false)
  }

  const updated = page ? new Date(page.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  return (
    <div style={{ padding: '48px 60px', maxWidth: 760, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6 }}>{title}</h1>
        <p style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{updated ? `Updated ${updated}` : 'Not yet saved'}</p>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 28 }} />

      <textarea
        value={content}
        onChange={e => { setContent(e.target.value); setDirty(true) }}
        placeholder={`Write your ${title.toLowerCase()} here…\n\nUse markdown:\n- Bullet point\n## Heading\n**Bold text**`}
        style={{ flex: 1, minHeight: 440, width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.9, color: 'var(--text-primary)', fontFamily: 'inherit', letterSpacing: '0.005em' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 20, borderTop: '1px solid var(--border-subtle)', marginTop: 24 }}>
        {error && <p style={{ fontSize: 12, color: 'var(--loss)', flex: 1 }}>{error}</p>}
        <button onClick={save} disabled={saving || !dirty} style={{ padding: '8px 22px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: dirty && !saving ? 'pointer' : 'default', background: dirty ? 'var(--text-primary)' : 'var(--bg-elevated)', color: dirty ? 'var(--bg-base)' : 'var(--text-disabled)', transition: 'all 0.15s' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Weekly recap ─────────────────────────────────────────────────────────────

const WEEKLY_FIELDS = [
  { key: 'went_well',       label: 'What went well this week?' },
  { key: 'can_improve',     label: 'What can improve?' },
  { key: 'biggest_lesson',  label: 'Biggest lesson' },
  { key: 'emotional_state', label: 'Emotional state' },
  { key: 'next_focus',      label: "Next week's focus" },
  { key: 'commitments',     label: 'Commitments' },
] as const

type WeeklyKey = typeof WEEKLY_FIELDS[number]['key']
type WeeklyForm = Record<WeeklyKey, string>
const EMPTY_WEEKLY: WeeklyForm = { went_well: '', can_improve: '', biggest_lesson: '', emotional_state: '', next_focus: '', commitments: '' }

function parseWeekly(content: string | null | undefined): WeeklyForm {
  if (!content) return { ...EMPTY_WEEKLY }
  try { return { ...EMPTY_WEEKLY, ...JSON.parse(content) } } catch { return { ...EMPTY_WEEKLY, went_well: content } }
}

function WeeklyRecap({ week, trades, page, onSaved, symbol }: {
  week: WeekInfo; trades: Trade[]; page: NotebookPage | null
  onSaved: (p: NotebookPage) => void; symbol: string
}) {
  const [form,      setForm]      = useState<WeeklyForm>(() => parseWeekly(page?.content))
  const [savedForm, setSavedForm] = useState<WeeklyForm>(() => parseWeekly(page?.content))
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    const f = parseWeekly(page?.content)
    setForm(f); setSavedForm(f)
  }, [week.slug, page?.content])

  const weekTrades  = trades.filter(t => { const d = tradeDay(t); return d >= week.start && d <= week.end })
  const weekPnl     = weekTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const wins        = weekTrades.filter(t => Number(t.pnl) > 0)
  const losses      = weekTrades.filter(t => Number(t.pnl) < 0)
  const winRate     = weekTrades.length > 0 ? Math.round(wins.length / weekTrades.length * 100) : 0
  const rrTrades    = weekTrades.filter(t => t.rr != null)
  const avgR        = rrTrades.length > 0 ? rrTrades.reduce((s, t) => s + Number(t.rr), 0) / rrTrades.length : null
  const tradingDays = new Set(weekTrades.map(t => tradeDay(t))).size

  // Daily cumulative chart
  const byDay: Record<string, number> = {}
  weekTrades.forEach(t => { const d = tradeDay(t); byDay[d] = (byDay[d] || 0) + Number(t.pnl || 0) })
  let cum = 0
  const chartData = [{ day: '', pnl: 0 }]
  for (let i = 0; i < 5; i++) {
    const dt = new Date(week.start + 'T12:00:00')
    dt.setDate(dt.getDate() + i)
    cum += byDay[localDateStr(dt)] || 0
    chartData.push({ day: ['Mon','Tue','Wed','Thu','Fri'][i], pnl: parseFloat(cum.toFixed(2)) })
  }
  const chartColor = weekPnl >= 0 ? 'var(--profit)' : 'var(--loss)'

  const dirty = WEEKLY_FIELDS.some(f => form[f.key] !== savedForm[f.key])

  async function save() {
    setSaving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }
    const { data, error: err } = await supabase.from('notebook_pages').upsert(
      { user_id: user.id, slug: week.slug, title: `Week ${week.week} ${week.year}`, content: JSON.stringify(form), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,slug' }
    ).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(data as NotebookPage); setSavedForm(form); setSaving(false)
  }

  const startFmt = new Date(week.start + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const endFmt   = new Date(week.end   + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ padding: '48px 60px', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Week {String(week.week).padStart(2, '0')}
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {startFmt} – {endFmt}
        </h1>
        {weekTrades.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-disabled)', marginTop: 8, fontStyle: 'italic' }}>No trades this week</p>}
      </div>

      {/* Stats row */}
      {weekTrades.length > 0 && (
        <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '18px 0', marginBottom: 32, gap: 0 }}>
          {[
            { label: 'Net P&L',  value: formatCurrency(weekPnl, true, symbol), color: weekPnl >= 0 ? 'var(--profit)' : 'var(--loss)' },
            { label: 'Trades',   value: String(weekTrades.length) },
            { label: 'Win rate', value: `${winRate}%`, color: winRate >= 50 ? 'var(--profit)' : 'var(--loss)' },
            { label: 'Avg R',    value: avgR != null ? `${avgR >= 0 ? '+' : ''}${avgR.toFixed(1)}R` : '—' },
            { label: 'Days',     value: String(tradingDays) },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, paddingRight: i < arr.length - 1 ? 20 : 0, borderRight: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', marginRight: i < arr.length - 1 ? 20 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: (s as any).color ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Equity curve — thin, context only */}
      {weekTrades.length > 0 && (
        <div style={{ marginBottom: 36, height: 56 }}>
          <ResponsiveContainer width="100%" height={56}>
            <LineChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <YAxis hide domain={['auto', 'auto']} />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-disabled)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="var(--border-subtle)" strokeWidth={1} />
              <Line type="monotone" dataKey="pnl" stroke={chartColor} strokeWidth={1.5} dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: chartColor }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 36 }} />

      {/* Reflection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {WEEKLY_FIELDS.map(f => (
          <div key={f.key}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{f.label}</p>
            <textarea
              value={form[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder="Write here…"
              rows={3}
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.85, color: 'var(--text-primary)', fontFamily: 'inherit', paddingBottom: 12 }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 28, marginTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
        {error && <p style={{ fontSize: 12, color: 'var(--loss)', flex: 1, alignSelf: 'center' }}>{error}</p>}
        <button onClick={save} disabled={saving || !dirty} style={{ padding: '8px 22px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: dirty && !saving ? 'pointer' : 'default', background: dirty ? 'var(--text-primary)' : 'var(--bg-elevated)', color: dirty ? 'var(--bg-base)' : 'var(--text-disabled)', transition: 'all 0.15s' }}>
          {saving ? 'Saving…' : 'Save reflection'}
        </button>
      </div>
      <div style={{ height: 60 }} />
    </div>
  )
}

// ─── Monthly review ───────────────────────────────────────────────────────────

const MONTHLY_FIELDS = [
  { key: 'overview',        label: 'Month overview' },
  { key: 'best_period',     label: 'Best period' },
  { key: 'biggest_lesson',  label: 'Biggest lesson' },
  { key: 'next_month',      label: 'Focus for next month' },
] as const

type MonthlyKey = typeof MONTHLY_FIELDS[number]['key']
type MonthlyForm = Record<MonthlyKey, string>
const EMPTY_MONTHLY: MonthlyForm = { overview: '', best_period: '', biggest_lesson: '', next_month: '' }

function parseMonthly(c: string | null | undefined): MonthlyForm {
  if (!c) return { ...EMPTY_MONTHLY }
  try { return { ...EMPTY_MONTHLY, ...JSON.parse(c) } } catch { return { ...EMPTY_MONTHLY, overview: c } }
}

function MonthlyReview({ month, trades, page, onSaved, symbol }: {
  month: MonthInfo; trades: Trade[]; page: NotebookPage | null
  onSaved: (p: NotebookPage) => void; symbol: string
}) {
  const [form,      setForm]      = useState<MonthlyForm>(() => parseMonthly(page?.content))
  const [savedForm, setSavedForm] = useState<MonthlyForm>(() => parseMonthly(page?.content))
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => { const f = parseMonthly(page?.content); setForm(f); setSavedForm(f) }, [month.slug, page?.content])

  const mTrades  = trades.filter(t => { const d = tradeDay(t); return d >= month.start && d <= month.end })
  const mPnl     = mTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const mWins    = mTrades.filter(t => Number(t.pnl) > 0).length
  const winRate  = mTrades.length > 0 ? Math.round(mWins / mTrades.length * 100) : 0
  const mDays    = new Set(mTrades.map(t => tradeDay(t))).size

  const dirty = MONTHLY_FIELDS.some(f => form[f.key] !== savedForm[f.key])

  async function save() {
    setSaving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }
    const { data, error: err } = await supabase.from('notebook_pages').upsert(
      { user_id: user.id, slug: month.slug, title: month.label, content: JSON.stringify(form), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,slug' }
    ).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(data as NotebookPage); setSavedForm(form); setSaving(false)
  }

  return (
    <div style={{ padding: '48px 60px', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Monthly Review</p>
        <h1 style={{ fontSize: 30, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{month.label}</h1>
      </div>

      {mTrades.length > 0 && (
        <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '18px 0', marginBottom: 32, gap: 0 }}>
          {[
            { label: 'Net P&L',  value: formatCurrency(mPnl, true, symbol), color: mPnl >= 0 ? 'var(--profit)' : 'var(--loss)' },
            { label: 'Trades',   value: String(mTrades.length) },
            { label: 'Win rate', value: `${winRate}%`, color: winRate >= 50 ? 'var(--profit)' : 'var(--loss)' },
            { label: 'Days',     value: String(mDays) },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, paddingRight: i < arr.length - 1 ? 20 : 0, borderRight: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', marginRight: i < arr.length - 1 ? 20 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: (s as any).color ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 36 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {MONTHLY_FIELDS.map(f => (
          <div key={f.key}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{f.label}</p>
            <textarea
              value={form[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder="Write here…"
              rows={4}
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.85, color: 'var(--text-primary)', fontFamily: 'inherit', paddingBottom: 12 }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 28, marginTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
        {error && <p style={{ fontSize: 12, color: 'var(--loss)', flex: 1, alignSelf: 'center' }}>{error}</p>}
        <button onClick={save} disabled={saving || !dirty} style={{ padding: '8px 22px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: dirty && !saving ? 'pointer' : 'default', background: dirty ? 'var(--text-primary)' : 'var(--bg-elevated)', color: dirty ? 'var(--bg-base)' : 'var(--text-disabled)', transition: 'all 0.15s' }}>
          {saving ? 'Saving…' : 'Save review'}
        </button>
      </div>
      <div style={{ height: 60 }} />
    </div>
  )
}

// ─── Right panel dispatcher ───────────────────────────────────────────────────

function RightPanel({ active, selectedNote, trades, pages, onSaved, symbol }: {
  active: string | null; selectedNote: string | null
  trades: Trade[]; pages: Record<string, NotebookPage>
  onSaved: (p: NotebookPage) => void; symbol: string
}) {
  const kbFolder = KB_FOLDERS.find(f => f.id === active)
  if (kbFolder) return <PageEditor slug={kbFolder.slug} title={kbFolder.label} page={pages[kbFolder.slug] ?? null} onSaved={onSaved} />

  const planFolder = PLANNING_FOLDERS.find(f => f.id === active)
  if (planFolder) return <PageEditor slug={planFolder.slug} title={planFolder.label} page={pages[planFolder.slug] ?? null} onSaved={onSaved} />

  if (active === 'weekly-recaps' && selectedNote) {
    const weeks = getWeeksForYear(new Date().getFullYear())
    const week  = weeks.find(w => w.slug === selectedNote)
    if (week) return <WeeklyRecap week={week} trades={trades} page={pages[selectedNote] ?? null} onSaved={onSaved} symbol={symbol} />
  }

  if (active === 'monthly-reviews' && selectedNote) {
    const months = getMonthsForYear(new Date().getFullYear())
    const month  = months.find(m => m.slug === selectedNote)
    if (month) return <MonthlyReview month={month} trades={trades} page={pages[selectedNote] ?? null} onSaved={onSaved} symbol={symbol} />
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
      <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
        {active === 'weekly-recaps' || active === 'monthly-reviews' ? 'Select a period to begin' : active ? 'Open a note to begin writing' : 'Select a folder from the left'}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotebookPage() {
  const { symbol } = useCurrency()
  const [trades,  setTrades]  = useState<Trade[]>([])
  const [pages,   setPages]   = useState<Record<string, NotebookPage>>({})
  const [loading, setLoading] = useState(true)

  const [activeFolder,  setActiveFolder]  = useState<string | null>(null)
  const [selectedNote,  setSelectedNote]  = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const since = new Date(); since.setFullYear(since.getFullYear() - 2)
      const sinceStr = since.toISOString().slice(0, 10)
      const [{ data: tData }, { data: kData }] = await Promise.all([
        supabase.from('trades').select('id, symbol, direction, pnl, return_pct, rr, trade_date, created_at').gte('trade_date', sinceStr).order('trade_date'),
        supabase.from('notebook_pages').select('*'),
      ])
      setTrades((tData || []) as Trade[])
      const map: Record<string, NotebookPage> = {}
      ;(kData || []).forEach((p: NotebookPage) => { map[p.slug] = p })
      setPages(map)
      setLoading(false)
    }
    load()
  }, [])

  function handleFolderSelect(id: string) {
    setActiveFolder(id)
    const isKb   = KB_FOLDERS.some(f => f.id === id)
    const isPlan = PLANNING_FOLDERS.some(f => f.id === id)
    if (isKb || isPlan) setSelectedNote(id)
    else setSelectedNote(null)
  }

  function handleSaved(page: NotebookPage) {
    setPages(prev => ({ ...prev, [page.slug]: page }))
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Left — folder nav */}
      <div style={{ width: 220, height: '100%', overflowY: 'auto', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <FolderNav active={activeFolder} onSelect={handleFolderSelect} />
      </div>

      {/* Middle — note list */}
      <div style={{ width: 258, height: '100%', overflowY: 'auto', flexShrink: 0, borderRight: '1px solid var(--border-subtle)' }}>
        {loading
          ? <div style={{ padding: 24 }}><p style={{ fontSize: 13, color: 'var(--text-disabled)' }}>Loading…</p></div>
          : <MiddleList active={activeFolder} trades={trades} pages={pages} selectedNote={selectedNote} onSelect={setSelectedNote} />}
      </div>

      {/* Right — content */}
      <div style={{ flex: 1, height: '100%', overflowY: 'auto', minWidth: 0 }}>
        <RightPanel active={activeFolder} selectedNote={selectedNote} trades={trades} pages={pages} onSaved={handleSaved} symbol={symbol} />
      </div>
    </div>
  )
}
