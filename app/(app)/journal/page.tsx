'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const MOODS = [
  { value: 1, emoji: '😔', label: 'Rough' },
  { value: 2, emoji: '😐', label: 'Flat' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😊', label: 'Great' },
  { value: 5, emoji: '🔥', label: 'Sharp' },
]

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatDisplay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const today     = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86400000))
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ── Subtle botanical SVG ornament ────────────────────────────────────────────
// A simple low-opacity rose sprig — pure SVG, no external assets
function BotanicalOrnament({ opacity = 0.07, size = 180 }: { opacity?: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" style={{ position: 'absolute', pointerEvents: 'none', opacity }} aria-hidden>
      {/* stem */}
      <path d="M90 170 C90 140 85 110 78 80 C72 55 68 35 72 18" stroke="var(--journal-rose)" strokeWidth="1.2" strokeLinecap="round"/>
      {/* left branch */}
      <path d="M82 95 C72 90 58 88 48 80" stroke="var(--journal-rose)" strokeWidth="1" strokeLinecap="round"/>
      {/* right branch */}
      <path d="M80 72 C88 65 100 62 110 56" stroke="var(--journal-rose)" strokeWidth="1" strokeLinecap="round"/>
      {/* leaf left */}
      <ellipse cx="46" cy="78" rx="10" ry="5" transform="rotate(-20 46 78)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      {/* leaf right */}
      <ellipse cx="112" cy="54" rx="10" ry="5" transform="rotate(30 112 54)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      {/* small top leaf */}
      <ellipse cx="74" cy="20" rx="7" ry="4" transform="rotate(-40 74 20)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      {/* rose bloom — center */}
      <circle cx="90" cy="30" r="7" fill="none" stroke="var(--journal-rose)" strokeWidth="1"/>
      <circle cx="90" cy="30" r="4" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      {/* petals */}
      <ellipse cx="90" cy="21" rx="4" ry="5" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="99" cy="26" rx="4" ry="5" transform="rotate(60 99 26)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="99" cy="35" rx="4" ry="5" transform="rotate(120 99 35)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="90" cy="39" rx="4" ry="5" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="81" cy="35" rx="4" ry="5" transform="rotate(-120 81 35)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="81" cy="26" rx="4" ry="5" transform="rotate(-60 81 26)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      {/* small bud */}
      <ellipse cx="76" cy="50" rx="4" ry="5" transform="rotate(-15 76 50)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <path d="M76 55 C76 58 76 60 76 62" stroke="var(--journal-rose)" strokeWidth="0.8" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [content, setContent]           = useState('')
  const [mood, setMood]                 = useState<number | null>(null)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [saveError, setSaveError]       = useState('')
  const [pastEntries, setPastEntries]   = useState<any[]>([])
  const [trades, setTrades]             = useState<any[]>([])
  const [userId, setUserId]             = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
    supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(60)
      .then(({ data }) => setPastEntries(data || []))
  }, [])

  useEffect(() => {
    const entry = pastEntries.find(e => e.entry_date === selectedDate)
    setContent(entry?.content || '')
    setMood(entry?.mood ?? null)
    setSaved(false); setSaveError('')
  }, [selectedDate, pastEntries])

  useEffect(() => {
    if (!selectedDate) return
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    supabase.from('trades').select('id, symbol, pnl, return_pct')
      .gte('trade_date', selectedDate).lt('trade_date', toDateStr(next))
      .order('created_at', { ascending: true })
      .then(({ data }) => setTrades(data || []))
  }, [selectedDate])

  async function save() {
    if (!userId) return
    setSaving(true); setSaveError('')
    const { data, error } = await supabase.from('journal_entries').upsert({
      user_id: userId, entry_date: selectedDate, content, mood: mood ?? null,
    }, { onConflict: 'user_id,entry_date' }).select()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    if (data) {
      setPastEntries(prev => {
        const filtered = prev.filter(e => e.entry_date !== selectedDate)
        return [data[0], ...filtered].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function navigate(dir: -1 | 1) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + dir)
    if (d > new Date()) return
    setSelectedDate(toDateStr(d))
  }

  const isToday  = selectedDate === toDateStr(new Date())
  const dayPnl   = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const hasEntry = content.trim() || mood !== null

  return (
    <div style={{ background: 'var(--journal-ivory)', minHeight: '100vh' }}>

      {/* ── Journal header — ivory with botanical ornament ── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '36px 56px 28px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--journal-ivory-dark)',
      }}>
        {/* botanical ornament — top-right corner */}
        <div style={{ position: 'absolute', top: -20, right: 32 }}>
          <BotanicalOrnament opacity={0.12} size={200} />
        </div>

        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Trading journal</p>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--journal-ink)', letterSpacing: '-0.025em', marginBottom: 6, lineHeight: 1.1 }}>Journal</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Reflect. Observe. Improve.</p>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 56px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Date navigator ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <ChevronLeft size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--journal-ink)', letterSpacing: '-0.01em' }}>{formatDisplay(selectedDate)}</span>
            {!isToday && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          </div>
          <button onClick={() => navigate(1)} disabled={isToday} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: isToday ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: isToday ? 0.35 : 1 }}>
            <ChevronRight size={14} />
          </button>
          {!isToday && (
            <button onClick={() => setSelectedDate(toDateStr(new Date()))} style={{ fontSize: 12, color: 'var(--journal-rose)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 2 }}>
              Back to today
            </button>
          )}
        </div>

        {/* ── Trade summary for day ── */}
        {trades.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{trades.length} trade{trades.length !== 1 ? 's' : ''}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-strong)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: dayPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
              {dayPnl >= 0 ? '+' : ''}${Math.abs(dayPnl).toFixed(2)}
            </span>
            <div style={{ display: 'flex', gap: 5, marginLeft: 2 }}>
              {trades.map(t => (
                <span key={t.id} style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: Number(t.pnl) >= 0 ? 'var(--profit-dim)' : 'var(--loss-dim)', color: Number(t.pnl) >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                  {t.symbol}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Entry card ── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* very subtle rose tint on card */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--journal-rose-dim) 0%, transparent 60%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Mood */}
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>How did you feel?</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
              {MOODS.map(m => {
                const active = mood === m.value
                return (
                  <button key={m.value} type="button" onClick={() => setMood(active ? null : m.value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s',
                      background: active ? 'var(--journal-rose-dim)' : 'var(--journal-ivory)',
                      border: `1.5px solid ${active ? 'var(--journal-rose)' : 'var(--border-subtle)'}`,
                      flex: 1,
                    }}>
                    <span style={{ fontSize: 20 }}>{m.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: active ? 'var(--journal-rose)' : 'var(--text-muted)' }}>{m.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Notes */}
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Notes</p>
            <textarea
              className="input"
              rows={8}
              placeholder="What happened today? How did you execute? What do you want to carry forward?"
              value={content}
              onChange={e => { setContent(e.target.value); setSaved(false) }}
              style={{
                lineHeight: 1.75, resize: 'none', fontSize: 14,
                background: 'var(--journal-ivory)',
                border: '1px solid var(--border-subtle)',
              }}
            />

            {saveError && <p style={{ fontSize: 12, color: 'var(--loss)', marginTop: 8 }}>{saveError}</p>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ fontSize: 12, color: saved ? 'var(--profit)' : 'transparent', transition: 'color 0.3s' }}>✓ Saved</span>
              <button
                onClick={save}
                disabled={saving || !hasEntry}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 18px', fontSize: 13, fontWeight: 500,
                  borderRadius: 6, border: 'none', cursor: saving || !hasEntry ? 'default' : 'pointer',
                  background: hasEntry && !saving ? 'var(--journal-rose)' : 'var(--bg-elevated)',
                  color: hasEntry && !saving ? '#fff' : 'var(--text-muted)',
                  opacity: saving ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}>
                {saving ? 'Saving…' : 'Save entry'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Past entries ── */}
        {pastEntries.filter(e => e.entry_date !== selectedDate && e.content?.trim()).length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Past entries</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pastEntries.filter(e => e.entry_date !== selectedDate && e.content?.trim()).map(entry => {
                const moodObj = MOODS.find(m => m.value === entry.mood)
                return (
                  <button key={entry.id} type="button" onClick={() => setSelectedDate(entry.entry_date)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      transition: 'border-color 0.1s, background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--journal-rose)'; e.currentTarget.style.background = 'var(--journal-ivory-dark)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{moodObj?.emoji || '📝'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 3 }}>{formatDisplay(entry.entry_date)}</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{entry.content}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {pastEntries.filter(e => e.content?.trim()).length === 0 && !content && (
          <div style={{ textAlign: 'center', padding: '32px 24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, opacity: 0.18 }}>
              <BotanicalOrnament opacity={1} size={120} />
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>Your first entry begins here.</p>
            <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 6 }}>Every reflection is a step forward.</p>
          </div>
        )}

      </div>
    </div>
  )
}
