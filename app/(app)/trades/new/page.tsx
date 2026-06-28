'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, ImagePlus, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TagInput } from '@/components/ui/TagInput'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency } from '@/lib/utils'

const STRATEGIES = ['London Breakout','Trend Continuation','Reversal','Range Break','Support Bounce','Asian Session Break','News Fade','MTF Hidden OB','Other']

const ASSET_TYPES = [
  { label: 'Forex', multiplier: 100000 },
  { label: 'Indices', multiplier: 1 },
  { label: 'Crypto', multiplier: 1 },
  { label: 'Gold (XAU)', multiplier: 100 },
]

interface Form {
  symbol: string; direction: 'LONG'|'SHORT'|''
  assetType: string
  entry: string; exit: string; sl: string; tp: string; size: string
  strategy: string; score: number; followed_plan: boolean
  trade_type: 'planned'|'impulsive'|''
  confidence: number
  notes: string; date: string; rr: string
  tags: string[]
}

function Label({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.01em' }}>
      {children}{req && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}
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

export default function NewTradePage() {
  const { symbol } = useCurrency()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [f, setF] = useState<Form>({
    symbol: '', direction: '', assetType: 'Indices',
    entry: '', exit: '', sl: '', tp: '', size: '',
    strategy: '', score: 0, followed_plan: true,
    trade_type: '', confidence: 0,
    notes: '', date: new Date().toISOString().split('T')[0], rr: '',
    tags: [],
  })

  const upd = (k: keyof Form, v: string | number | boolean) => setF(p => ({ ...p, [k]: v }))

  const entryN = parseFloat(f.entry)
  const exitN = parseFloat(f.exit)
  const slN = parseFloat(f.sl)
  const sizeN = parseFloat(f.size)
  const multiplier = ASSET_TYPES.find(a => a.label === f.assetType)?.multiplier ?? 1

  const priceDiff = f.direction === 'LONG' ? exitN - entryN : entryN - exitN
  const pnl = f.entry && f.exit && f.direction && f.size && !isNaN(priceDiff) && !isNaN(sizeN)
    ? priceDiff * sizeN * multiplier
    : null
  const pnlUp = pnl !== null && pnl >= 0

  const positionValue = !isNaN(entryN) && !isNaN(sizeN) ? entryN * sizeN : null
  const returnPct = pnl !== null && positionValue ? (pnl / positionValue) * 100 : null

  const autoRR = f.entry && f.exit && f.sl && f.direction && !isNaN(slN) && !isNaN(priceDiff)
    ? (priceDiff / Math.abs(entryN - slN)).toFixed(2)
    : null

  async function handleSave() {
    if (!f.symbol || !f.direction || !f.entry || !f.exit) {
      setError('Please fill in symbol, direction, entry and exit price.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Session expired. Please sign in again.')
        setSaving(false)
        return
      }

      let screenshot_url = null
      if (screenshot) {
        if (screenshot.size > 10 * 1024 * 1024) {
          setError('Screenshot must be under 10MB.')
          setSaving(false)
          return
        }
        const ext = screenshot.name.split('.').pop()
        const path = `${user?.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(path, screenshot)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(path)
          screenshot_url = urlData.publicUrl
        }
      }

      const rrValue = f.rr ? parseFloat(f.rr) : autoRR ? parseFloat(autoRR) : null

      const insertPayload: Record<string, any> = {
        user_id: user?.id,
        symbol: f.symbol.toUpperCase(),
        direction: f.direction,
        entry_price: entryN,
        exit_price: exitN,
        stop_loss: f.sl ? slN : null,
        take_profit: f.tp ? parseFloat(f.tp) : null,
        pnl: pnl ?? 0,
        strategy: f.strategy || null,
        setup_score: f.score || null,
        followed_plan: f.followed_plan,
        trade_type: f.trade_type || null,
        confidence: f.confidence || null,
        notes: f.notes || null,
        tags: f.tags,
        return_pct: returnPct !== null ? parseFloat(returnPct.toFixed(2)) : null,
        rr: rrValue,
        trade_date: f.date,
        screenshot_url,
      }
      let { error: insertError } = await supabase.from('trades').insert(insertPayload)
      if (insertError?.message?.includes('schema cache')) {
        const { tags, ...legacyPayload } = insertPayload
        const { error: retryError } = await supabase.from('trades').insert(legacyPayload)
        insertError = retryError ?? null
      }
      if (insertError) throw insertError
      router.push('/trades')
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <Link href="/trades" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Cancel
        </Link>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Log trade</span>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
          <Check size={14} strokeWidth={2.5} />{saving ? 'Saving…' : 'Save trade'}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 40px' }}>
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{error}</div>
        )}

        {/* P&L Preview */}
        {pnl !== null && (
          <div style={{ borderRadius: 10, padding: '20px 24px', marginBottom: 20, background: pnlUp ? 'var(--profit-dim)' : 'var(--loss-dim)', border: `1px solid ${pnlUp ? 'rgba(61,153,112,0.2)' : 'rgba(192,57,43,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>Estimated P&L</p>
              <p style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pnlUp ? 'var(--profit)' : 'var(--loss)', letterSpacing: '-0.03em' }}>
                {formatCurrency(pnl, true, symbol)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 32, textAlign: 'right' }}>
              {returnPct !== null && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Return</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: pnlUp ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%</p>
                </div>
              )}
              {autoRR && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>R:R</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: parseFloat(autoRR) >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(autoRR) > 0 ? '+' : ''}{autoRR}R</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Two column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Trade details */}
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Trade details</p>

              <div>
                <Label req>Asset type</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {ASSET_TYPES.map(a => (
                    <button key={a.label} type="button" onClick={() => upd('assetType', a.label)} style={{ padding: '8px 4px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', background: f.assetType === a.label ? 'var(--accent-dim)' : 'var(--bg-elevated)', color: f.assetType === a.label ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${f.assetType === a.label ? 'rgba(47,128,237,0.25)' : 'var(--border-subtle)'}` }}>{a.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label req>Symbol</Label>
                <input className="input" style={{ fontWeight: 500, letterSpacing: '0.05em', fontSize: 14 }} placeholder={f.assetType === 'Crypto' ? 'BTCUSDT' : f.assetType === 'Indices' ? 'NAS100' : 'EURUSD'} value={f.symbol} onChange={e => upd('symbol', e.target.value.toUpperCase())} />
              </div>

              <div>
                <Label req>Direction</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['LONG','SHORT'] as const).map(d => (
                    <button key={d} type="button" onClick={() => upd('direction', d)} style={{ padding: '10px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', background: f.direction === d ? (d === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)') : 'var(--bg-elevated)', color: f.direction === d ? (d === 'LONG' ? 'var(--profit)' : 'var(--loss)') : 'var(--text-secondary)', border: `1px solid ${f.direction === d ? (d === 'LONG' ? 'rgba(61,153,112,0.25)' : 'rgba(192,57,43,0.25)') : 'var(--border-subtle)'}` }}>{d}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Label req>Entry price</Label><input className="input tabular-nums" placeholder="20000" type="number" step="any" value={f.entry} onChange={e => upd('entry', e.target.value)} /></div>
                <div><Label req>Exit price</Label><input className="input tabular-nums" placeholder="20200" type="number" step="any" value={f.exit} onChange={e => upd('exit', e.target.value)} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Label>Stop loss</Label><input className="input tabular-nums" placeholder="19800" type="number" step="any" value={f.sl} onChange={e => upd('sl', e.target.value)} /></div>
                <div><Label>Take profit</Label><input className="input tabular-nums" placeholder="20600" type="number" step="any" value={f.tp} onChange={e => upd('tp', e.target.value)} /></div>
              </div>

              <div>
                <Label req>{f.assetType === 'Crypto' ? 'Quantity (coins)' : 'Lots / contracts'}</Label>
                <input className="input tabular-nums" placeholder={f.assetType === 'Crypto' ? '0.5' : '1.0'} type="number" step="any" value={f.size} onChange={e => upd('size', e.target.value)} />
              </div>

              <div>
                <Label>Trade date</Label>
                <input className="input" type="date" value={f.date} onChange={e => upd('date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                    <button key={String(v)} type="button" onClick={() => upd('followed_plan', v)} style={{ padding: '10px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', background: f.followed_plan === v ? 'var(--accent-dim)' : 'var(--bg-elevated)', color: f.followed_plan === v ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${f.followed_plan === v ? 'rgba(47,128,237,0.25)' : 'var(--border-subtle)'}` }}>{v ? 'Yes' : 'No'}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Trade type</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['planned', 'impulsive'] as const).map(t => (
                    <button key={t} type="button" onClick={() => upd('trade_type', f.trade_type === t ? '' : t)} style={{ padding: '10px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', textTransform: 'capitalize', background: f.trade_type === t ? (t === 'planned' ? 'var(--profit-dim)' : 'var(--loss-dim)') : 'var(--bg-elevated)', color: f.trade_type === t ? (t === 'planned' ? 'var(--profit)' : 'var(--loss)') : 'var(--text-secondary)', border: `1px solid ${f.trade_type === t ? (t === 'planned' ? 'rgba(61,153,112,0.25)' : 'rgba(192,57,43,0.25)') : 'var(--border-subtle)'}` }}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Confidence {f.confidence > 0 && <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{f.confidence}/10</span>}</Label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} type="button" onClick={() => upd('confidence', f.confidence === n ? 0 : n)} style={{ width: 32, height: 32, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', background: f.confidence >= n ? (n <= 4 ? 'var(--loss-dim)' : n <= 7 ? 'rgba(180,83,9,0.1)' : 'var(--profit-dim)') : 'var(--bg-elevated)', color: f.confidence >= n ? (n <= 4 ? 'var(--loss)' : n <= 7 ? '#B45309' : 'var(--profit)') : 'var(--text-muted)', border: `1px solid ${f.confidence >= n ? 'transparent' : 'var(--border-subtle)'}` }}>{n}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <textarea className="input" rows={5} placeholder="What made you take this trade? What went well? What could be improved?" value={f.notes} onChange={e => upd('notes', e.target.value)} style={{ lineHeight: 1.6, resize: 'none', fontSize: 14 }} />
              </div>

              <div>
                <Label>Tags</Label>
                <TagInput value={f.tags} onChange={tags => setF(p => ({ ...p, tags }))} />
              </div>
            </div>

            {/* Screenshot */}
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Chart screenshot</p>
              {screenshot ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{screenshot.name}</span>
                  <button onClick={() => setScreenshot(null)} style={{ fontSize: 12, color: 'var(--loss)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                </div>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 16px', borderRadius: 8, border: '2px dashed var(--border-default)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <ImagePlus size={22} strokeWidth={1.5} />
                  <span style={{ fontSize: 14 }}>Click to upload chart</span>
                  <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>PNG or JPG up to 10MB</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setScreenshot(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>
        </div>

        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15, marginTop: 20 }}>
          <Check size={16} strokeWidth={2.5} />{saving ? 'Saving…' : 'Save trade'}
        </button>
      </div>
    </div>
  )
}