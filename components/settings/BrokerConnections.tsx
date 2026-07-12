'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, History, Link2, Unlink } from 'lucide-react'

interface BrokerAccountView {
  id: string
  brokerName: string
  accountNumber: string
  isLive: boolean
  currency: string
  balance: number
}

type Status = 'loading' | 'not_connected' | 'reauth' | 'connected'

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
  background: 'transparent', border: '1px solid var(--border-default)',
  color: 'var(--text-secondary)', cursor: 'pointer',
}

function formatLastSync(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function MexcRow() {
  const [status, setStatus]         = useState<'loading' | 'not_connected' | 'connected'>('loading')
  const [account, setAccount]       = useState<{ accountNumber: string; currency: string } | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [apiKey, setApiKey]         = useState('')
  const [apiSecret, setApiSecret]   = useState('')
  const [busy, setBusy]             = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState('')
  const [error, setError]           = useState('')

  useEffect(() => {
    fetch('/api/mexc/connect')
      .then(async res => {
        if (res.status === 404) { setStatus('not_connected'); return }
        const data = await res.json()
        if (!res.ok) { setStatus('not_connected'); return }
        setAccount(data.account)
        setLastSyncedAt(data.last_synced_at ?? null)
        setStatus('connected')
      })
      .catch(() => setStatus('not_connected'))
  }, [])

  const syncNow = useCallback(async () => {
    setSyncing(true)
    setError('')
    setSyncMsg('Syncing…')
    let imported = 0
    try {
      for (let i = 0; i < 60; i++) {
        const res = await fetch('/api/mexc/sync', { method: 'POST' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) { setError(data.message || data.error || 'Sync failed.'); setSyncMsg(''); return }
        imported += data.imported ?? 0
        if (data.done) break
        setSyncMsg(`Syncing… ${imported} trades imported so far`)
      }
      setLastSyncedAt(new Date().toISOString())
      setSyncMsg(imported > 0 ? `Sync complete — ${imported} new trade${imported === 1 ? '' : 's'} imported.` : 'Sync complete — no new trades.')
    } catch {
      setError('Sync failed. Please try again.')
      setSyncMsg('')
    } finally {
      setSyncing(false)
    }
  }, [])

  async function connect() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/mexc/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not connect.'); return }
      setAccount(data.account)
      setStatus('connected')
      setShowForm(false)
      setApiKey('')
      setApiSecret('')
      // First connection: pull in the account's history right away
      syncNow()
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect MEXC? Imported trades stay in your journal.')) return
    const res = await fetch('/api/mexc/disconnect', { method: 'POST' })
    if (res.ok) { setStatus('not_connected'); setAccount(null); setLastSyncedAt(null); setSyncMsg('') }
    else setError('Could not disconnect. Please try again.')
  }

  const connected = status === 'connected'

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '16px 18px', marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>MEXC</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? 'var(--profit)' : 'var(--text-muted)' }} />
              {status === 'loading' ? 'Checking…' : connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          {connected && account && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              MEXC · {account.accountNumber} · {account.currency} — Last sync: {formatLastSync(lastSyncedAt)}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {status === 'not_connected' && !showForm && (
            <button onClick={() => setShowForm(true)} className="btn-primary" style={{ fontSize: 13 }}>
              <Link2 size={14} /> Connect
            </button>
          )}
          {connected && (
            <button onClick={syncNow} disabled={syncing} style={{ ...secondaryBtn, opacity: syncing ? 0.6 : 1 }}>
              <RefreshCw size={13} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
          {connected && (
            <button onClick={disconnect} disabled={syncing} style={{ ...secondaryBtn, color: 'var(--loss)' }}>
              <Unlink size={13} /> Disconnect
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Create a <strong style={{ color: 'var(--text-secondary)' }}>read-only</strong> API key in MEXC under Account → API Management (futures read permission is enough) and paste it here. Keys are stored server-side and never leave your account.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
            <input className="input" placeholder="API key" value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ fontSize: 13 }} autoComplete="off" />
            <input className="input" placeholder="API secret" type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} style={{ fontSize: 13 }} autoComplete="off" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ fontSize: 13 }} disabled={busy || !apiKey || !apiSecret} onClick={connect}>
                {busy ? 'Verifying…' : 'Connect'}
              </button>
              <button style={{ ...secondaryBtn }} onClick={() => { setShowForm(false); setError('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: 'var(--loss)', marginTop: 12 }}>{error}</p>}
      {syncMsg && <p style={{ fontSize: 12, color: syncing ? 'var(--text-muted)' : 'var(--profit)', marginTop: 12 }}>{syncMsg}</p>}
    </div>
  )
}

export function BrokerConnections() {
  const [status, setStatus]         = useState<Status>('loading')
  const [accounts, setAccounts]     = useState<BrokerAccountView[]>([])
  const [selected, setSelected]     = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState('')
  const [error, setError]           = useState('')
  const [saving, setSaving]         = useState(false)
  const cancelled = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ctrader/accounts')
      if (res.status === 404) { setStatus('not_connected'); return }
      if (res.status === 401) { setStatus('reauth'); return }
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not load connection.'); setStatus('not_connected'); return }
      setAccounts(data.accounts || [])
      setSelected(data.selected ?? null)
      setLastSyncedAt(data.last_synced_at ?? null)
      setStatus('connected')
    } catch {
      setError('Could not reach the server. Check your connection and refresh.')
      setStatus('not_connected')
    }
  }, [])

  useEffect(() => {
    // Feedback from the OAuth redirect (?ctrader=connected / ?ctrader_error=…)
    const params = new URLSearchParams(window.location.search)
    const err = params.get('ctrader_error')
    if (err) setError(err)
    if (err || params.get('ctrader')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    load()
    return () => { cancelled.current = true }
  }, [load])

  const runSyncLoop = useCallback(async (first: '/api/ctrader/sync' | '/api/ctrader/import') => {
    // Reset here: React StrictMode's dev mount/unmount/remount leaves the ref
    // true from the first cleanup, which would silently skip the whole loop
    cancelled.current = false
    setSyncing(true)
    setError('')
    setSyncMsg('Syncing…')
    let imported = 0
    try {
      // The API imports in resumable batches; the first request may rewind
      // (full import), every continuation goes through the incremental route
      let endpoint = first
      for (let i = 0; i < 120 && !cancelled.current; i++) {
        const res = await fetch(endpoint, { method: 'POST' })
        endpoint = '/api/ctrader/sync'
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) { setStatus('reauth'); setSyncMsg(''); return }
        if (!res.ok) { setError(data.message || data.error || 'Sync failed.'); setSyncMsg(''); return }
        imported += data.imported ?? 0
        if (data.done) break
        setSyncMsg(`Syncing… ${imported} trades imported so far`)
      }
      setLastSyncedAt(new Date().toISOString())
      setSyncMsg(imported > 0 ? `Sync complete — ${imported} new trade${imported === 1 ? '' : 's'} imported.` : 'Sync complete — no new trades.')
    } catch {
      setError('Sync failed. Please try again.')
      setSyncMsg('')
    } finally {
      setSyncing(false)
    }
  }, [])

  const syncNow = useCallback(() => runSyncLoop('/api/ctrader/sync'), [runSyncLoop])

  const reimportAll = useCallback(() => {
    if (!confirm('Re-import the full account history? Already imported trades are never duplicated; deleted ones come back.')) return
    runSyncLoop('/api/ctrader/import')
  }, [runSyncLoop])

  async function chooseAccount(id: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/ctrader/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message || data.error || 'Could not save account.'); return }
      setSelected(id)
      // First selection: immediately import the account's history
      syncNow()
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect cTrader? Imported trades stay in your journal.')) return
    setError('')
    const res = await fetch('/api/ctrader/disconnect', { method: 'POST' })
    if (res.ok) {
      setStatus('not_connected')
      setAccounts([])
      setSelected(null)
      setLastSyncedAt(null)
      setSyncMsg('')
    } else {
      setError('Could not disconnect. Please try again.')
    }
  }

  const selectedAccount = accounts.find(a => a.id === selected)
  const connected = status === 'connected'
  const dotColor = connected ? 'var(--profit)' : status === 'reauth' ? '#B45309' : 'var(--text-muted)'
  const statusLabel = status === 'loading' ? 'Checking…' : connected ? 'Connected' : status === 'reauth' ? 'Reconnect needed' : 'Not connected'

  return (
    <div className="card" style={{ padding: 28 }}>
      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Broker connections</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Connect your broker to import your trading history and keep new trades synced automatically.
      </p>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 13, color: 'var(--loss)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* cTrader row */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>cTrader</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
                {statusLabel}
              </span>
            </div>
            {connected && selectedAccount && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {selectedAccount.brokerName} · {selectedAccount.accountNumber} · {selectedAccount.isLive ? 'Live' : 'Demo'}
                {selectedAccount.currency ? ` · ${selectedAccount.currency}` : ''} — Last sync: {formatLastSync(lastSyncedAt)}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {status === 'not_connected' && (
              <a href="/api/ctrader/login" className="btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
                <Link2 size={14} /> Connect
              </a>
            )}
            {status === 'reauth' && (
              <a href="/api/ctrader/login" className="btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
                <Link2 size={14} /> Reconnect
              </a>
            )}
            {connected && selected && (
              <button onClick={syncNow} disabled={syncing} style={{ ...secondaryBtn, opacity: syncing ? 0.6 : 1 }}>
                <RefreshCw size={13} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
            )}
            {connected && selected && (
              <button onClick={reimportAll} disabled={syncing} title="Rescan the full account history" style={{ ...secondaryBtn, opacity: syncing ? 0.6 : 1 }}>
                <History size={13} /> Re-import all
              </button>
            )}
            {connected && (
              <button onClick={disconnect} disabled={syncing} style={{ ...secondaryBtn, color: 'var(--loss)' }}>
                <Unlink size={13} /> Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Account selection */}
        {connected && accounts.length > 0 && !selected && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 10 }}>
              Choose the trading account to import:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accounts.map(a => (
                <button
                  key={a.id}
                  onClick={() => chooseAccount(a.id)}
                  disabled={saving || syncing}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {a.brokerName} · {a.accountNumber}
                    <span style={{
                      marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                      background: a.isLive ? 'var(--profit-dim)' : 'var(--bg-overlay)',
                      color: a.isLive ? 'var(--profit)' : 'var(--text-muted)',
                    }}>
                      {a.isLive ? 'LIVE' : 'DEMO'}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {a.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {a.currency}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {syncMsg && (
          <p style={{ fontSize: 12, color: syncing ? 'var(--text-muted)' : 'var(--profit)', marginTop: 12 }}>{syncMsg}</p>
        )}
      </div>

      {/* MEXC (futures) */}
      <MexcRow />
    </div>
  )
}
