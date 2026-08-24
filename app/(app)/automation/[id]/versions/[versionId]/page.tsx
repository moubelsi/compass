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
  broker_account_id: string | null
  assets: string[]
  timeframes: string[]
  risk_per_trade_pct: number | null
  max_trades_per_day: number | null
  max_drawdown_pct: number | null
  filters: Record<string, unknown>
  parameters: Record<string, unknown>
}

interface BrokerAccountOption {
  id: string
  broker: 'ctrader' | 'okx'
  label: string
  is_live: boolean
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
  entry_price: number | null
  exit_price: number | null
  pnl: number
  rr: number | null
  mode: 'paper' | 'live' | 'backtest' | null
  is_live_account: boolean | null
}

interface LivePnl {
  currentPrice: number | null
  unrealizedPnl: number | null
  unrealizedReturnPct: number | null
}

interface TradeStats {
  count: number
  winRate: number | null
  totalPnl: number
}

function computeStats(trades: TradeRow[]): TradeStats {
  const count = trades.length
  const wins = trades.filter(t => Number(t.pnl) > 0).length
  const totalPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0)
  return { count, winRate: count > 0 ? (wins / count) * 100 : null, totalPnl }
}

interface OpenPositionRow {
  id: string
  symbol: string
  side: 'long' | 'short'
  filled_price: number | null
  requested_price: number
  requested_qty: number
  sl: number | null
  tp: number | null
  created_at: string
  mode: 'paper' | 'live' | 'backtest' | null
  is_live_account: boolean | null
}

function statusBadge(status: string) {
  if (status === 'active') return <span className="badge-profit">Active</span>
  if (status === 'paused') return <span className="badge-loss">Paused</span>
  if (status === 'archived') return <span className="badge-neutral">Archived</span>
  return <span className="badge-neutral">Draft</span>
}

/** Distinguishes stakes at a glance: Paper (simulated), Demo (a real broker
 * call, but against a demo account — no real money), or Live (real money).
 * Neutral/grey for the two no-real-money cases, red only for genuine stakes —
 * keeps this from visually clashing with the adjacent green/red side badge. */
function stakesBadge(mode: string | null, isLiveAccount: boolean | null) {
  if (mode === 'paper') return <span className="badge-neutral">Paper</span>
  if (mode === 'live' && isLiveAccount) return <span className="badge-loss">Live</span>
  if (mode === 'live') return <span className="badge-neutral">Demo</span>
  return null
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
  const [openPositions, setOpenPositions] = useState<OpenPositionRow[]>([])
  const [livePnl, setLivePnl] = useState<Record<string, LivePnl>>({})
  const [pnlLoading, setPnlLoading] = useState(false)
  const [pnlUpdatedAt, setPnlUpdatedAt] = useState<Date | null>(null)
  const [stats, setStats] = useState<TradeStats>({ count: 0, winRate: null, totalPnl: 0 })
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null)
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccountOption[]>([])
  const [savingBroker, setSavingBroker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('trades')
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
    const [{ data: s }, { data: v }, { data: w }, { data: ba }] = await Promise.all([
      supabase.from('automation_strategies').select('name').eq('id', strategyId).single(),
      supabase.from('automation_strategy_versions').select('*').eq('id', versionId).single(),
      supabase.from('automation_webhooks').select('*').eq('strategy_version_id', versionId).maybeSingle(),
      supabase.from('automation_broker_accounts').select('id, broker, label, is_live').eq('status', 'connected').order('created_at', { ascending: false }),
    ])
    setBrokerAccounts(ba || [])
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
    setStats(computeStats(t || []))

    const [{ data: entries }, { data: closes }] = await Promise.all([
      supabase.from('automation_orders')
        .select('id, symbol, side, filled_price, requested_price, requested_qty, sl, tp, created_at, mode, is_live_account')
        .eq('strategy_version_id', versionId).in('side', ['long', 'short']).eq('status', 'filled')
        .order('created_at', { ascending: false }),
      supabase.from('automation_orders')
        .select('closes_order_id')
        .eq('strategy_version_id', versionId).eq('side', 'close').not('closes_order_id', 'is', null),
    ])
    const closedIds = new Set((closes || []).map(c => c.closes_order_id as string))
    setOpenPositions((entries || []).filter(e => !closedIds.has(e.id)))

    setLoading(false)
  }

  async function loadLivePnl() {
    setPnlLoading(true)
    try {
      const res = await fetch(`/api/automation/versions/${versionId}/open-positions`)
      const data = await res.json().catch(() => null)
      if (res.ok && data?.positions) {
        setLivePnl(data.positions)
        setPnlUpdatedAt(new Date())
      }
    } finally {
      setPnlLoading(false)
    }
  }

  useEffect(() => { Promise.resolve().then(load) }, [versionId])

  // Poll live P&L for open positions every 20s while this page is open —
  // only when there's actually something open, so idle versions don't spam
  // the broker API for nothing.
  const openPositionIds = openPositions.map(p => p.id).join(',')
  useEffect(() => {
    if (!openPositionIds) return
    Promise.resolve().then(loadLivePnl)
    const interval = setInterval(loadLivePnl, 20_000)
    return () => clearInterval(interval)
  }, [openPositionIds])

  async function handleClosePosition(positionSymbol: string) {
    if (!confirm(`Close the open ${positionSymbol} position? This sends a real close order to the broker right now.`)) return
    setClosingSymbol(positionSymbol)
    try {
      const res = await fetch(`/api/automation/versions/${versionId}/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: positionSymbol }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.status !== 'position_closed') {
        setError(data?.error || data?.reason || 'Could not close the position.')
        return
      }
      load()
    } finally {
      setClosingSymbol(null)
    }
  }

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
    if (mode === 'live') {
      const account = brokerAccounts.find(a => a.id === version?.broker_account_id)
      if (!account) { setError('Select a broker account below before switching to live.'); return }
      const stakes = account.is_live ? 'LIVE — this places real orders with real money' : 'Demo — simulated money on the broker\'s side'
      if (!confirm(`Switch to live mode?\n\nBroker account: ${account.broker} — ${account.label}\nStakes: ${stakes}\n\nEvery future signal will be sent to this account until you switch back.`)) return
    }
    setChangingMode(true); setError('')
    const res = await fetch(`/api/automation/versions/${versionId}/mode`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
    })
    const data = await res.json()
    setChangingMode(false)
    if (res.ok) load()
    else setError(data.error || 'Could not change mode.')
  }

  async function handleSelectBrokerAccount(accountId: string) {
    setSavingBroker(true); setError('')
    const { error: updErr } = await supabase
      .from('automation_strategy_versions')
      .update({ broker_account_id: accountId || null })
      .eq('id', versionId)
    setSavingBroker(false)
    if (updErr) setError(updErr.message)
    else load()
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
          <button style={tabBtn(tab === 'trades')} onClick={() => setTab('trades')}>
            Trades {trades.length > 0 && `(${trades.length})`}
            {openPositions.length > 0 && <span className="badge-profit" style={{ marginLeft: 6 }}>{openPositions.length} open</span>}
          </button>
          <button style={tabBtn(tab === 'signals')} onClick={() => setTab('signals')}>Signals {events.length > 0 && `(${events.length})`}</button>
          <span style={{ flex: 1 }} />
          <button style={tabBtn(tab === 'webhook')} onClick={() => setTab('webhook')}>Webhook</button>
          <button style={tabBtn(tab === 'settings')} onClick={() => setTab('settings')}>Settings</button>
        </div>

        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="m-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Mode</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Controls whether signals do anything.</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['off', 'paper', 'live'] as const).map(m => {
                    const liveBlocked = m === 'live' && !version.broker_account_id
                    return (
                      <button
                        key={m}
                        disabled={changingMode || liveBlocked || version.mode === m}
                        onClick={() => handleModeChange(m)}
                        title={liveBlocked ? 'Select a broker account below first' : undefined}
                        className={version.mode === m ? 'btn-primary' : 'btn-secondary'}
                        style={{ fontSize: 12, padding: '6px 12px', opacity: liveBlocked ? 0.5 : 1, cursor: liveBlocked ? 'not-allowed' : 'pointer' }}
                      >
                        {m === 'off' ? 'Off' : m === 'paper' ? 'Paper' : 'Live'}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Broker account (required for live)</label>
                {brokerAccounts.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    No broker accounts connected. <Link href="/automation/brokers" style={{ color: 'var(--accent)' }}>Connect one</Link> — we recommend starting with a demo account.
                  </p>
                ) : (
                  <select
                    className="input"
                    disabled={savingBroker}
                    value={version.broker_account_id ?? ''}
                    onChange={e => handleSelectBrokerAccount(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="">— none —</option>
                    {brokerAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.broker} — {a.label} ({a.is_live ? 'Live' : 'Demo'})</option>
                    ))}
                  </select>
                )}
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
                <input className="input" readOnly value={webhookUrl} style={{ fontSize: 12, fontFamily: 'monospace', minWidth: 0, overflowX: 'auto' }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {(trades.length > 0 || openPositions.length > 0) && (
              <div className="card m-grid-2" style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: `repeat(${openPositions.length > 0 ? 4 : 3}, 1fr)`, gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Closed trades</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stats.count}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Win rate</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Realized P&amp;L</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: getPnlColor(stats.totalPnl), fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(stats.totalPnl, true, symbol)}</p>
                </div>
                {openPositions.length > 0 && (() => {
                  const values = openPositions.map(p => livePnl[p.id]?.unrealizedPnl).filter((v): v is number => v != null)
                  const total = values.length > 0 ? values.reduce((s, v) => s + v, 0) : null
                  return (
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Unrealized P&amp;L</p>
                      <p style={{ fontSize: 18, fontWeight: 600, color: total != null ? getPnlColor(total) : 'var(--text-disabled)', fontVariantNumeric: 'tabular-nums' }}>
                        {total != null ? formatCurrency(total, true, symbol) : '—'}
                      </p>
                    </div>
                  )
                })()}
              </div>
            )}

            {openPositions.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--profit)' }} />
                    Open positions
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                      {pnlLoading ? 'Updating…' : pnlUpdatedAt ? `Updated ${pnlUpdatedAt.toLocaleTimeString()}` : ''}
                    </span>
                    <button className="btn-ghost" onClick={loadLivePnl} disabled={pnlLoading} style={{ fontSize: 12, padding: '4px 6px' }}>
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openPositions.map(p => {
                    const entryPrice = p.filled_price ?? p.requested_price
                    const live = livePnl[p.id]
                    return (
                      <div key={p.id} className="card m-col" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
                          {stakesBadge(p.mode, p.is_live_account)}
                          <span className={p.side === 'long' ? 'badge-profit' : 'badge-loss'}>{p.side.toUpperCase()}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.symbol}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            entry {entryPrice} · qty {p.requested_qty}
                            {p.sl != null && ` · SL ${p.sl}`}
                            {p.tp != null && ` · TP ${p.tp}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                              {live?.currentPrice != null ? `now ${live.currentPrice}` : pnlLoading ? 'loading…' : 'price unavailable'}
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--text-disabled)' }}>opened {new Date(p.created_at).toLocaleString()}</p>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 90 }}>
                            {live?.unrealizedPnl != null ? (
                              <>
                                <p style={{ fontSize: 13, fontWeight: 500, color: getPnlColor(live.unrealizedPnl), fontVariantNumeric: 'tabular-nums' }}>
                                  {formatCurrency(live.unrealizedPnl, true, symbol)}
                                </p>
                                {live.unrealizedReturnPct != null && (
                                  <p style={{ fontSize: 11, color: getPnlColor(live.unrealizedReturnPct) }}>{live.unrealizedReturnPct >= 0 ? '+' : ''}{live.unrealizedReturnPct.toFixed(2)}%</p>
                                )}
                              </>
                            ) : (
                              <p style={{ fontSize: 12, color: 'var(--text-disabled)' }}>—</p>
                            )}
                          </div>
                          <button className="btn-secondary" onClick={() => handleClosePosition(p.symbol)} disabled={closingSymbol === p.symbol} style={{ fontSize: 12, padding: '5px 10px' }}>
                            {closingSymbol === p.symbol ? 'Closing…' : 'Close'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {trades.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>No trades published yet.</div>
            ) : (
              <div>
                {openPositions.length > 0 && (
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Closed trades</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {trades.map(t => (
                    <div key={t.id} className="card m-col" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
                        {stakesBadge(t.mode, t.is_live_account)}
                        <span className={t.direction === 'LONG' ? 'badge-profit' : 'badge-loss'}>{t.direction}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.symbol}</span>
                        {t.entry_price != null && t.exit_price != null && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{t.entry_price} → {t.exit_price}</span>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{t.trade_date}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        {t.rr != null && <span style={{ fontSize: 12, color: getPnlColor(t.rr) }}>{formatR(t.rr)}</span>}
                        <span style={{ fontSize: 13, fontWeight: 500, color: getPnlColor(t.pnl), fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(t.pnl, true, symbol)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
