'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit3, Trash2, ImageIcon, FileText, BarChart2, Star, Activity, ImagePlus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { use } from 'react'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency, hasContent } from '@/lib/utils'
import { useStrategyOptions } from '@/lib/useStrategyOptions'

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

/** Label + inline-editable value on the same row — click the value to change it, saves immediately. */
function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
      <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}

// Parses trade_date defensively: the column can hold a bare date or (for
// some legacy/synced rows) a full timestamp — take the date part only so
// appending a fixed time never produces "Invalid Date".
function parseTradeDateTime(trade: any): Date {
  const raw = trade.trade_date ? String(trade.trade_date).slice(0, 10) : null
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw + 'T12:00:00')
  const fallback = new Date(trade.created_at)
  return isNaN(fallback.getTime()) ? new Date() : fallback
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60), m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { symbol } = useCurrency()
  const strategyOptions = useStrategyOptions()
  const [trade, setTrade] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [uploadingShot, setUploadingShot] = useState(false)
  const screenshotRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('id', id)
        .single()
      setTrade(data)
      setLoading(false)
    }
    load()
  }, [id])

  async function updateField(field: string, value: any) {
    setSaveError('')
    setTrade((prev: any) => ({ ...prev, [field]: value }))
    const { error } = await supabase.from('trades').update({ [field]: value }).eq('id', id)
    if (error) setSaveError(`Couldn't save ${field}: ${error.message}`)
  }

  async function handleDelete() {
    if (!confirm('Delete this trade?')) return
    setDeleting(true)
    setDeleteError('')
    const { error } = await supabase.from('trades').delete().eq('id', id)
    if (error) {
      setDeleting(false)
      setDeleteError('Failed to delete trade. Please try again.')
      return
    }
    router.push('/trades')
  }

  async function uploadScreenshot(file: File) {
    if (file.size > 10 * 1024 * 1024) { setSaveError('Screenshot must be under 10 MB.'); return }
    setSaveError('')
    setUploadingShot(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveError('Session expired. Please sign in again.'); setUploadingShot(false); return }
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('screenshots').upload(path, file)
    if (uploadError) { setSaveError(`Upload failed: ${uploadError.message}`); setUploadingShot(false); return }
    const url = supabase.storage.from('screenshots').getPublicUrl(path).data.publicUrl
    await updateField('screenshot_url', url)
    setUploadingShot(false)
  }

  async function toggleFavourite() {
    const next = !trade.is_favourite
    setTrade((prev: any) => ({ ...prev, is_favourite: next }))
    await supabase.from('trades').update({ is_favourite: next }).eq('id', id)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
  if (!trade) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Trade not found</div>

  const up = Number(trade.pnl) >= 0
  const returnPct = trade.return_pct != null ? Number(trade.return_pct) : null
  const meta = trade.broker_metadata as { open_time?: string; close_time?: string; duration_ms?: number } | null
  const dateLabel = parseTradeDateTime(trade).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const timeLabel = meta?.open_time && meta?.close_time
    ? `${formatTime(meta.open_time)} – ${formatTime(meta.close_time)}${meta.duration_ms ? ` (${formatDuration(meta.duration_ms)})` : ''}`
    : null

  const pillBtn = (active: boolean, activeColor: string, activeDim: string, activeBorder: string): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s',
    background: active ? activeDim : 'var(--bg-elevated)',
    color: active ? activeColor : 'var(--text-secondary)',
    border: `1px solid ${active ? activeBorder : 'var(--border-subtle)'}`,
  })

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Fixed nav bar */}
      <div className="page-fixed-bar" style={{
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 40px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <Link href="/trades" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Trades
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggleFavourite} title={trade.is_favourite ? 'Remove from favourites' : 'Add to favourites'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: trade.is_favourite ? 'rgba(180,83,9,0.08)' : 'var(--bg-elevated)', border: `1px solid ${trade.is_favourite ? 'rgba(180,83,9,0.25)' : 'var(--border-subtle)'}`, cursor: 'pointer' }}>
            <Star size={15} fill={trade.is_favourite ? '#B45309' : 'none'} style={{ color: trade.is_favourite ? '#B45309' : 'var(--text-muted)' }} />
          </button>
          <Link href={`/trades/${id}/edit`} className="btn-secondary" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <Edit3 size={14} />Edit trade
          </Link>
          <button className="btn-ghost" style={{ fontSize: 14, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDelete} disabled={deleting}>
            <Trash2 size={14} />{deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Content — padded to clear the fixed nav */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 40px', paddingTop: 80 }}>
        {deleteError && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{deleteError}</div>
        )}
        {saveError && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{saveError}</div>
        )}
        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Left */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{trade.symbol?.toUpperCase()}</h1>
                <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: trade.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: trade.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)' }}>{trade.direction}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {dateLabel}{timeLabel && <span style={{ color: 'var(--text-disabled)' }}> · {timeLabel}</span>}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              {[['Entry', trade.entry_price], ['Exit', trade.exit_price]].map(([l, v], i) => (
                <div key={String(l)} style={{ padding: '14px 16px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <p className="label" style={{ marginBottom: 6 }}>{l}</p>
                  <p style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{v ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right - P&L */}
          <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderLeft: `4px solid ${up ? 'var(--profit)' : 'var(--loss)'}` }}>
            <p className="label" style={{ marginBottom: 8 }}>Total P&L</p>
            <p style={{ fontSize: 48, fontWeight: 700, color: up ? 'var(--profit)' : 'var(--loss)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', marginBottom: 16 }}>
              {formatCurrency(Number(trade.pnl), true, symbol)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {returnPct != null && (
                <div>
                  <p className="label" style={{ marginBottom: 4 }}>Return</p>
                  <p style={{ fontSize: 18, fontWeight: 500, color: returnPct >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                    {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                  </p>
                </div>
              )}
              {trade.rr != null && (
                <div>
                  <p className="label" style={{ marginBottom: 4 }}>R:R</p>
                  <p style={{ fontSize: 18, fontWeight: 500, color: Number(trade.rr) >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                    {Number(trade.rr) > 0 ? '+' : ''}{Number(trade.rr).toFixed(1)}R
                  </p>
                </div>
              )}
              {trade.setup_score != null && (
                <div>
                  <p className="label" style={{ marginBottom: 6 }}>Quality</p>
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(i => (
                      <Star key={i} size={11} fill={i <= Number(trade.setup_score) ? '#B45309' : 'none'} style={{ color: i <= Number(trade.setup_score) ? '#B45309' : 'var(--border-strong)' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Setup details + Behaviour — quick-fill, saves on change */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <BarChart2 size={15} style={{ color: 'var(--text-muted)' }} />
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Setup details</p>
              </div>

              <EditRow label="Strategy">
                <select
                  className="input"
                  value={trade.strategy || ''}
                  onChange={e => updateField('strategy', e.target.value || null)}
                  style={{ fontSize: 13, padding: '5px 10px', width: 'auto', maxWidth: 220 }}
                >
                  <option value="">Not set</option>
                  {strategyOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </EditRow>

              <EditRow label="Followed plan">
                <div style={{ display: 'flex', gap: 6 }}>
                  {[true, false].map(v => (
                    <button key={String(v)} type="button" onClick={() => updateField('followed_plan', v)}
                      style={pillBtn(trade.followed_plan === v, 'var(--accent)', 'var(--accent-dim)', 'rgba(47,128,237,0.25)')}>
                      {v ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </EditRow>

              {trade.stop_loss != null && <Row label="Stop loss" value={String(trade.stop_loss)} color="var(--loss)" />}
              {trade.take_profit != null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Take profit</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--profit)', fontVariantNumeric: 'tabular-nums' }}>{trade.take_profit}</span>
                </div>
              )}
              {trade.tags && trade.tags.length > 0 && (
                <div style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500, letterSpacing: '0.04em' }}>TAGS</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {trade.tags.map((tag: string) => (
                      <span key={tag} style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Activity size={15} style={{ color: 'var(--text-muted)' }} />
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Behaviour</p>
              </div>

              <EditRow label="Trade type">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['planned', 'impulsive'] as const).map(t => (
                    <button key={t} type="button" onClick={() => updateField('trade_type', trade.trade_type === t ? null : t)}
                      style={{ ...pillBtn(trade.trade_type === t, t === 'planned' ? 'var(--profit)' : 'var(--loss)', t === 'planned' ? 'var(--profit-dim)' : 'var(--loss-dim)', t === 'planned' ? 'rgba(61,153,112,0.25)' : 'rgba(192,57,43,0.25)'), textTransform: 'capitalize' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </EditRow>

              <EditRow label="Confidence">
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const active = trade.confidence != null && Number(trade.confidence) >= n
                    const color = n <= 4 ? 'var(--loss)' : n <= 7 ? '#B45309' : 'var(--profit)'
                    const dim = n <= 4 ? 'var(--loss-dim)' : n <= 7 ? 'rgba(180,83,9,0.1)' : 'var(--profit-dim)'
                    return (
                      <button key={n} type="button" onClick={() => updateField('confidence', Number(trade.confidence) === n ? null : n)}
                        title={`${n}/10`}
                        style={{ width: 22, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', background: active ? dim : 'var(--bg-elevated)', color: active ? color : 'var(--text-disabled)', border: `1px solid ${active ? 'transparent' : 'var(--border-subtle)'}` }}>
                        {n}
                      </button>
                    )
                  })}
                </div>
              </EditRow>
            </div>
          </div>

          {/* Notes + Screenshot */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {hasContent(trade.notes) && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FileText size={15} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Notes</p>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{trade.notes}</p>
              </div>
            )}

            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ImageIcon size={15} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Chart</p>
                </div>
                {hasContent(trade.screenshot_url) && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => screenshotRef.current?.click()} disabled={uploadingShot}
                      style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {uploadingShot ? 'Uploading…' : 'Replace'}
                    </button>
                    <button type="button" onClick={() => updateField('screenshot_url', null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--loss)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <X size={12} />Remove
                    </button>
                  </div>
                )}
              </div>

              {hasContent(trade.screenshot_url) ? (
                <img src={trade.screenshot_url} alt="Trade screenshot" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '28px 16px', borderRadius: 8, border: '2px dashed var(--border-default)', cursor: uploadingShot ? 'default' : 'pointer', color: 'var(--text-muted)' }}>
                  <ImagePlus size={20} strokeWidth={1.5} />
                  <span style={{ fontSize: 13 }}>{uploadingShot ? 'Uploading…' : 'Click to add a chart screenshot'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>PNG or JPG up to 10MB</span>
                  <input type="file" accept="image/*" disabled={uploadingShot} style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f); e.target.value = '' }} />
                </label>
              )}
              <input ref={screenshotRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f); e.target.value = '' }} />
            </div>
          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}
