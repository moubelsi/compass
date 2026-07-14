'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { localDateStr } from '@/lib/utils'

const GOAL_ML = 2500
const AMOUNTS = [100, 250, 500]

const litres = (ml: number) => (ml / 1000).toFixed(1)

/**
 * Daily water tracker. Tap adds 250ml; long-press (or right-click) opens
 * +100/+250/+500. Persists one row per day (debounced upsert with a flush
 * on unmount), so the count is shared across devices and shows up in the
 * Journal day summary. `bare` renders without the card chrome for use
 * inside typographic sections.
 */
export function HydrationCard({ bare = false }: { bare?: boolean }) {
  const [ml, setMl]           = useState(0)
  const [loaded, setLoaded]   = useState(false)
  const [picker, setPicker]   = useState(false)
  const [justDone, setJustDone] = useState(false)
  const [saveError, setSaveError] = useState('')

  const pressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const mlRef       = useRef(0)
  const dirtyRef    = useRef(false)
  const today = localDateStr()

  useEffect(() => {
    supabase.from('hydration_days').select('ml').eq('day', today).maybeSingle()
      .then(({ data, error }) => {
        if (error) setSaveError(error.message)
        setMl(data?.ml ?? 0)
        mlRef.current = data?.ml ?? 0
        setLoaded(true)
      })
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      // Don't lose a tap that happened just before navigating away
      if (dirtyRef.current) void persistNow(mlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function persistNow(value: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('hydration_days').upsert(
      { user_id: user.id, day: today, ml: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day' },
    )
    if (error) setSaveError(error.message)
    else { dirtyRef.current = false; setSaveError('') }
  }

  function schedulePersist(next: number) {
    mlRef.current = next
    dirtyRef.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void persistNow(next), 500)
  }

  function setAmount(next: number) {
    setMl(prev => {
      if (prev < GOAL_ML && next >= GOAL_ML) {
        setJustDone(true)
        setTimeout(() => setJustDone(false), 900)
      }
      schedulePersist(next)
      return next
    })
  }

  function add(amount: number) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(10)
    setPicker(false)
    setAmount(Math.min(ml + amount, 10000))
  }

  // Long-press opens the amount picker; a short tap adds 250ml
  function pressStart() {
    longPressed.current = false
    pressTimer.current = setTimeout(() => { longPressed.current = true; setPicker(true) }, 450)
  }
  function pressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }
  function handleClick() {
    if (longPressed.current) { longPressed.current = false; return }
    add(250)
  }

  const pct  = Math.min((ml / GOAL_ML) * 100, 100)
  const done = ml >= GOAL_ML

  return (
    <div className={bare ? undefined : 'card'} style={bare ? undefined : { padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Hydration</p>
        <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 20, fontWeight: 600, color: done ? 'var(--profit)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1, transition: 'color 0.35s ease' }}>
          {litres(ml)}L
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ {litres(GOAL_ML)}L</span>
      </div>

      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: done ? 'var(--profit)' : 'var(--accent)',
          transition: 'width 0.35s ease, background 0.35s ease',
          ...(justDone ? { animation: 'hydration-pulse 0.9s ease' } : {}),
        }} />
      </div>

      <div style={{ marginTop: 14, minHeight: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
        {done ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, animation: 'hydration-pop 0.35s ease' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--profit-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={12} strokeWidth={2.5} style={{ color: 'var(--profit)' }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--profit)' }}>Goal reached</span>
          </div>
        ) : picker ? (
          <>
            {AMOUNTS.map(a => (
              <button key={a} type="button" onClick={() => add(a)}
                style={{ flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                +{a}ml
              </button>
            ))}
            <button type="button" onClick={() => { setPicker(false); setAmount(0) }}
              style={{ fontSize: 11, color: 'var(--text-disabled)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
              Reset
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={!loaded}
            onPointerDown={pressStart}
            onPointerUp={pressEnd}
            onPointerLeave={pressEnd}
            onClick={handleClick}
            onContextMenu={e => { e.preventDefault(); setPicker(true) }}
            style={{ fontSize: 12, padding: '7px 16px', touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}
          >
            +250ml
          </button>
        )}
      </div>

      {saveError && (
        <p style={{ fontSize: 11, color: 'var(--loss)', marginTop: 8 }}>
          Not saved: {saveError.includes('hydration_days') || saveError.includes('schema') ? 'run the hydration migration in Supabase' : saveError}
        </p>
      )}
    </div>
  )
}
