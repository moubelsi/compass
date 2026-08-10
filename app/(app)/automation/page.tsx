'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Bot, Search, Link2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Strategy {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface VersionSummary {
  strategy_id: string
  status: string
  mode: string
}

function modeBadge(mode: string) {
  if (mode === 'live') return <span className="badge-loss">Live</span>
  if (mode === 'paper') return <span className="badge-profit">Paper</span>
  return <span className="badge-neutral">Off</span>
}

export default function AutomationPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('automation_strategies').select('*').order('created_at', { ascending: false }),
      supabase.from('automation_strategy_versions').select('strategy_id, status, mode'),
    ]).then(([s, v]) => {
      setStrategies(s.data || [])
      setVersions(v.data || [])
      setLoading(false)
    })
  }, [])

  const q = search.toLowerCase()
  const filtered = search
    ? strategies.filter(s => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
    : strategies

  function activeVersionFor(strategyId: string) {
    const vs = versions.filter(v => v.strategy_id === strategyId)
    return vs.find(v => v.status === 'active') ?? vs[0] ?? null
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="m-pad" style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="m-col" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>Automation</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{strategies.length} strateg{strategies.length !== 1 ? 'ies' : 'y'} · TradingView signals → paper trades</p>
          </div>
          <div className="m-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="input"
                placeholder="Search strategies…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 32, width: 200, fontSize: 13 }}
              />
            </div>
            <Link href="/automation/brokers" className="btn-secondary" style={{ fontSize: 14, padding: '10px 16px', textDecoration: 'none' }}>
              <Link2 size={14} />Brokers
            </Link>
            <Link href="/automation/new" className="btn-primary" style={{ fontSize: 14, padding: '10px 20px' }}>
              <Plus size={14} />New strategy
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 48px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : strategies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Bot size={24} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>No strategies yet</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 420, margin: '0 auto 24px' }}>
              Turn a TradingView alert into a paper-traded strategy: define risk rules, get a webhook URL, and every signal shows up as a trade — automatically.
            </p>
            <Link href="/automation/new" className="btn-primary" style={{ fontSize: 14 }}>Create your first strategy</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <Search size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>No strategies match &quot;{search}&quot;</p>
            <button type="button" onClick={() => setSearch('')} style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear search</button>
          </div>
        ) : (
          <div className="m-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {filtered.map(strategy => {
              const active = activeVersionFor(strategy.id)
              const versionCount = versions.filter(v => v.strategy_id === strategy.id).length
              return (
                <Link key={strategy.id} href={`/automation/${strategy.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: '22px 24px', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{strategy.name}</h3>
                      {active && modeBadge(active.mode)}
                    </div>
                    {strategy.description && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {strategy.description}
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 'auto' }}>
                      {versionCount} version{versionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
