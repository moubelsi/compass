'use client'

import { useState } from 'react'
import { Sparkles, Flame, AlertTriangle, Lightbulb, Shield, RefreshCw } from 'lucide-react'

interface Insight {
  id: string; type: 'strength' | 'warning' | 'opportunity' | 'pattern'
  category: string; headline: string; detail: string; metric?: string; metricLabel?: string
}

const CFG = {
  strength:    { icon: Flame,         color: 'var(--profit)',    bg: 'var(--profit-dim)',    label: 'Strength' },
  warning:     { icon: AlertTriangle, color: '#B45309',          bg: 'rgba(180,83,9,0.08)', label: 'Watch out' },
  opportunity: { icon: Lightbulb,     color: 'var(--accent)',    bg: 'var(--accent-dim)',    label: 'Opportunity' },
  pattern:     { icon: Shield,        color: 'var(--ai-accent)', bg: 'var(--ai-dim)',        label: 'Pattern' },
}

function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false)
  const cfg = CFG[insight.type] ?? CFG.pattern
  const Icon = cfg.icon
  return (
    <button onClick={() => setOpen(!open)} style={{ width: '100%', textAlign: 'left', display: 'block', background: 'var(--bg-surface)', border: `1px solid var(--border-subtle)`, borderLeft: open ? `3px solid ${cfg.color}` : '3px solid transparent', borderRadius: 8, padding: 16, cursor: 'pointer', transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <Icon size={13} style={{ color: cfg.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: cfg.color }}>{cfg.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {insight.category}</span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{insight.headline}</p>
          {open && <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{insight.detail}</p>}
        </div>
        {insight.metric && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: cfg.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{insight.metric}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{insight.metricLabel}</p>
          </div>
        )}
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderLeft: '3px solid transparent', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: 60, height: 10, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 8 }} />
          <div style={{ width: '75%', height: 13, borderRadius: 4, background: 'var(--bg-elevated)' }} />
        </div>
      </div>
    </div>
  )
}

type Tab = 'All' | 'Strength' | 'Watch out' | 'Opportunity' | 'Pattern'
const TABS: Tab[] = ['All', 'Strength', 'Watch out', 'Opportunity', 'Pattern']

export default function CoachPage() {
  const [tab, setTab] = useState<Tab>('All')
  const [insights, setInsights] = useState<Insight[] | null>(null)
  const [tradeCount, setTradeCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/coach', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong.'); return }
      setInsights(json.insights.map((ins: any, i: number) => ({ ...ins, id: String(i) })))
      setTradeCount(json.tradeCount)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const list = insights
    ? (tab === 'All' ? insights : insights.filter(i => (CFG[i.type] ?? CFG.pattern).label === tab))
    : []

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Page header */}
      <div className="m-pad" style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Sparkles size={15} style={{ color: 'var(--ai-accent)' }} />
              <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>AI Coach</h1>
              <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 3, background: 'var(--ai-dim)', color: 'var(--ai-accent)' }}>BETA</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {insights ? `${insights.length} insights from your last ${tradeCount} trades` : 'Personalised coaching from your actual trade data'}
            </p>
          </div>
          {insights && !loading && (
            <button
              onClick={generate}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}
            >
              <RefreshCw size={13} />Regenerate
            </button>
          )}
        </div>
      </div>

      <div className="m-pad" style={{ maxWidth: 680, margin: '0 auto', padding: '28px 48px' }}>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 13, color: 'var(--loss)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[0, 1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>Analysing your trades…</p>
        </div>
      )}

      {/* Generate prompt */}
      {!loading && !insights && (
        <div style={{ borderRadius: 10, padding: 28, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--ai-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Sparkles size={20} style={{ color: 'var(--ai-accent)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Ready to analyse your trades</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>Claude will identify your edge, behavioural patterns, and specific risks based on your real journal data.</p>
          <button onClick={generate} className="btn-primary" style={{ fontSize: 14, padding: '10px 24px' }}>
            Generate insights
          </button>
        </div>
      )}

      {/* Tabs + insights */}
      {!loading && insights && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', background: tab === t ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${tab === t ? 'var(--border-default)' : 'var(--border-subtle)'}` }}>{t}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>No {tab.toLowerCase()} insights</p>
              : list.map(i => <InsightCard key={i.id} insight={i} />)
            }
          </div>
        </>
      )}

      <div style={{ height: 16 }} />
      </div>
    </div>
  )
}
