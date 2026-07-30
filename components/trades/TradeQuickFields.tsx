'use client'

import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStrategyOptions } from '@/lib/useStrategyOptions'
import { hasContent } from '@/lib/utils'

export interface QuickEditTrade {
  id: string
  strategy?: string | null
  followed_plan?: boolean | null
  trade_type?: string | null
  confidence?: number | null
  screenshot_url?: string | null
}

const pillBtn = (active: boolean, color: string, dim: string, border: string): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s',
  background: active ? dim : 'var(--bg-elevated)',
  color: active ? color : 'var(--text-secondary)',
  border: `1px solid ${active ? border : 'var(--border-subtle)'}`,
})

/**
 * Compact quick-fill editor for strategy/behaviour fields + screenshot.
 * Used to tag a trade (e.g. mark it impulsive) right from a list — like
 * the Dashboard's Recent trades — without opening the full edit form.
 */
export function TradeQuickFields({ trade, onUpdated }: { trade: QuickEditTrade; onUpdated: (patch: Partial<QuickEditTrade>) => void }) {
  const strategyOptions = useStrategyOptions()
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function updateField(field: keyof QuickEditTrade, value: any) {
    setError('')
    onUpdated({ [field]: value })
    const { error: err } = await supabase.from('trades').update({ [field]: value }).eq('id', trade.id)
    if (err) setError(`Couldn't save: ${err.message}`)
  }

  async function uploadScreenshot(file: File) {
    if (file.size > 10 * 1024 * 1024) { setError('Screenshot must be under 10 MB.'); return }
    setError('')
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired. Please sign in again.'); setUploading(false); return }
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('screenshots').upload(path, file)
    if (uploadError) { setError(`Upload failed: ${uploadError.message}`); setUploading(false); return }
    const url = supabase.storage.from('screenshots').getPublicUrl(path).data.publicUrl
    await updateField('screenshot_url', url)
    setUploading(false)
  }

  const label: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 88 }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onClick={e => e.stopPropagation()}>
      <div style={row}>
        <span style={label}>Strategy</span>
        <select className="input" value={trade.strategy || ''} onChange={e => updateField('strategy', e.target.value || null)}
          style={{ fontSize: 12, padding: '4px 8px', width: 'auto', maxWidth: 200 }}>
          <option value="">Not set</option>
          {strategyOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={row}>
        <span style={label}>Followed plan</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {[true, false].map(v => (
            <button key={String(v)} type="button" onClick={() => updateField('followed_plan', v)}
              style={pillBtn(trade.followed_plan === v, 'var(--accent)', 'var(--accent-dim)', 'rgba(47,128,237,0.25)')}>
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      <div style={row}>
        <span style={label}>Trade type</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['planned', 'impulsive'] as const).map(t => (
            <button key={t} type="button" onClick={() => updateField('trade_type', trade.trade_type === t ? null : t)}
              style={{ ...pillBtn(trade.trade_type === t, t === 'planned' ? 'var(--profit)' : 'var(--loss)', t === 'planned' ? 'var(--profit-dim)' : 'var(--loss-dim)', t === 'planned' ? 'rgba(61,153,112,0.25)' : 'rgba(192,57,43,0.25)'), textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={row}>
        <span style={label}>Confidence</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => {
            const active = trade.confidence != null && Number(trade.confidence) >= n
            const color = n <= 4 ? 'var(--loss)' : n <= 7 ? '#B45309' : 'var(--profit)'
            const dim = n <= 4 ? 'var(--loss-dim)' : n <= 7 ? 'rgba(180,83,9,0.1)' : 'var(--profit-dim)'
            return (
              <button key={n} type="button" onClick={() => updateField('confidence', Number(trade.confidence) === n ? null : n)}
                title={`${n}/10`}
                style={{ width: 20, height: 20, borderRadius: 5, fontSize: 9, fontWeight: 500, cursor: 'pointer', background: active ? dim : 'var(--bg-elevated)', color: active ? color : 'var(--text-disabled)', border: `1px solid ${active ? 'transparent' : 'var(--border-subtle)'}` }}>
                {n}
              </button>
            )
          })}
        </div>
      </div>

      <div style={row}>
        <span style={label}>Screenshot</span>
        {hasContent(trade.screenshot_url) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={trade.screenshot_url!} alt="" style={{ width: 40, height: 26, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button type="button" onClick={() => updateField('screenshot_url', null)} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--loss)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={10} />Remove
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)', borderRadius: 6, cursor: 'pointer', padding: '4px 10px' }}>
            <ImagePlus size={12} />{uploading ? 'Uploading…' : 'Add screenshot'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f); e.target.value = '' }} />
      </div>

      {error && <p style={{ fontSize: 11, color: 'var(--loss)' }}>{error}</p>}
    </div>
  )
}
