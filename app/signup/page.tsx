'use client'

import { useState } from 'react'
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

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSignup() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setDone(true)
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
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Check your email</p>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                We sent a confirmation link to <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong>.<br />
                Click it to activate your account.
              </p>
              <Link href="/login" style={{ display: 'inline-block', marginTop: '24px', fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                Back to sign in →
              </Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>Create account</h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Start building your trading journal</p>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: '13px', color: 'var(--loss)', marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <form onSubmit={e => { e.preventDefault(); handleSignup() }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Password</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '14px', marginTop: '8px' }}
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
