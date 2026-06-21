'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, TrendingUp, Sparkles, Settings, Plus, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trades',    label: 'Trades',    icon: BookOpen },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/coach',     label: 'AI Coach',  icon: Sparkles, ai: true },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

function CompassIcon({ size = 14, color = 'var(--bg-surface)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  )
}

function Sidebar() {
  const path = usePathname()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside style={{
      width: '240px',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100vh',
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo + Sign out */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CompassIcon size={14} color="var(--bg-surface)" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Compass</span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 6,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}
        >
          <LogOut size={15} strokeWidth={1.75} />
        </button>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 12px', flexShrink: 0 }} />

      {/* Nav */}
      <nav style={{
        flex: 1,
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto',
        minHeight: 0,
      }}>
        {NAV.map(({ href, label, icon: Icon, ai }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 6,
              fontSize: 14, fontWeight: active ? 500 : 400,
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: active ? 'var(--bg-elevated)' : 'transparent',
              textDecoration: 'none', transition: 'all 0.1s',
            }}>
              <Icon size={16} strokeWidth={active ? 2 : 1.75} style={{ color: ai && !active ? 'var(--ai-accent)' : 'inherit', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{label}</span>
              {ai && <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3, background: 'var(--ai-dim)', color: 'var(--ai-accent)' }}>AI</span>}
            </Link>
          )
        })}
      </nav>

      {/* Log trade */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <Link href="/trades/new" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 6,
          fontSize: 14, fontWeight: 500,
          color: 'var(--text-secondary)',
          background: 'var(--bg-elevated)',
          textDecoration: 'none',
        }}>
          <Plus size={15} strokeWidth={2} />Log trade
        </Link>
      </div>
    </aside>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ paddingLeft: '240px' }}>
        {children}
      </main>
    </div>
  )
}