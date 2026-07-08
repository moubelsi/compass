'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, BookOpen, TrendingUp, Sparkles, Settings,
  Plus, LogOut, Moon, Sun, BookMarked, PenLine, Calculator, BookText,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Groups of nav items — rendered with a divider between each group
const NAV_GROUPS = [
  [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ],
  [
    { href: '/journal',  label: 'Journal',  icon: PenLine },
    { href: '/notebook', label: 'Notebook', icon: BookText },
  ],
  [
    { href: '/trades',    label: 'Trades',    icon: BookOpen },
    { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  ],
  [
    { href: '/playbook', label: 'Playbook', icon: BookMarked },
  ],
  [
    { href: '/coach', label: 'AI Coach', icon: Sparkles, ai: true },
    { href: '/tools', label: 'Tools',     icon: Calculator },
  ],
  [
    { href: '/settings', label: 'Settings', icon: Settings },
  ],
]

const ALL_NAV = NAV_GROUPS.flat()
const MOBILE_NAV = ['/dashboard', '/journal', '/notebook', '/trades', '/analytics']
  .map(href => ALL_NAV.find(n => n.href === href)!)

function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])
  function toggle() {
    setDark(d => {
      const next = !d
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }
  return { dark, toggle }
}

function Sidebar({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const path = usePathname()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 6,
    background: 'transparent', border: 'none',
    cursor: 'pointer', color: 'var(--text-muted)',
    transition: 'background 0.1s, color 0.1s',
  }

  return (
    <aside className="desktop-sidebar" style={{
      width: '240px',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      position: 'fixed', left: 0, top: 0,
      height: '100vh', zIndex: 40,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Compass" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, objectFit: 'cover' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Compass</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" onClick={onToggleDark} title={dark ? 'Light mode' : 'Dark mode'} style={iconBtn}>
            {dark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
          </button>
          <button type="button" onClick={handleSignOut} title="Sign out" style={iconBtn}>
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 12px', flexShrink: 0 }} />

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {group.map(({ href, label, icon: Icon, ai }) => {
                const active = path === href || path.startsWith(href + '/')
                return (
                  <Link key={href} href={href} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 6,
                    fontSize: 14, fontWeight: active ? 500 : 400,
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active ? 'var(--bg-elevated)' : 'transparent',
                    textDecoration: 'none', transition: 'all 0.1s',
                  }}>
                    <Icon size={16} strokeWidth={active ? 2 : 1.75}
                      style={{ color: (ai && !active) ? 'var(--ai-accent)' : 'inherit', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {ai && (
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3, background: 'var(--ai-dim)', color: 'var(--ai-accent)' }}>AI</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Log trade */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
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

function MobileHeader({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  return (
    <div className="mobile-header" style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 52, background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="/logo.png" alt="Compass" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Compass</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={onToggleDark} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          {dark ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
        </button>
        <Link href="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 6, color: 'var(--text-muted)' }}>
          <Settings size={17} strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  )
}

function MobileBottomNav() {
  const path = usePathname()
  return (
    <nav className="mobile-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 64, background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex', zIndex: 40, padding: '0 4px',
    }}>
      {MOBILE_NAV.map(({ href, label, icon: Icon, ai }) => {
        const active = path === href || path.startsWith(href + '/')
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            textDecoration: 'none', padding: '8px 4px',
            color: active ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            <Icon size={20} strokeWidth={active ? 2 : 1.75}
              style={{ color: (ai && !active) ? 'var(--ai-accent)' : undefined }} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Background broker sync: at most once per 5 minutes (tracked in
 * localStorage across tabs), fire-and-forget, fully silent — imported
 * trades simply appear on the next data fetch. Not-connected users cost
 * one cheap 404 per interval.
 *
 * Module-level guard instead of effect cleanup: StrictMode's dev
 * mount/unmount/remount would otherwise cancel the first run and
 * throttle-skip the second, so no sync would ever fire in dev.
 */
let autoSyncStarted = false

function useBrokerAutoSync() {
  useEffect(() => {
    if (autoSyncStarted) return
    const KEY = 'broker_last_auto_sync'
    const last = Number(localStorage.getItem(KEY) || 0)
    if (Date.now() - last < 5 * 60 * 1000) return
    autoSyncStarted = true
    localStorage.setItem(KEY, String(Date.now()))

    ;(async () => {
      try {
        // Resumable batches: keep requesting until the API reports done
        for (let i = 0; i < 20; i++) {
          const res = await fetch('/api/ctrader/sync', { method: 'POST' })
          if (!res.ok) return
          const data = await res.json()
          if (data.done) return
        }
      } catch { /* silent by design — the manual Sync Now button surfaces errors */ }
    })()
  }, [])
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { dark, toggle } = useDarkMode()
  useBrokerAutoSync()
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Sidebar dark={dark} onToggleDark={toggle} />
      <MobileHeader dark={dark} onToggleDark={toggle} />
      <MobileBottomNav />
      <main style={{ paddingLeft: '240px' }}>
        {children}
      </main>
    </div>
  )
}
