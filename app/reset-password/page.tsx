'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function CompassIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--bg-surface)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  )
}

/**
 * Two modes on one page:
 *  - request: enter your e-mail → Supabase sends a recovery link
 *  - update:  arriving from that link (recovery session) → set a new password
 */
export default function ResetPasswordPage() {
  const [mode, setMode]         = useState<'request' | 'update'>('request')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [sent, setSent]         = useState(false)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    // Arriving from the recovery e-mail the client exchanges the URL code for
    // a session and fires PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setMode('update')
    })
    // Covers the case where the exchange finished before we subscribed
    if (new URLSearchParams(window.location.search).has('code')) {
      supabase.auth.getSession().then(({ data }) => { if (data.session) setMode('update') })
    }
    return () => subscription.unsubscribe()
  }, [])

  async function requestReset() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) setError(err.message)
    else setSent(true)
    setLoading(false)
  }

  async function updatePassword() {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 1500)
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', justifyContent: 'center' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CompassIcon />
          </div>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Compass</span>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            {mode === 'request' ? 'Reset your password' : 'Choose a new password'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            {mode === 'request'
              ? 'Enter your e-mail and we will send you a reset link'
              : 'Set a new password for your account'}
          </p>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: '13px', color: 'var(--loss)', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {mode === 'request' ? (
            sent ? (
              <div style={{ padding: '12px 14px', borderRadius: '6px', background: 'var(--profit-dim)', border: '1px solid rgba(61,153,112,0.2)', fontSize: '13px', color: 'var(--profit)', lineHeight: 1.6 }}>
                Check your inbox — if an account exists for {email || 'that address'}, a reset link is on its way. It can take a few minutes.
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); requestReset() }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Email</label>
                  <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" disabled={loading || !email} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '14px', marginTop: '8px' }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )
          ) : done ? (
            <div style={{ padding: '12px 14px', borderRadius: '6px', background: 'var(--profit-dim)', border: '1px solid rgba(61,153,112,0.2)', fontSize: '13px', color: 'var(--profit)' }}>
              Password updated — taking you to your dashboard…
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); updatePassword() }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>New password</label>
                <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Confirm password</label>
                <input className="input" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '14px', marginTop: '8px' }}>
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          )}

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
            <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>← Back to sign in</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
