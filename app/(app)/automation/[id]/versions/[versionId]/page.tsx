'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Eye, EyeOff, RefreshCw, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency, getPnlColor, formatR } from '@/lib/utils'

type Tab = 'settings' | 'webhook' | 'signals' | 'trades'

interface VersionRow {
  id: string
  version_label: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  mode: 'off' | 'paper' | 'live'
  assets: string[]
  timeframes: string[]
  risk_per_trade_pct: number | null
  max_trades_per_day: number | null
  max_drawdown_pct: number | null
  filters: Record<string, unknown>
  parameters: Record<string, unknown>
}

interface WebhookRow {
  id: string
  url_token: string
  webhook_secret: string
  last_received_at: string | null
}

interface EventRow {
  id: string
  received_at: string
  status: string
  rejection_reason: string | null
  parsed_signal: { side: string; symbol: string; price: number } | null
}

interface TradeRow {
  id: string
  trade_date: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  pnl: number
  rr: number | null
}

function statusBadge(status: string) {
  if (status === 'active') return <span className="badge-profit">Active</span>
  if (status === 'paused') return <span className="badge-loss">Paused</span>
  if (status === 'archived') return <span className="badge-neutral">Archived</span>
  return <span className="badge-neutral">Draft</span>
}

function eventBadge(status: string) {
  if (status === 'processed') return <span className="badge-profit">Processed</span>
  if (status === 'rejected' || status === 'error') return <span className="badge-loss">{status === 'error' ? 'Error' : 'Rejected'}</span>
  return <span className="badge-neutral">{status}</span>
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  border: 'none', background: active ? 'var(--bg-elevated)' : 'transparent',
  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
})

export default function VersionDetailPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id: strategyId, versionId } = use(params)
  const { symbol } = useCurrency()

  const [strategyName, setStrategyName] = useState('')
  const [version, setVersion] = useState<VersionRow | null>(null)
  const [webhook, setWebhook] = useState<WebhookRow | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('settings')
  const [error, setError] = useState('')

  const [versionLabel, setVersionLabel] = useState('')
  const [assets, setAssets] = useState('')
  const [timeframes, setTimeframes] = useState('')
  const [riskPct, setRiskPct] = useState('')
  const [maxTradesPerDay, setMaxTradesPerDay] = useState('')
  const [maxDrawdownPct, setMaxDrawdownPct] = useState('')
  const [filtersJson, setFiltersJson] = useState('{}')
  const [parametersJson, setParametersJson] = useState('{}')
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [changingMode, setChangingMode] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState('')

  async function load() {
    const [{ data: s }, { data: v }, { data: w }] = await Promise.all([
      supabase.from('automation_strategies').select('name').eq('id', strategyId).single(),
      supabase.from('automation_strategy_versions').select('*').eq('id', versionId).single(),
      supabase.from('automation_webhooks').select('*').eq('strategy_version_id', versionId).maybeSingle(),
    ])
    setStrategyName(s?.name || '')
    setVersion(v)
    setWebhook(w)
    if (v) {
      setVersionLabel(v.version_label)
      setAssets((v.assets || []).join(', '))
      setTimeframes((v.timeframes || []).join(', '))
      setRiskPct(v.risk_per_trade_pct != null ? String(v.risk_per_trade_pct) : '')
      setMaxTradesPerDay(v.max_trades_per_day != null ? String(v.max_trades_per_day) : '')
      setMaxDrawdownPct(v.max_drawdown_pct != null ? String(v.max_drawdown_pct) : '')
      setFiltersJson(JSON.stringify(v.filters ?? {}, null, 2))
      setParametersJson(JSON.stringify(v.parameters ?? {}, null, 2))
    }
    if (w) {
      const { data: ev } = await supabase.from('automation_webhook_events').select('*').eq('webhook_id', w.id).order('received_at', { ascending: false }).limit(50)
      setEvents(ev || [])
    }
    const { data: t } = await supabase.from('trades').select('*').eq('automation_strategy_version_id', versionId).order('trade_date', { ascending: false }).limit(50)
    setTrades(t || [])
    setLoading(false)
  }

  useEffect(() => { Promise.resolve().then(load) }, [versionId])

  const isDraft = version?.status === 'draft'

  async function handleSaveSettings() {
    if (!version) return
    setError('')
    let filters: unknown, parameters: unknown
    try { filters = JSON.parse(filtersJson || '{}') } catch { setError('Filters must be valid JSON.'); return }
    try { parameters = JSON.parse(parametersJson || '{}') } catch { setError('Parameters must be valid JSON.'); return }

    setSaving(true)
    const { error: updErr } = await supabase.from('automation_strategy_versions').update({
      version_label: versionLabel.trim() || version.version_label,
      assets: assets.split(',').map(x => x.trim()).filter(Boolean),
      timeframes: timeframes.split(',').map(x => x.trim()).filter(Boolean),
      risk_per_trade_pct: riskPct ? Number(riskPct) : null,
      max_trades_per_day: maxTradesPerDay ? Number(maxTradesPerDay) : null,
      max_drawdown_pct: maxDrawdownPct ? Number(maxDrawdownPct) : null,
      filters,
      parameters,
    }).eq('id', versionId)
    setSaving(false)
    if (updErr) setError(updErr.message)
    else load()
  }

  async function handleActivate() {
    setActivating(true); setError('')
    const res = await fetch(`/api/automation/versions/${versionId}/activate`, { method: 'POST' })
    const data = await res.json()
    setActivating(false)
    if (res.ok) load()
    else setError(data.error || 'Could not activate.')
  }

  async function handleModeChange(mode: string) {
    setChangingMode(true); setError('')
    const res = await fetch(`/api/automation/versions/${versionId}/mode`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
    })
    const data = await res.json()
    setChangingMode(false)
    if (res.ok) load()
    else setError(data.error || 'Could not change mode.')
  }

  async function handleRotateSecret() {
    if (!confirm('Rotate the webhook secret? Update the "secret" field in your TradingView alert right after — alerts using the old secret will start being rejected immediately.')) return
    setRotating(true); setError('')
    const res = await fetch(`/api/automation/versions/${versionId}/rotate-secret`, { method: 'POST' })
    const data = await res.json()
    setRotating(false)
    if (res.ok) { setWebhook(w => (w ? { ...w, webhook_secret: data.webhook_secret } : w)); setShowSecret(true) }
    else setError(data.error || 'Could not rotate secret.')
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 1500)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
  if (!version) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Version not found</div>

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const webhookUrl = webhook ? `${origin}/api/automation/webhooks/tv/${webhook.url_token}` : ''
  const exampleBody = `{\n  "secret": "${webhook ? (showSecret ? webhook.webhook_secret : '••••••••') : '…'}",\n  "ticker": "EURUSD",\n  "side": "long",\n  "price": {{close}},\n  "sl": {{plot_0}},\n  "tp": {{plot_1}},\n  "timeframe": "{{interval}}"\n}`

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="page-fixed-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px' }}>
        <Link href={`/automation/${strategyId}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />{strategyName || 'Strategy'}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {statusBadge(version.status)}
        </div>
      </div>

      <div className="m-pad" style={{ maxWidth: 800, margin: '0 auto', padding: '80px 40px 60px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{version.version_label}</h1>
        </div>

        {error && <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{error}</div>}

        <div className="m-wrap" style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
          <button style={tabBtn(tab === 'settings')} onClick={() => setTab('settings')}>Settings</button>
          <button style={tabBtn(tab === 'webhook')} onClick={() => setTab('webhook')}>Webhook</button>
          <button style={tabBtn(tab === 'signals')} onClick={() => setTab('signals')}>Signals {events.length > 0 && `(${events.length})`}</button>
          <button style={tabBtn(tab === 'trades')} onClick={() => setTab('trades')}>Trades {trades.length > 0 && `(${trades.length})`}</button>
        </div>

        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Mode</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Controls whether signals do anything. Live isn&apos;t available yet.</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['off', 'paper', 'live'] as const).map(m => (
                  <button
                    key={m}
                    disabled={changingMode || m === 'live' || version.mode === m}
                    onClick={() => handleModeChange(m)}
                    title={m === 'live' ? 'Live execution lands in a later update' : undefined}
                    className={version.mode === m ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: 12, padding: '6px 12px', opacity: m === 'live' ? 0.5 : 1, cursor: m === 'live' ? 'not-allowed' : 'pointer' }}
                  >
                    {m === 'off' ? 'Off' : m === 'paper' ? 'Paper' : 'Live'}
                  </button>
                ))}
              </div>
            </div>

            {isDraft ? (
              <div className="card" style={{ padding: '12px 16px', background: 'var(--bg-elevated)', fontSize: 13, color: 'var(--text-muted)' }}>
                This version is a draft — parameters are editable. Activating locks them; create a new version to change them later.
              </div>
            ) : (
              <div className="card" style={{ padding: '12px 16px', background: 'var(--bg-elevated)', fontSize: 13, color: 'var(--text-muted)' }}>
                This version is {version.status} — parameters are locked. Create a new version to change them.
              </div>
            )}

            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Version label</label>
                <input className="input" disabled={!isDraft} value={versionLabel} onChange={e => setVersionLabel(e.target.value)} style={{ fontSize: 14 }} />
              </div>
              <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Assets (comma-separated)</label>
                  <input className="input" disabled={!isDraft} placeholder="EURUSD, XAUUSD" value={assets} onChange={e => setAssets(e.target.value)} style={{ fontSize: 14 }} />
                </div>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Timeframes (comma-separated)</label>
                  <input className="input" disabled={!isDraft} placeholder="15, 60" value={timeframes} onChange={e => setTimeframes(e.target.value)} style={{ fontSize: 14 }} />
                </div>
              </div>
              <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Risk per trade %</label>
                  <input className="input" disabled={!isDraft} type="number" step="0.1" value={riskPct} onChange={e => setRiskPct(e.target.value)} style={{ fontSize: 14 }} />
                </div>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Max trades/day</label>
                  <input className="input" disabled={!isDraft} type="number" value={maxTradesPerDay} onChange={e => setMaxTradesPerDay(e.target.value)} style={{ fontSize: 14 }} />
                </div>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Max drawdown %</label>
                  <input className="input" disabled={!isDraft} type="number" step="0.1" value={maxDrawdownPct} onChange={e => setMaxDrawdownPct(e.target.value)} style={{ fontSize: 14 }} />
                </div>
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>
                  Filters (JSON — e.g. session windows: {'{"sessions":[{"days":[1,2,3,4,5],"start_utc":"07:00","end_utc":"16:00"}]}'})
                </label>
                <textarea className="input" disabled={!isDraft} rows={4} value={filtersJson} onChange={e => setFiltersJson(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Parameters (JSON — strategy-specific, free-form)</label>
                <textarea className="input" disabled={!isDraft} rows={4} value={parametersJson} onChange={e => setParametersJson(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
              </div>
              {isDraft && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" onClick={handleSaveSettings} disabled={saving} style={{ fontSize: 13 }}>{saving ? 'Saving…' : 'Save changes'}</button>
                  <button className="btn-primary" onClick={handleActivate} disabled={activating} style={{ fontSize: 13 }}>
                    <Check size={14} />{activating ? 'Activating…' : 'Activate version'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'webhook' && webhook && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Webhook URL</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                <input className="input" readOnly value={webhookUrl} style={{ fontSize: 12, fontFamily: 'monospace' }} />
                <button className="btn-secondary" onClick={() => copy(webhookUrl, 'url')} style={{ fontSize: 12, flexShrink: 0 }}>
                  <Copy size={13} />{copied === 'url' ? 'Copied' : 'Copy'}
                </button>
              </div>

              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Shared secret</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="input" readOnly type={showSecret ? 'text' : 'password'} value={webhook.webhook_secret} style={{ fontSize: 12, fontFamily: 'monospace' }} />
                <button className="btn-secondary" onClick={() => setShowSecret(s => !s)} style={{ fontSize: 12, flexShrink: 0 }}>
                  {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button className="btn-secondary" onClick={() => copy(webhook.webhook_secret, 'secret')} style={{ fontSize: 12, flexShrink: 0 }}>
                  <Copy size={13} />{copied === 'secret' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button className="btn-ghost" onClick={handleRotateSecret} disabled={rotating} style={{ fontSize: 12, padding: '4px 0' }}>
                <RefreshCw size={12} />{rotating ? 'Rotating…' : 'Rotate secret'}
              </button>

              <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 16 }}>
                Last received: {webhook.last_received_at ? new Date(webhook.last_received_at).toLocaleString() : 'never'}
              </p>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>TradingView alert message</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                Paste this JSON as the alert message on your Pine <code>alert()</code> call, with this webhook&apos;s URL as the notification URL.
                TradingView can&apos;t sign requests, so the <code>secret</code> field above is the actual check — keep it out of public Pine scripts. Use <code>&quot;side&quot;: &quot;close&quot;</code> to close an open position.
              </p>
              <pre style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 14, fontSize: 12, overflowX: 'auto', color: 'var(--text-secondary)' }}>{exampleBody}</pre>
            </div>
          </div>
        )}
        {tab === 'webhook' && !webhook && (
          <div className="card" style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>No webhook found for this version.</div>
        )}

        {tab === 'signals' && (
          events.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>No signals received yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map(ev => (
                <div key={ev.id} className="card" style={{ padding: '14px 18px' }}>
                  <div className="m-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: ev.rejection_reason ? 6 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {eventBadge(ev.status)}
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.parsed_signal ? `${ev.parsed_signal.side} ${ev.parsed_signal.symbol} @ ${ev.parsed_signal.price}` : '(unparsed)'}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-disabled)', flexShrink: 0 }}>{new Date(ev.received_at).toLocaleString()}</span>
                  </div>
                  {ev.rejection_reason && <p style={{ fontSize: 12, color: 'var(--loss)', lineHeight: 1.5 }}>{ev.rejection_reason}</p>}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'trades' && (
          trades.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>No trades published yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trades.map(t => (
                <div key={t.id} className="card m-col" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className={t.direction === 'LONG' ? 'badge-profit' : 'badge-loss'}>{t.direction}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.symbol}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{t.trade_date}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {t.rr != null && <span style={{ fontSize: 12, color: getPnlColor(t.rr) }}>{formatR(t.rr)}</span>}
                    <span style={{ fontSize: 13, fontWeight: 500, color: getPnlColor(t.pnl), fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(t.pnl, true, symbol)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
