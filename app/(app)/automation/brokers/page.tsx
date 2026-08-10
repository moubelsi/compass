'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Link2, Unlink, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface BrokerAccount {
  id: string
  broker: 'ctrader' | 'okx'
  label: string
  is_live: boolean
  status: string
  created_at: string
}

interface PendingCtraderAccount {
  id: string
  brokerName: string
  accountNumber: string
  isLive: boolean
  currency: string
  balance: number
}

function liveBadge(isLive: boolean) {
  return isLive
    ? <span className="badge-loss">Live</span>
    : <span className="badge-profit">Demo</span>
}

export default function BrokersPage() {
  const [accounts, setAccounts] = useState<BrokerAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [pendingAccounts, setPendingAccounts] = useState<PendingCtraderAccount[] | null>(null)
  const [pendingBusy, setPendingBusy] = useState(false)

  const [showOkxForm, setShowOkxForm] = useState(false)
  const [okxKey, setOkxKey] = useState('')
  const [okxSecret, setOkxSecret] = useState('')
  const [okxPassphrase, setOkxPassphrase] = useState('')
  const [okxIsLive, setOkxIsLive] = useState(false)
  const [okxLabel, setOkxLabel] = useState('')
  const [okxBusy, setOkxBusy] = useState(false)

  function load() {
    supabase.from('automation_broker_accounts').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setAccounts(data || []); setLoading(false) })
  }

  function init() {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('ctrader_error')
    if (err) setError(err)
    if (params.get('ctrader_pending')) {
      fetch('/api/automation/ctrader/pending-accounts')
        .then(res => res.json())
        .then(data => { if (data.accounts) setPendingAccounts(data.accounts) })
    }
    if (err || params.get('ctrader_pending')) window.history.replaceState(null, '', window.location.pathname)
    load()
  }

  useEffect(() => { Promise.resolve().then(init) }, [])

  async function chooseCtraderAccount(accountId: string) {
    setPendingBusy(true)
    setError('')
    try {
      const res = await fetch('/api/automation/ctrader/finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not save this account.'); return }
      setPendingAccounts(null)
      load()
    } finally {
      setPendingBusy(false)
    }
  }

  async function connectOkx() {
    setOkxBusy(true)
    setError('')
    try {
      const res = await fetch('/api/automation/okx/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: okxKey, apiSecret: okxSecret, passphrase: okxPassphrase, isLive: okxIsLive, label: okxLabel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not connect.'); return }
      setShowOkxForm(false)
      setOkxKey(''); setOkxSecret(''); setOkxPassphrase(''); setOkxLabel(''); setOkxIsLive(false)
      load()
    } finally {
      setOkxBusy(false)
    }
  }

  async function disconnect(id: string, label: string) {
    if (!confirm(`Disconnect "${label}"? Any strategy version using it switches out of live mode.`)) return
    const res = await fetch(`/api/automation/brokers/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else setError('Could not disconnect. Please try again.')
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="page-fixed-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px' }}>
        <Link href="/automation" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Automation
        </Link>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Brokers</span>
        <div style={{ width: 90 }} />
      </div>

      <div className="m-pad" style={{ maxWidth: 720, margin: '0 auto', padding: '80px 40px 60px' }}>
        {error && <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{error}</div>}

        {pendingAccounts && (
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Choose a cTrader account</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Pick which one to connect for trading — we recommend starting with a demo account.</p>
            {pendingAccounts.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No trading accounts found on this cTrader ID.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingAccounts.map(a => (
                  <div key={a.id} className="m-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {liveBadge(a.isLive)}
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.brokerName} — {a.accountNumber}</span>
                    </div>
                    <button className="btn-primary" disabled={pendingBusy} style={{ fontSize: 12 }} onClick={() => chooseCtraderAccount(a.id)}>Connect</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>Connected accounts</p>

        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</p>
        ) : accounts.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No broker accounts connected yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {accounts.map(a => (
              <div key={a.id} className="card m-col" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {liveBadge(a.is_live)}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{a.broker}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                </div>
                <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--loss)' }} onClick={() => disconnect(a.id, a.label)}>
                  <Unlink size={13} />Disconnect
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ padding: 20, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>cTrader</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Separate, trading-scope connection — your existing read-only import is untouched.</p>
          </div>
          <a href="/api/automation/ctrader/login" className="btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
            <Link2 size={13} />Connect
          </a>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>OKX</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Spot only for now. Create a Demo Trading API key in OKX first for testing.</p>
            </div>
            {!showOkxForm && (
              <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowOkxForm(true)}>
                <Link2 size={13} />Connect
              </button>
            )}
          </div>

          {showOkxForm && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={13} />Keys are encrypted and never leave the server.
              </p>
              <input className="input" placeholder="API key" value={okxKey} onChange={e => setOkxKey(e.target.value)} style={{ fontSize: 13 }} autoComplete="off" />
              <input className="input" placeholder="API secret" type="password" value={okxSecret} onChange={e => setOkxSecret(e.target.value)} style={{ fontSize: 13 }} autoComplete="off" />
              <input className="input" placeholder="Passphrase" type="password" value={okxPassphrase} onChange={e => setOkxPassphrase(e.target.value)} style={{ fontSize: 13 }} autoComplete="off" />
              <input className="input" placeholder="Label (optional)" value={okxLabel} onChange={e => setOkxLabel(e.target.value)} style={{ fontSize: 13 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={okxIsLive} onChange={e => setOkxIsLive(e.target.checked)} />
                This is a real (live) API key, not a Demo Trading key
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn-primary" style={{ fontSize: 13 }} disabled={okxBusy || !okxKey || !okxSecret || !okxPassphrase} onClick={connectOkx}>
                  {okxBusy ? 'Verifying…' : 'Connect'}
                </button>
                <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowOkxForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
