'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { use } from 'react'

const STRATEGIES = ['London Breakout','Trend Continuation','Reversal','Range Break','Support Bounce','Asian Session Break','News Fade','MTF Hidden OB','Other']

const ASSET_TYPES = [
  { label: 'Forex', multiplier: 100000 },
  { label: 'Indices', multiplier: 1 },
  { label: 'Crypto', multiplier: 1 },
  { label: 'Gold (XAU)', multiplier: 100 },
]

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.01em' }}>
      {children}
    </label>
  )
}

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {[1,2,3,4,5,6,7,8,9,10].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Star size={18} fill={(hover||value) >= i ? '#B45309' : 'none'} style={{ color: (hover||value) >= i ? '#B45309' : 'var(--border-strong)', transition: 'color 0.1s' }} />
        </button>
      ))}
      {value > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{value}/10</span>}
    </div>
  )
}

function ConfidenceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const color = value >= 7 ? 'var(--profit)' : value >= 4 ? '#B45309' : value > 0 ? 'var(--loss)' : 'var(--border-default)'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <input type="range" min={1} max={10} value={value || 5} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1, accentColor: color }} />
        <span style={{ fontSize: 18, fontWeight: 600, color, minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value || '—'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Low</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>High</span>
      </div>
    </div>
  )
}

export default function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState({
    symbol: '', direction: '' as 'LONG'|'SHORT'|'',
    assetType: 'Indices',
    entry: '', exit: '', sl: '', tp: '', size: '',
    strategy: '', score: 0, followed_plan: true,
    trade_type: '' as 'planned'|'impulsive'|'',
    confidence: 0,
    notes: '', date: '', rr: ''
  })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('trades').select('*').eq('id', id).single()
      if (data) {
        setF({
          symbol: data.symbol || '',
          direction: data.direction || '',
          assetType: 'Indices',
          entry: data.entry_price?.toString() || '',
          exit: data.exit_price?.toString() || '',
          sl: data.stop_loss?.toString() || '',
          tp: data.take_profit?.toString() || '',
          size: '',
          strategy: data.strategy || '',
          score: data.setup_score || 0,
          followed_plan: data.followed_plan ?? true,
          trade_type: data.trade_type || '',
          confidence: data.confidence || 0,
          notes: data.notes || '',
          date: data.trade_date || data.created_at?.split('T')[0] || '',
          rr: data.rr?.toString() || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [id])

  const upd = (k: string, v: string | number | boolean) => setF(p => ({ ...p, [k]: v }))

  const entryN = parseFloat(f.entry)
  const exitN = parseFloat(f.exit)
  const slN = parseFloat(f.sl)
  const sizeN = parseFloat(f.size)
  const multiplier = ASSET_TYPES.find(a => a.label === f.assetType)?.multiplier ?? 1
  const priceDiff = f.direction === 'LONG' ? exitN - entryN : entryN - exitN
  const pnl = f.entry && f.exit && f.direction && f.size && !isNaN(priceDiff) && !isNaN(sizeN)
    ? priceDiff * sizeN * multiplier : null
  const pnlUp = pnl !== null && pnl >= 0
  const positionValue = !isNaN(entryN) && !isNaN(sizeN) ? entryN * sizeN : null
  const returnPct = pnl !== null && positionValue ? (pnl / positionValue) * 100 : null
  const autoRR = f.entry && f.exit && f.sl && f.direction && !isNaN(slN) && !isNaN(priceDiff)
    ? (priceDiff / Math.abs(entryN - slN)).toFixed(2) : null

  async function handleSave() {
    if (!f.symbol || !f.direction) {
      setError('Please fill in symbol and direction.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const rrValue = f.rr ? parseFloat(f.rr) : autoRR ? parseFloat(autoRR) : null
      const { error: updateError } = await supabase.from('trades').update({
        symbol: f.symbol.toUpperCase(),
        direction: f.direction,
        entry_price: f.entry ? parseFloat(f.entry) : null,
        exit_price: f.exit ? parseFloat(f.exit) : null,
        stop_loss: f.sl ? parseFloat(f.sl) : null,
        take_profit: f.tp ? parseFloat(f.tp) : null,
        pnl: pnl ?? undefined,
        strategy: f.strategy || null,
        setup_score: f.score || null,
        followed_plan: f.followed_plan,
        trade_type: f.trade_type || null,
        confidence: f.confidence || null,
        notes: f.notes || null,
        return_pct: returnPct !== null ? parseFloat(returnPct.toFixed(2)) : null,
        rr: rrValue,
        trade_date: f.date || null,
      }).eq('id', id)
      if (updateError) throw updateError
      router.push(`/trades/${id}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ position: 'fixed', top: 0, left: 240, right: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <Link href={`/trades/${id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Cancel
        </Link>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Edit trade</span>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 14 }}>
          <Check size={14} strokeWidth={2.5} />{saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 40px', paddingTop: 80 }}>
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{error}</div>
        )}

        {pnl !== null && (
          <div style={{ borderRadius: 10, padding: '20px 28px', marginBottom: 24, background: pnlUp ? 'var(--profit-dim)' : 'var(--loss-dim)', border: `1px solid ${pnlUp ? 'rgba(61,153,112,0.2)' : 'rgba(192,57,43,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Estimated P&L</p>
              <p style={{ fontSize: 36, fontWeight: 700, color: pnlUp ? 'var(--profit)' : 'var(--loss)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                {pnlUp ? '+' : ''}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 40, textAlign: 'right' }}>
              {returnPct !== null && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Return</p>
                  <p style={{ fontSize: 22, fontWeight: 600, color: pnlUp ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%</p>
                </div>
              )}
              {autoRR && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>R:R</p>
                  <p style={{ fontSize: 22, fontWeight: 600, color: parseFloat(autoRR) >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(autoRR) > 0 ? '+' : ''}{autoRR}R</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Trade details</p>

              <div>
                <Label>Asset type</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {ASSET_TYPES.map(a => (
                    <button key={a.label} type="button" onClick={() => upd('assetType', a.label)} style={{ padding: '8px 4px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: f.assetType === a.label ? 'var(--accent-dim)' : 'var(--bg-elevated)', color: f.assetType === a.label ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${f.assetType === a.label ? 'rgba(47,128,237,0.25)' : 'var(--border-subtle)'}` }}>{a.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Symbol</Label>
                <input className="input" style={{ fontWeight: 500, letterSpacing: '0.05em', fontSize: 15 }} value={f.symbol} onChange={e => upd('symbol', e.target.value.toUpperCase())} />
              </div>

              <div>
                <Label>Direction</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['LONG','SHORT'] as const).map(d => (
                    <button key={d} type="button" onClick={() => upd('direction', d)} style={{ padding: '10px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', background: f.direction === d ? (d === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)') : 'var(--bg-elevated)', color: f.direction === d ? (d === 'LONG' ? 'var(--profit)' : 'var(--loss)') : 'var(--text-secondary)', border: `1px solid ${f.direction === d ? (d === 'LONG' ? 'rgba(61,153,112,0.25)' : 'rgba(192,57,43,0.25)') : 'var(--border-subtle)'}` }}>{d}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Label>Entry price</Label><input className="input tabular-nums" type="number" step="any" value={f.entry} onChange={e => upd('entry', e.target.value)} /></div>
                <div><Label>Exit price</Label><input className="input tabular-nums" type="number" step="any" value={f.exit} onChange={e => upd('exit', e.target.value)} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Label>Stop loss</Label><input className="input tabular-nums" type="number" step="any" value={f.sl} onChange={e => upd('sl', e.target.value)} /></div>
                <div><Label>Take profit</Label><input className="input tabular-nums" type="number" step="any" value={f.tp} onChange={e => upd('tp', e.target.value)} /></div>
              </div>

              <div>
                <Label>{f.assetType === 'Crypto' ? 'Quantity (coins)' : 'Lots / contracts'} <span style={{ color: 'var(--text-disabled)' }}>(optional — for recalculation)</span></Label>
                <input className="input tabular-nums" placeholder="Optional" type="number" step="any" value={f.size} onChange={e => upd('size', e.target.value)} />
              </div>

              <div>
                <Label>Trade date</Label>
                <input className="input" type="date" value={f.date} onChange={e => upd('date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Behaviour */}
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '3px solid var(--ai-accent)' }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Behaviour</p>

              <div>
                <Label>Trade type</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['planned', 'impulsive'] as const).map(t => (
                    <button key={t} type="button" onClick={() => upd('trade_type', t)} style={{ padding: '12px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', background: f.trade_type === t ? (t === 'planned' ? 'var(--profit-dim)' : 'var(--loss-dim)') : 'var(--bg-elevated)', color: f.trade_type === t ? (t === 'planned' ? 'var(--profit)' : 'var(--loss)') : 'var(--text-secondary)', border: `1px solid ${f.trade_type === t ? (t === 'planned' ? 'rgba(61,153,112,0.25)' : 'rgba(192,57,43,0.25)') : 'var(--border-subtle)'}` }}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Confidence <span style={{ color: 'var(--text-disabled)', fontWeight: 400 }}>(1–10)</span></Label>
                <ConfidenceSlider value={f.confidence} onChange={v => upd('confidence', v)} />
              </div>
            </div>

            {/* Analysis */}
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Analysis</p>

              <div>
                <Label>Strategy</Label>
                <div style={{ position: 'relative' }}>
                  <select className="input" style={{ appearance: 'none', paddingRight: 32, cursor: 'pointer', fontSize: 14 }} value={f.strategy} onChange={e => upd('strategy', e.target.value)}>
                    <option value="">Select strategy…</option>
                    {STRATEGIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
              </div>

              <div>
                <Label>Setup quality</Label>
                <Stars value={f.score} onChange={v => upd('score', v)} />
              </div>

              <div>
                <Label>Followed plan?</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[true, false].map(v => (
                    <button key={String(v)} type="button" onClick={() => upd('followed_plan', v)} style={{ padding: '10px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', background: f.followed_plan === v ? 'var(--accent-dim)' : 'var(--bg-elevated)', color: f.followed_plan === v ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${f.followed_plan === v ? 'rgba(47,128,237,0.25)' : 'var(--border-subtle)'}` }}>{v ? 'Yes' : 'No'}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>R:R {autoRR && <span style={{ color: 'var(--text-disabled)' }}>(auto: {autoRR}R)</span>}</Label>
                <input className="input tabular-nums" placeholder={autoRR ? `Auto: ${autoRR}R` : '2.1'} type="number" step="any" value={f.rr} onChange={e => upd('rr', e.target.value)} />
              </div>

              <div>
                <Label>Notes</Label>
                <textarea className="input" rows={5} value={f.notes} onChange={e => upd('notes', e.target.value)} style={{ lineHeight: 1.6, resize: 'none', fontSize: 14 }} />
              </div>
            </div>
          </div>
        </div>

        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, marginTop: 20 }}>
          <Check size={16} strokeWidth={2.5} />{saving ? 'Saving…' : 'Save changes'}
        </button>
        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}