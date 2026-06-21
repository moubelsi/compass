'use client'

export default function SettingsPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Settings</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Manage your account and preferences</p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px' }}>
        <div className="card" style={{ padding: '48px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Coming soon</p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Account settings, profile, and preferences will be available here.
          </p>
        </div>
      </div>
    </div>
  )
}
