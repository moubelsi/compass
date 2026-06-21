'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [loadingUser, setLoadingUser] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteSuccess, setDeleteSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '')
      setLoadingUser(false)
    })
  }, [])

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
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Settings</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Manage your account</p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Account */}
        <div className="card" style={{ padding: 28 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20 }}>Account</p>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Email</label>
            <input
              className="input"
              type="email"
              value={loadingUser ? '' : email}
              disabled
              style={{ opacity: 0.6, cursor: 'default' }}
            />
          </div>
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
