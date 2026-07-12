'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCurrency, CURRENCY_OPTIONS } from '@/lib/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { BrokerConnections } from '@/components/settings/BrokerConnections'
import { fetchAllRows } from '@/lib/fetchAll'

export default function SettingsPage() {
  const { symbol, setCurrency }         = useCurrency()
  const [email, setEmail]               = useState('')
  const [loadingUser, setLoadingUser] = useState(true)
  const [trades, setTrades] = useState<any[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteSuccess, setDeleteSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: { user } }, tradeRows] = await Promise.all([
        supabase.auth.getUser(),
        fetchAllRows((from, to) => supabase.from('trades').select('*').order('trade_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).range(from, to)).catch(() => []),
      ])
      setEmail(user?.email ?? '')
      setTrades(tradeRows)
      setLoadingUser(false)
    }
    load()
  }, [])

  function exportCSV() {
    setExporting(true)
    const headers = ['Date','Symbol','Direction','Strategy','Entry','Exit','Stop Loss','Take Profit','P&L','Return %','R:R','Trade Type','Confidence','Followed Plan','Notes','Tags']
    const rows = trades.map(t => [
      t.trade_date || t.created_at?.split('T')[0] || '',
      t.symbol || '', t.direction || '', t.strategy || '',
      t.entry_price ?? '', t.exit_price ?? '', t.stop_loss ?? '', t.take_profit ?? '',
      t.pnl ?? '', t.return_pct ?? '', t.rr ?? '',
      t.trade_type || '', t.confidence ?? '',
      t.followed_plan != null ? (t.followed_plan ? 'Yes' : 'No') : '',
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      `"${(t.tags || []).join(', ')}"`,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compass-trades-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExporting(false)
    setExportDone(true)
    setTimeout(() => setExportDone(false), 3000)
  }

  async function handleChangePassword() {
    setPwError('')
    setPwSuccess(false)
    if (!newPassword || !confirmPassword) { setPwError('Please fill in both fields.'); return }
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwError(error.message)
    } else {
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }
    setPwLoading(false)
  }

  async function handleDeleteAllTrades() {
    if (!confirm('Delete ALL trades? This cannot be undone.')) return
    setDeleteLoading(true)
    setDeleteError('')
    setDeleteSuccess(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeleteError('Session expired. Please sign in again.'); setDeleteLoading(false); return }
    const { error } = await supabase.from('trades').delete().eq('user_id', user.id)
    if (error) {
      setDeleteError(error.message)
    } else {
      setDeleteSuccess(true)
    }
    setDeleteLoading(false)
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="m-pad" style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Settings</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Manage your account</p>
        </div>
      </div>

      <div className="m-pad" style={{ maxWidth: 720, margin: '0 auto', padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Account */}
        <div className="card" style={{ padding: 28 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20 }}>Account</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Email</label>
              <input className="input" type="email" value={loadingUser ? '' : email} disabled style={{ opacity: 0.6, cursor: 'default' }} />
            </div>
            {trades.length > 0 && (() => {
              const wins = trades.filter(t => Number(t.pnl) > 0).length
              const totalPnl = trades.reduce((s, t) => s + Number(t.pnl || 0), 0)
              const winRate = ((wins / trades.length) * 100).toFixed(1)
              return (
                <div className="m-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingTop: 4 }}>
                  {[
                    { label: 'Total trades', value: String(trades.length), color: undefined },
                    { label: 'Win rate', value: `${winRate}%`, color: Number(winRate) >= 50 ? 'var(--profit)' : 'var(--loss)' },
                    { label: 'All-time P&L', value: formatCurrency(totalPnl, true, symbol), color: totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>{label}</p>
                      <p style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>

        {/* Preferences */}
        <div className="card" style={{ padding: 28 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20 }}>Preferences</p>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Currency</label>
            <select
              className="input"
              value={symbol}
              onChange={e => setCurrency(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              {CURRENCY_OPTIONS.map(opt => (
                <option key={opt.symbol} value={opt.symbol}>{opt.label}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Applies to P&L values across the app.</p>
          </div>
        </div>

        {/* Broker connections */}
        <BrokerConnections />

        {/* Export */}
        <div className="card" style={{ padding: 28 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Export data</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Download all your trades as a CSV file — includes every field (date, symbol, P&L, notes, tags…). Compatible with Excel and Google Sheets.
          </p>
          <button onClick={exportCSV} disabled={exporting || trades.length === 0} className="btn-primary" style={{ fontSize: 14 }}>
            <Download size={14} />
            {exportDone ? '✓ Downloaded!' : exporting ? 'Preparing…' : `Export ${trades.length} trade${trades.length !== 1 ? 's' : ''} as CSV`}
          </button>
          {trades.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>No trades to export yet.</p>}
        </div>

        {/* Change password */}
        <div className="card" style={{ padding: 28 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20 }}>Change password</p>

          {pwSuccess && (
            <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--profit-dim)', border: '1px solid rgba(61,153,112,0.2)', fontSize: 13, color: 'var(--profit)', marginBottom: 16 }}>
              Password updated successfully.
            </div>
          )}
          {pwError && (
            <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 13, color: 'var(--loss)', marginBottom: 16 }}>
              {pwError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>New password</label>
              <input
                className="input"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwSuccess(false); setPwError('') }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Confirm new password</label>
              <input
                className="input"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPwSuccess(false); setPwError('') }}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleChangePassword}
              disabled={pwLoading}
              style={{ alignSelf: 'flex-start', fontSize: 14 }}
            >
              {pwLoading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card" style={{ padding: 28, borderColor: 'rgba(192,57,43,0.25)' }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--loss)', marginBottom: 8 }}>Danger zone</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Permanently delete all trades from your journal. This cannot be undone.</p>

          {deleteSuccess && (
            <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--profit-dim)', border: '1px solid rgba(61,153,112,0.2)', fontSize: 13, color: 'var(--profit)', marginBottom: 16 }}>
              All trades deleted.
            </div>
          )}
          {deleteError && (
            <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 13, color: 'var(--loss)', marginBottom: 16 }}>
              {deleteError}
            </div>
          )}

          <button
            type="button"
            onClick={handleDeleteAllTrades}
            disabled={deleteLoading || deleteSuccess}
            style={{ fontSize: 14, padding: '9px 18px', borderRadius: 7, border: '1px solid rgba(192,57,43,0.4)', background: 'transparent', color: 'var(--loss)', cursor: deleteLoading || deleteSuccess ? 'default' : 'pointer', opacity: deleteLoading || deleteSuccess ? 0.6 : 1 }}
          >
            {deleteLoading ? 'Deleting…' : 'Delete all trades'}
          </button>
        </div>

      </div>
    </div>
  )
}
