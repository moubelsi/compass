'use client'

import { useEffect, useRef, useState } from 'react'
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

function focusSlug(w: { year: number; week: number }): string {
  return `focus-${w.year}-${String(w.week).padStart(2, '0')}`
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────

function FolderNav({ active, counts, onSelect }: { active: string | null; counts: Record<string, number>; onSelect: (id: string) => void }) {
  const sectionLabel = (text: string) => (
    <p key={text} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '20px 16px 6px', margin: 0 }}>
      {text}
    </p>
  )

  const folderBtn = (id: string, label: string) => {
    const on = active === id
    const n  = counts[id] ?? 0
    return (
      <button key={id} onClick={() => onSelect(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', padding: '7px 16px', background: on ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderLeft: `2px solid ${on ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', fontSize: 13, color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: on ? 500 : 400, transition: 'all 0.1s' }}
        onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-elevated)' }}
        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label}</span>
        {n > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{n}</span>
        )}
      </button>
    )
  }

  return (
    <div style={{ padding: '12px 0 20px' }}>
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

function MiddleList({ active, trades, pages, selectedNote, onSelect, onCreateNote }: {
  active: string | null
  trades: Trade[]
  pages: Record<string, NotebookPage>
  selectedNote: string | null
  onSelect: (note: string) => void
  onCreateNote: (folderId: string) => void
}) {
  if (!active) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Select a folder</p>
      </div>
    )
  }

  // Note folders (Knowledge Base + Trading Goals) — free-form document lists
  const noteFolder = KB_FOLDERS.find(f => f.id === active)
    ?? (active === 'trading-goals' ? { id: 'trading-goals' as const, label: 'Trading Goals' } : undefined)
  if (noteFolder) {
    const notes = Object.values(pages)
      .filter(p => p.slug === noteFolder.id || p.slug.startsWith(noteFolder.id + '-'))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    const emptyCopy = noteFolder.id === 'trading-goals' ? 'No goals yet' : 'No notes yet'
    const createCopy = noteFolder.id === 'trading-goals' ? 'Set your first goal →' : 'Create first note →'

    return (
      <div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{noteFolder.label}</p>
          <button onClick={() => onCreateNote(noteFolder.id)}
            style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '2px 0' }}>
            + New
          </button>
        </div>
        {notes.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic', marginBottom: 12 }}>{emptyCopy}</p>
            <button onClick={() => onCreateNote(noteFolder.id)}
              style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {createCopy}
            </button>
          </div>
        ) : notes.map(note => {
          const on      = selectedNote === note.slug
          const preview = (note.content ?? '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/[#*`]/g, '').replace(/\n/g, ' ').trim().slice(0, 80)
          const date    = new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <button key={note.slug} onClick={() => onSelect(note.slug)}
              style={{ width: '100%', textAlign: 'left', padding: '12px 20px', background: on ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', borderLeft: `2px solid ${on ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: on ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, marginRight: 8 }}>
                  {note.title || 'Untitled'}
                </p>
                <span style={{ fontSize: 11, color: 'var(--text-disabled)', flexShrink: 0 }}>{date}</span>
              </div>
              {preview && <p style={{ fontSize: 12, color: 'var(--text-disabled)', lineHeight: 1.5, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{preview}</p>}
            </button>
          )
        })}
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

  // Weekly Focus — one document per week, mirroring Weekly Recaps
  if (active === 'weekly-focus') {
    const year  = new Date().getFullYear()
    const weeks = getWeeksForYear(year)
    return (
      <div>
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Weekly Focus</p>
          <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>{year}</p>
        </div>
        {weeks.map(w => {
          const slug = focusSlug(w)
          const on   = selectedNote === slug
          return (
            <button key={slug} onClick={() => onSelect(slug)} style={{ width: '100%', textAlign: 'left', padding: '10px 20px', background: on ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>
                W{String(w.week).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>{w.label}</span>
              {pages[slug] && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'block', opacity: 0.5, flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    )
  }

  return null
}

function extractImages(text: string): string[] {
  return [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m => m[1])
}

// ─── Markdown rendering (calm subset: headings, bold, italic, code, bullets) ──

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      nodes.push(<strong key={i++} style={{ fontWeight: 600 }}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('`')) {
      nodes.push(<code key={i++} style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.88em', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>{tok.slice(1, -1)}</code>)
    } else {
      nodes.push(<em key={i++}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function MarkdownView({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let list: React.ReactNode[] | null = null
  let k = 0
  const flushList = () => {
    if (list) {
      out.push(<ul key={k++} style={{ margin: '4px 0 14px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>{list}</ul>)
      list = null
    }
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*]\s+(.*)/)
    if (bullet) {
      ;(list ??= []).push(<li key={k++} style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-primary)', letterSpacing: '0.005em' }}>{renderInline(bullet[1])}</li>)
      continue
    }
    flushList()
    if (!line.trim()) continue
    // Forgiving heading syntax: '## Heading', '##Heading' and '##Heading##'
    // all work; a single '#' still requires the space so '#1 priority' stays text
    const h = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/) || line.match(/^(#{2,3})\s*(.+?)\s*#*\s*$/)
    if (h) {
      const size = h[1].length === 1 ? 22 : h[1].length === 2 ? 18 : 16
      out.push(<p key={k++} style={{ fontSize: size, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '20px 0 8px' }}>{renderInline(h[2])}</p>)
      continue
    }
    out.push(<p key={k++} style={{ fontSize: 15, lineHeight: 1.9, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '0.005em' }}>{renderInline(line)}</p>)
  }
  flushList()
  return <div>{out}</div>
}

// ─── Page editor (KB + Planning) ─────────────────────────────────────────────

function PageEditor({ slug, title: initTitle, editableTitle = false, page, onSaved, onDeleted }: {
  slug: string; title: string; editableTitle?: boolean; page: NotebookPage | null
  onSaved: (p: NotebookPage) => void
  onDeleted: (slug: string) => void
}) {
  const [title,       setTitle]       = useState(page?.title ?? initTitle)
  const [content,     setContent]     = useState(page?.content ?? '')
  const [saveState,   setSaveState]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [editing,     setEditing]     = useState(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taRef      = useRef<HTMLTextAreaElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const pageRef    = useRef(page)
  const titleRef   = useRef(title)
  const editingRef = useRef(false)
  pageRef.current  = page
  titleRef.current = title

  // Reset when navigating to a different note
  useEffect(() => {
    setTitle(page?.title ?? initTitle)
    setContent(page?.content ?? '')
    setSaveState('idle')
    setSaveError(null)
    setConfirmDel(false)
    setEditing(false)
    editingRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [slug]) // intentionally only slug — not page content (avoids mid-type reset)

  // Entering edit mode puts the caret back in the text
  useEffect(() => { if (editing) taRef.current?.focus() }, [editing])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  async function doSave(text: string) {
    if (!text.trim() && !pageRef.current) return
    setSaveState('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveState('error'); setSaveError('Not signed in'); return }
    const now = new Date().toISOString()
    const t   = titleRef.current || initTitle
    let result
    if (pageRef.current?.id) {
      result = await supabase.from('notebook_pages')
        .update({ title: t, content: text, updated_at: now })
        .eq('id', pageRef.current.id)
        .select().single()
    } else {
      result = await supabase.from('notebook_pages')
        .insert({ user_id: user.id, slug, title: t, content: text, updated_at: now })
        .select().single()
    }
    const { data, error: err } = result
    editingRef.current = false
    if (err) { setSaveState('error'); setSaveError(err.message); return }
    onSaved(data as NotebookPage)
    setSaveState('saved')
    setTimeout(() => setSaveState(s => s === 'saved' ? 'idle' : s), 2500)
  }

  function handleChange(value: string) {
    editingRef.current = true
    setContent(value)
    setSaveState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSave(value), 1500)
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSaveError(null)
    setSaveState('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveError('Not signed in'); setSaveState('error'); return }
    const ext  = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('screenshots').upload(path, file)
    if (uploadErr) { setSaveError(`Upload failed: ${uploadErr.message}`); setSaveState('error'); return }
    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(path)
    const insert = `\n![](${urlData.publicUrl})\n`
    const pos    = taRef.current?.selectionStart ?? content.length
    setSaveState('idle')
    handleChange(content.slice(0, pos) + insert + content.slice(pos))
    e.target.value = ''
  }

  async function handleDelete() {
    if (!pageRef.current?.id) { setConfirmDel(false); setContent(''); return }
    const { error: err } = await supabase.from('notebook_pages').delete().eq('id', pageRef.current.id)
    if (err) { setSaveError(err.message); setConfirmDel(false); return }
    setContent('')
    setConfirmDel(false)
    onDeleted(slug)
  }

  const updated = page ? new Date(page.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="m-pad" style={{ padding: '48px 60px', maxWidth: 760, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
          {editableTitle ? (
            <input
              value={title}
              onChange={e => {
                setTitle(e.target.value)
                if (timerRef.current) clearTimeout(timerRef.current)
                timerRef.current = setTimeout(() => doSave(content), 1500)
              }}
              placeholder="Note title…"
              style={{ fontSize: 30, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6, background: 'transparent', border: 'none', outline: 'none', width: '100%', fontFamily: 'inherit' }}
            />
          ) : (
            <h1 style={{ fontSize: 30, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6 }}>{title}</h1>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{updated ? `Updated ${updated}` : 'Not yet saved'}</p>
            {saveState === 'saving' && <span style={{ fontSize: 12, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Saving…</span>}
            {saveState === 'saved'  && <span style={{ fontSize: 12, color: 'var(--profit)' }}>Saved</span>}
            {saveState === 'error'  && <span style={{ fontSize: 12, color: 'var(--loss)' }}>{saveError}</span>}
          </div>
        </div>
        {/* Delete */}
        {page && !confirmDel && (
          <button type="button" onClick={() => setConfirmDel(true)}
            style={{ fontSize: 12, color: 'var(--text-disabled)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-disabled)')}>
            Delete note
          </button>
        )}
        {confirmDel && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Delete this note?</span>
            <button type="button" onClick={handleDelete}
              style={{ fontSize: 12, color: 'var(--loss)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>
              Yes, delete
            </button>
            <button type="button" onClick={() => setConfirmDel(false)}
              style={{ fontSize: 12, color: 'var(--text-disabled)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 28 }} />

      {(() => {
        // No trimEnd here: it would eat the space the user just typed
        const textOnly = content.replace(/\n?!\[[^\]]*\]\([^)]+\)\n?/g, '')
        // Reading view when there is content and the user isn't typing;
        // click anywhere in the text to switch back to the editor
        if (!editing && textOnly.trim()) {
          return (
            <div onClick={() => setEditing(true)} title="Click to edit"
              style={{ flex: 1, minHeight: 200, cursor: 'text' }}>
              <MarkdownView text={textOnly} />
            </div>
          )
        }
        return (
          <textarea
            ref={taRef}
            value={textOnly}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            onChange={e => {
              const imgs = extractImages(content)
              const imgBlock = imgs.length > 0 ? '\n' + imgs.map(u => `![](${u})`).join('\n') : ''
              handleChange(e.target.value + imgBlock)
            }}
            placeholder={`${title.trim() ? `Write your ${title.toLowerCase()} here…` : 'Write here…'}\n\nUse markdown:\n- Bullet point\n## Heading\n**Bold text**`}
            style={{ flex: 1, minHeight: 200, width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.9, color: 'var(--text-primary)', fontFamily: 'inherit', letterSpacing: '0.005em' }}
          />
        )
      })()}

      {extractImages(content).length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {extractImages(content).map((url, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={url} alt="" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'block' }} />
              <button type="button"
                onClick={() => handleChange(content.replace(`\n![](${url})`, '').replace(`![](${url})\n`, '').replace(`![](${url})`, ''))}
                style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ paddingTop: 20, borderTop: '1px solid var(--border-subtle)', marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ fontSize: 12, color: 'var(--text-disabled)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-disabled)')}>
          ↑ Attach image
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAttach} />
        <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>PNG · JPG · up to 10 MB</span>
        <span style={{ fontSize: 11, color: 'var(--text-disabled)', marginLeft: 'auto' }}>Click outside the text to preview formatting</span>
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error,     setError]     = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageRef  = useRef(page)
  pageRef.current = page

  useEffect(() => {
    const f = parseWeekly(page?.content)
    setForm(f); setSavedForm(f); setSaveState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [week.slug, page?.content])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

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

  async function doSave(f: WeeklyForm) {
    setSaveState('saving'); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveState('error'); setError('Not signed in'); return }
    const now   = new Date().toISOString()
    const title = `Week ${week.week} ${week.year}`
    const content = JSON.stringify(f)
    let result
    if (pageRef.current?.id) {
      result = await supabase.from('notebook_pages').update({ title, content, updated_at: now }).eq('id', pageRef.current.id).select().single()
    } else {
      result = await supabase.from('notebook_pages').insert({ user_id: user.id, slug: week.slug, title, content, updated_at: now }).select().single()
    }
    const { data, error: err } = result
    if (err) { setSaveState('error'); setError(err.message); return }
    onSaved(data as NotebookPage); setSavedForm(f)
    setSaveState('saved')
    setTimeout(() => setSaveState(s => s === 'saved' ? 'idle' : s), 2500)
  }

  function updateField(key: WeeklyKey, value: string) {
    const next = { ...form, [key]: value }
    setForm(next)
    setSaveState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSave(next), 1500)
  }

  const dirty = WEEKLY_FIELDS.some(f => form[f.key] !== savedForm[f.key])

  const startFmt = new Date(week.start + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const endFmt   = new Date(week.end   + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="m-pad" style={{ padding: '48px 60px', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
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
              onChange={e => updateField(f.key, e.target.value)}
              placeholder="Write here…"
              rows={3}
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.85, color: 'var(--text-primary)', fontFamily: 'inherit', paddingBottom: 12 }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 28, marginTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
        {saveState === 'saving' && <span style={{ fontSize: 12, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Saving…</span>}
        {saveState === 'saved'  && <span style={{ fontSize: 12, color: 'var(--profit)' }}>Saved</span>}
        {saveState === 'error'  && <span style={{ fontSize: 12, color: 'var(--loss)' }}>{error}</span>}
        <button onClick={() => doSave(form)} disabled={saveState === 'saving' || !dirty} style={{ padding: '8px 22px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: dirty && saveState !== 'saving' ? 'pointer' : 'default', background: dirty ? 'var(--text-primary)' : 'var(--bg-elevated)', color: dirty ? 'var(--bg-base)' : 'var(--text-disabled)', transition: 'all 0.15s' }}>
          Save reflection
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error,     setError]     = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageRef  = useRef(page)
  pageRef.current = page

  useEffect(() => {
    const f = parseMonthly(page?.content); setForm(f); setSavedForm(f); setSaveState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [month.slug, page?.content])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const mTrades  = trades.filter(t => { const d = tradeDay(t); return d >= month.start && d <= month.end })
  const mPnl     = mTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const mWins    = mTrades.filter(t => Number(t.pnl) > 0).length
  const winRate  = mTrades.length > 0 ? Math.round(mWins / mTrades.length * 100) : 0
  const mDays    = new Set(mTrades.map(t => tradeDay(t))).size

  const dirty = MONTHLY_FIELDS.some(f => form[f.key] !== savedForm[f.key])

  async function doSave(f: MonthlyForm) {
    setSaveState('saving'); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveState('error'); setError('Not signed in'); return }
    const now     = new Date().toISOString()
    const content = JSON.stringify(f)
    let result
    if (pageRef.current?.id) {
      result = await supabase.from('notebook_pages').update({ title: month.label, content, updated_at: now }).eq('id', pageRef.current.id).select().single()
    } else {
      result = await supabase.from('notebook_pages').insert({ user_id: user.id, slug: month.slug, title: month.label, content, updated_at: now }).select().single()
    }
    const { data, error: err } = result
    if (err) { setSaveState('error'); setError(err.message); return }
    onSaved(data as NotebookPage); setSavedForm(f)
    setSaveState('saved')
    setTimeout(() => setSaveState(s => s === 'saved' ? 'idle' : s), 2500)
  }

  function updateField(key: MonthlyKey, value: string) {
    const next = { ...form, [key]: value }
    setForm(next)
    setSaveState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSave(next), 1500)
  }

  return (
    <div className="m-pad" style={{ padding: '48px 60px', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
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
              onChange={e => updateField(f.key, e.target.value)}
              placeholder="Write here…"
              rows={4}
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.85, color: 'var(--text-primary)', fontFamily: 'inherit', paddingBottom: 12 }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 28, marginTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
        {saveState === 'saving' && <span style={{ fontSize: 12, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Saving…</span>}
        {saveState === 'saved'  && <span style={{ fontSize: 12, color: 'var(--profit)' }}>Saved</span>}
        {saveState === 'error'  && <span style={{ fontSize: 12, color: 'var(--loss)' }}>{error}</span>}
        <button onClick={() => doSave(form)} disabled={saveState === 'saving' || !dirty} style={{ padding: '8px 22px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: dirty && saveState !== 'saving' ? 'pointer' : 'default', background: dirty ? 'var(--text-primary)' : 'var(--bg-elevated)', color: dirty ? 'var(--bg-base)' : 'var(--text-disabled)', transition: 'all 0.15s' }}>
          Save review
        </button>
      </div>
      <div style={{ height: 60 }} />
    </div>
  )
}

// ─── Right panel dispatcher ───────────────────────────────────────────────────

function RightPanel({ active, selectedNote, trades, pages, onSaved, onDeleted, symbol }: {
  active: string | null; selectedNote: string | null
  trades: Trade[]; pages: Record<string, NotebookPage>
  onSaved: (p: NotebookPage) => void; onDeleted: (slug: string) => void; symbol: string
}) {
  const kbFolder = KB_FOLDERS.find(f => f.id === active)
  if (kbFolder) {
    if (!selectedNote) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Select a note or create one</p>
      </div>
    )
    return <PageEditor slug={selectedNote} title={pages[selectedNote]?.title ?? ''} editableTitle page={pages[selectedNote] ?? null} onSaved={onSaved} onDeleted={onDeleted} />
  }

  // Trading Goals — every goal is its own document with an editable title
  if (active === 'trading-goals') {
    if (!selectedNote) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Select a goal or set a new one</p>
      </div>
    )
    return <PageEditor slug={selectedNote} title={pages[selectedNote]?.title ?? ''} editableTitle page={pages[selectedNote] ?? null} onSaved={onSaved} onDeleted={onDeleted} />
  }

  // Weekly Focus — one document per ISO week, never overwritten
  if (active === 'weekly-focus' && selectedNote) {
    const m = selectedNote.match(/^focus-(\d{4})-(\d{2})$/)
    if (m) {
      return <PageEditor slug={selectedNote} title={`Week ${Number(m[2])} Focus`} page={pages[selectedNote] ?? null} onSaved={onSaved} onDeleted={onDeleted} />
    }
  }

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
        {active === 'weekly-recaps' || active === 'monthly-reviews' || active === 'weekly-focus' ? 'Select a period to begin' : active ? 'Open a note to begin writing' : 'Select a folder from the left'}
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

      // One-time migration: the old single-page Planning entries become
      // documents in their folders, so no existing writing is lost.
      const legacyFocus = map['planning-weekly-focus']
      if (legacyFocus) {
        const now  = new Date()
        const slug = focusSlug({ year: now.getFullYear(), week: isoWeekNum(now) })
        if (!map[slug]) {
          const { data } = await supabase.from('notebook_pages')
            .update({ slug, title: `Week ${isoWeekNum(now)} Focus` })
            .eq('id', legacyFocus.id).select().single()
          if (data) { delete map['planning-weekly-focus']; map[slug] = data as NotebookPage }
        }
      }
      const legacyGoals = map['planning-trading-goals']
      if (legacyGoals) {
        const slug = `trading-goals-${Date.now()}`
        const { data } = await supabase.from('notebook_pages')
          .update({ slug, title: legacyGoals.title || 'Trading Goals' })
          .eq('id', legacyGoals.id).select().single()
        if (data) { delete map['planning-trading-goals']; map[slug] = data as NotebookPage }
      }

      setPages(map)
      setLoading(false)
    }
    load()
  }, [])

  function handleFolderSelect(id: string) {
    setActiveFolder(id)
    setSelectedNote(null)
  }

  // Folder document counts — shown as muted numbers in the nav
  const counts: Record<string, number> = {}
  {
    const slugs = Object.keys(pages)
    KB_FOLDERS.forEach(f => { counts[f.id] = slugs.filter(s => s === f.id || s.startsWith(f.id + '-')).length })
    counts['weekly-recaps']   = slugs.filter(s => s.startsWith('week-')).length
    counts['monthly-reviews'] = slugs.filter(s => s.startsWith('monthly-')).length
    counts['weekly-focus']    = slugs.filter(s => s.startsWith('focus-')).length
    counts['trading-goals']   = slugs.filter(s => s.startsWith('trading-goals-')).length
  }

  function createNote(folderId: string) {
    const newSlug = `${folderId}-${Date.now()}`
    setSelectedNote(newSlug)
  }

  function handleSaved(page: NotebookPage) {
    setPages(prev => ({ ...prev, [page.slug]: page }))
  }

  function handleDeleted(slug: string) {
    setPages(prev => { const next = { ...prev }; delete next[slug]; return next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Page header */}
      <div className="m-pad" style={{ padding: '36px 48px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Notebook</p>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Notebook</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Capture lessons. Build your edge.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left — folder nav (mobile: step 1 of the drill-down) */}
        <div className={'nb-pane' + (activeFolder ? ' m-hide' : '')} style={{ width: 220, height: '100%', overflowY: 'auto', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <FolderNav active={activeFolder} counts={counts} onSelect={handleFolderSelect} />
        </div>

        {/* Middle — note list (mobile: step 2) */}
        <div className={'nb-pane' + (!activeFolder || selectedNote ? ' m-hide' : '')} style={{ width: 258, height: '100%', overflowY: 'auto', flexShrink: 0, borderRight: '1px solid var(--border-subtle)' }}>
          <button className="m-only" onClick={() => { setActiveFolder(null); setSelectedNote(null) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: 13, color: 'var(--accent)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
            ← All folders
          </button>
          {loading
            ? <div style={{ padding: 24 }}><p style={{ fontSize: 13, color: 'var(--text-disabled)' }}>Loading…</p></div>
            : <MiddleList active={activeFolder} trades={trades} pages={pages} selectedNote={selectedNote} onSelect={setSelectedNote} onCreateNote={createNote} />}
        </div>

        {/* Right — content (mobile: step 3) */}
        <div className={'nb-right' + (!selectedNote ? ' m-hide' : '')} style={{ flex: 1, height: '100%', overflowY: 'auto', minWidth: 0 }}>
          {selectedNote && (
            <button className="m-only" onClick={() => setSelectedNote(null)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: 13, color: 'var(--accent)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          <RightPanel active={activeFolder} selectedNote={selectedNote} trades={trades} pages={pages} onSaved={handleSaved} onDeleted={handleDeleted} symbol={symbol} />
        </div>
      </div>
    </div>
  )
}
