'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency } from '@/lib/utils'

const MOODS = [
  { value: 1, emoji: '😔', label: 'Rough' },
  { value: 2, emoji: '😐', label: 'Flat' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😊', label: 'Great' },
  { value: 5, emoji: '🔥', label: 'Sharp' },
]

function toDateStr(d: Date) { return d.toISOString().split('T')[0] }

function formatDisplay(dateStr: string) {
  const today     = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86400000))
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── Subtle botanical SVG ornament ─────────────────────────────────────────────
function BotanicalOrnament({ opacity = 0.07, size = 180 }: { opacity?: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" style={{ position: 'absolute', pointerEvents: 'none', opacity }} aria-hidden>
      <path d="M90 170 C90 140 85 110 78 80 C72 55 68 35 72 18" stroke="var(--journal-rose)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M82 95 C72 90 58 88 48 80" stroke="var(--journal-rose)" strokeWidth="1" strokeLinecap="round"/>
      <path d="M80 72 C88 65 100 62 110 56" stroke="var(--journal-rose)" strokeWidth="1" strokeLinecap="round"/>
      <ellipse cx="46" cy="78" rx="10" ry="5" transform="rotate(-20 46 78)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      <ellipse cx="112" cy="54" rx="10" ry="5" transform="rotate(30 112 54)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      <ellipse cx="74" cy="20" rx="7" ry="4" transform="rotate(-40 74 20)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.9"/>
      <circle cx="90" cy="30" r="7" fill="none" stroke="var(--journal-rose)" strokeWidth="1"/>
      <circle cx="90" cy="30" r="4" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="90" cy="21" rx="4" ry="5" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="99" cy="26" rx="4" ry="5" transform="rotate(60 99 26)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="99" cy="35" rx="4" ry="5" transform="rotate(120 99 35)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="90" cy="39" rx="4" ry="5" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="81" cy="35" rx="4" ry="5" transform="rotate(-120 81 35)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="81" cy="26" rx="4" ry="5" transform="rotate(-60 81 26)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <ellipse cx="76" cy="50" rx="4" ry="5" transform="rotate(-15 76 50)" fill="none" stroke="var(--journal-rose)" strokeWidth="0.8"/>
      <path d="M76 55 C76 58 76 60 76 62" stroke="var(--journal-rose)" strokeWidth="0.8" strokeLinecap="round"/>
    </svg>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, note, color, muted }: {
  label: string; value: string; note?: string; color?: string; muted?: boolean
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: '13px 14px',
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8,
      opacity: muted ? 0.5 : 1,
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: color || 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {note && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{note}</p>}
    </div>
  )
}

// ── Reflection field ──────────────────────────────────────────────────────────
function ReflectionField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</p>
      <textarea
        className="input"
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ lineHeight: 1.7, resize: 'none', fontSize: 13, background: 'var(--journal-ivory)', border: '1px solid var(--border-subtle)' }}
      />
    </div>
  )
}

// ── Trade row ─────────────────────────────────────────────────────────────────
function TradeRow({ trade, currencySymbol }: { trade: any; currencySymbol: string }) {
  const pnl   = Number(trade.pnl || 0)
  const isWin = pnl > 0
  return (
    <Link href={`/trades/${trade.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', borderRadius: 7,
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          transition: 'border-color 0.1s, background 0.1s', cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)' }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 64 }}>{trade.symbol}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em',
          background: isWin ? 'var(--profit-dim)' : 'var(--loss-dim)',
          color: isWin ? 'var(--profit)' : 'var(--loss)',
        }}>{isWin ? 'WIN' : 'LOSS'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: isWin ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums', flex: 1 }}>
          {formatCurrency(pnl, true, currencySymbol)}
        </span>
        {trade.rr != null && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {Number(trade.rr) >= 0 ? '+' : ''}{Number(trade.rr).toFixed(1)}R
          </span>
        )}
        {trade.strategy && (
          <span className="journal-trade-meta" style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {trade.strategy}
          </span>
        )}
        {trade.created_at && (
          <span className="journal-trade-meta" style={{ fontSize: 11, color: 'var(--text-disabled)', whiteSpace: 'nowrap' }}>
            {formatTime(trade.created_at)}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM = { content: '', wentWell: '', wentWrong: '', biggestLesson: '', focusTomorrow: '' }

export default function JournalPage() {
  const { symbol }                      = useCurrency()
  const searchParams                    = useSearchParams()
  const paramDate                       = searchParams.get('date')
  const initDate                        = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(initDate)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [savedForm, setSavedForm]       = useState(EMPTY_FORM)
  const [mood, setMood]                 = useState<number | null>(null)
  const [savedMood, setSavedMood]       = useState<number | null>(null)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [saveError, setSaveError]       = useState('')
  const [pastEntries, setPastEntries]   = useState<any[]>([])
  const [recentTrades, setRecentTrades] = useState<any[]>([])
  const [userId, setUserId]             = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
    supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(60)
      .then(({ data }) => setPastEntries(data || []))
    const since = toDateStr(new Date(Date.now() - 90 * 86400000))
    supabase.from('trades')
      .select('id, symbol, pnl, return_pct, rr, strategy, trade_date, created_at, direction')
      .gte('trade_date', since)
      .order('created_at', { ascending: true })
      .then(({ data }) => setRecentTrades(data || []))
  }, [])

  useEffect(() => {
    const entry = pastEntries.find(e => e.entry_date === selectedDate)
    const loaded = {
      content:       entry?.content       || '',
      wentWell:      entry?.went_well     || '',
      wentWrong:     entry?.went_wrong    || '',
      biggestLesson: entry?.biggest_lesson || '',
      focusTomorrow: entry?.focus_tomorrow || '',
    }
    setForm(loaded)
    setSavedForm(loaded)
    setMood(entry?.mood ?? null)
    setSavedMood(entry?.mood ?? null)
    setSaved(false)
    setSaveError('')
  }, [selectedDate, pastEntries])

  // ── Day stats ──────────────────────────────────────────────────────────────
  const dayTrades  = recentTrades.filter(t => t.trade_date === selectedDate)
  const dayPnl     = dayTrades.reduce((s, t) => s + Number(t.pnl || 0), 0)
  const dayWins    = dayTrades.filter(t => Number(t.pnl) > 0)
  const dayLosses  = dayTrades.filter(t => Number(t.pnl) < 0)
  const winRate    = dayTrades.length > 0 ? Math.round(dayWins.length / dayTrades.length * 100) : 0
  const avgTrade   = dayTrades.length > 0 ? dayPnl / dayTrades.length : 0

  // Trade stats per day (for past entries)
  const tradesByDay: Record<string, { pnl: number; count: number }> = {}
  recentTrades.forEach(t => {
    if (!t.trade_date) return
    if (!tradesByDay[t.trade_date]) tradesByDay[t.trade_date] = { pnl: 0, count: 0 }
    tradesByDay[t.trade_date].pnl   += Number(t.pnl || 0)
    tradesByDay[t.trade_date].count += 1
  })

  const isDirty = form.content       !== savedForm.content       ||
                  form.wentWell      !== savedForm.wentWell      ||
                  form.wentWrong     !== savedForm.wentWrong     ||
                  form.biggestLesson !== savedForm.biggestLesson ||
                  form.focusTomorrow !== savedForm.focusTomorrow ||
                  mood               !== savedMood

  const hasAnyContent = Object.values(form).some(v => v.trim()) || mood !== null

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function save() {
    if (!userId || !isDirty) return
    setSaving(true); setSaveError('')
    const { data, error } = await supabase.from('journal_entries').upsert({
      user_id:         userId,
      entry_date:      selectedDate,
      content:         form.content       || null,
      went_well:       form.wentWell      || null,
      went_wrong:      form.wentWrong     || null,
      biggest_lesson:  form.biggestLesson || null,
      focus_tomorrow:  form.focusTomorrow || null,
      mood:            mood ?? null,
    }, { onConflict: 'user_id,entry_date' }).select()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    if (data) {
      setSavedForm(form)
      setSavedMood(mood)
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

  const isToday = selectedDate === toDateStr(new Date())
  const canSave = isDirty && hasAnyContent && !saving
  const pastWithContent = pastEntries.filter(e =>
    e.entry_date !== selectedDate &&
    (e.content?.trim() || e.went_well || e.went_wrong || e.biggest_lesson || e.focus_tomorrow)
  )

  return (
    <div style={{ background: 'var(--journal-ivory)', minHeight: '100vh' }}>

      {/* ── Page header ── */}
      <div className="journal-header-pad" style={{
        position: 'relative', overflow: 'hidden',
        padding: '36px 56px 28px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--journal-ivory-dark)',
      }}>
        <div style={{ position: 'absolute', top: -20, right: 32 }}>
          <BotanicalOrnament opacity={0.12} size={200} />
        </div>
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Trading Journal</p>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--journal-ink)', letterSpacing: '-0.025em', marginBottom: 6, lineHeight: 1.1 }}>Journal</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Reflect. Observe. Improve.</p>
        </div>
      </div>

      <div className="journal-body" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 56px 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Date navigator ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
            <ChevronLeft size={14} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--journal-ink)', letterSpacing: '-0.01em' }}>
              {formatDisplay(selectedDate)}
            </span>
          </div>
          {!isToday && (
            <button onClick={() => setSelectedDate(toDateStr(new Date()))} style={{ fontSize: 12, color: 'var(--journal-rose)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Back to today
            </button>
          )}
          <button onClick={() => navigate(1)} disabled={isToday} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: isToday ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: isToday ? 0.3 : 1, flexShrink: 0 }}>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* ── Day headline + performance cards ── */}
        {dayTrades.length > 0 && (
          <>
            {/* Headline */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingBottom: 2 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatFullDate(selectedDate)}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-strong)', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: dayPnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(dayPnl, true, symbol)}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-strong)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''} · {winRate}% win rate
              </span>
            </div>

            {/* Stats cards */}
            <div className="journal-stat-grid" style={{ display: 'flex', gap: 8 }}>
              <StatCard
                label="Net P&L"
                value={formatCurrency(dayPnl, true, symbol)}
                color={dayPnl >= 0 ? 'var(--profit)' : 'var(--loss)'}
              />
              <StatCard
                label="Trades"
                value={String(dayTrades.length)}
                note={`${dayWins.length}W · ${dayLosses.length}L`}
              />
              <StatCard
                label="Win Rate"
                value={`${winRate}%`}
                color={winRate >= 50 ? 'var(--profit)' : 'var(--loss)'}
              />
              <StatCard
                label="Avg Trade"
                value={formatCurrency(avgTrade, true, symbol)}
                color={avgTrade >= 0 ? 'var(--profit)' : 'var(--loss)'}
              />
              <StatCard
                label="Exec Score"
                value="—"
                note="coming soon"
                muted
              />
            </div>
          </>
        )}

        {/* ── Entry card ── */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: 24, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--journal-rose-dim) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Mood */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>How did you feel?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {MOODS.map(m => {
                  const active = mood === m.value
                  return (
                    <button key={m.value} type="button" onClick={() => setMood(active ? null : m.value)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: active ? 'var(--journal-rose-dim)' : 'var(--journal-ivory)',
                        border: `1.5px solid ${active ? 'var(--journal-rose)' : 'var(--border-subtle)'}`,
                        transform: active ? 'translateY(-1px) scale(1.03)' : 'none',
                        flex: 1,
                      }}>
                      <span style={{ fontSize: 20, transition: 'transform 0.15s', display: 'block', transform: active ? 'scale(1.1)' : 'scale(1)' }}>{m.emoji}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: active ? 'var(--journal-rose)' : 'var(--text-muted)', transition: 'color 0.15s' }}>{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Main notes */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--journal-rose)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</p>
              <textarea
                className="input"
                rows={6}
                placeholder="What happened today? How did you execute? What do you want to carry forward?"
                value={form.content}
                onChange={e => setField('content', e.target.value)}
                style={{ lineHeight: 1.75, resize: 'none', fontSize: 14, background: 'var(--journal-ivory)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            {/* Reflection grid */}
            <div className="journal-reflection-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <ReflectionField
                label="What went well?"
                value={form.wentWell}
                onChange={v => setField('wentWell', v)}
                placeholder="Good entries, clean execution, focus…"
              />
              <ReflectionField
                label="What went wrong?"
                value={form.wentWrong}
                onChange={v => setField('wentWrong', v)}
                placeholder="Mistakes, hesitations, overtrading…"
              />
              <ReflectionField
                label="Biggest lesson"
                value={form.biggestLesson}
                onChange={v => setField('biggestLesson', v)}
                placeholder="One thing to take forward…"
              />
              <ReflectionField
                label="Focus for tomorrow"
                value={form.focusTomorrow}
                onChange={v => setField('focusTomorrow', v)}
                placeholder="Intention for the next session…"
              />
            </div>

            {/* Save row */}
            {saveError && <p style={{ fontSize: 12, color: 'var(--loss)' }}>{saveError}</p>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: saved ? 'var(--profit)' : 'transparent', transition: 'color 0.3s' }}>
                ✓ Saved
              </span>
              <button
                onClick={save}
                disabled={!canSave}
                style={{
                  padding: '8px 24px', fontSize: 13, fontWeight: 500,
                  borderRadius: 6, border: 'none',
                  cursor: canSave ? 'pointer' : 'default',
                  background: canSave ? 'var(--journal-rose)' : 'var(--bg-elevated)',
                  color: canSave ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                  opacity: saving ? 0.6 : 1,
                }}>
                {saving ? 'Saving…' : 'Save entry'}
              </button>
            </div>

          </div>
        </div>

        {/* ── Today's trades ── */}
        {dayTrades.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Trades · {formatDisplay(selectedDate)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {dayTrades.map(t => <TradeRow key={t.id} trade={t} currencySymbol={symbol} />)}
            </div>
          </div>
        )}

        {/* ── AI Reflection ── */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: 20, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--ai-dim) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--ai-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={13} style={{ color: 'var(--ai-accent)' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AI Reflection</span>
              <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 3, background: 'var(--ai-dim)', color: 'var(--ai-accent)', letterSpacing: '0.04em' }}>COMING SOON</span>
            </div>
            <div className="journal-ai-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, opacity: 0.45 }}>
              {([
                { label: 'Strengths',      text: 'Discipline in following your plan. Clean entries on the first two setups.' },
                { label: 'Watch out',      text: 'Signs of revenge trading after consecutive losses in the afternoon.' },
                { label: 'Pattern',        text: 'Morning session win rate is consistently higher. Consider limiting afternoon trades.' },
                { label: "Tomorrow's focus", text: 'Stick to the pre-session plan. One setup, one trigger, full conviction.' },
              ] as const).map(item => (
                <div key={item.label} style={{ padding: '11px 13px', borderRadius: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ai-accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.text}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 12, fontStyle: 'italic' }}>
              AI analysis will be generated from your actual trading data once this feature launches.
            </p>
          </div>
        </div>

        {/* ── Past entries ── */}
        {pastWithContent.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Past entries</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {pastWithContent.map(entry => {
                const moodObj  = MOODS.find(m => m.value === entry.mood)
                const dayStats = tradesByDay[entry.entry_date]
                const preview  = entry.content || entry.went_well || entry.went_wrong || ''
                return (
                  <button key={entry.id} type="button" onClick={() => setSelectedDate(entry.entry_date)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                      transition: 'border-color 0.1s, background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--journal-rose)'; e.currentTarget.style.background = 'var(--journal-ivory-dark)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
                  >
                    <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1.3, marginTop: 1 }}>{moodObj?.emoji || '📝'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{formatDisplay(entry.entry_date)}</span>
                        {dayStats && (
                          <>
                            <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--border-strong)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: dayStats.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(dayStats.pnl, true, symbol)}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                              · {dayStats.count} trade{dayStats.count !== 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                      </div>
                      {preview && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as any }}>
                          {preview}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {pastWithContent.length === 0 && !hasAnyContent && (
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
