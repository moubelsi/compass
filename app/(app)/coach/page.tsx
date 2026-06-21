'use client'

import { useState } from 'react'
import { Sparkles, Flame, AlertTriangle, Lightbulb, Shield } from 'lucide-react'

interface Insight {
  id: string; type: 'strength'|'warning'|'opportunity'|'pattern'
  category: string; headline: string; detail: string; metric?: string; metricLabel?: string
}

const INSIGHTS: Insight[] = [
  { id:'1', type:'strength',    category:'Symbol',    headline:'EURUSD is your strongest pair',          detail:'Win rate of 71% on EURUSD vs 62% overall. This pair consistently generates your best R:R trades.',                      metric:'71%',  metricLabel:'Win rate' },
  { id:'2', type:'warning',     category:'Time',      headline:'Performance drops after 3 PM',           detail:'You lose 68% of trades taken after 3 PM. Fatigue or thin market conditions may be a factor. Consider a hard stop.',    metric:'68%',  metricLabel:'Loss rate after 3PM' },
  { id:'3', type:'strength',    category:'Setup',     headline:'London Breakouts are your edge',         detail:'67% win rate and 1.9 avg R:R across 34 London Breakout trades. This is the core of your system.',                      metric:'1.9R', metricLabel:'Avg R:R' },
  { id:'4', type:'warning',     category:'Risk',      headline:'Stop loss moves are costly',             detail:'On 12% of losing trades you moved your stop. Those averaged −2.1R vs −0.9R when stops were respected.',                metric:'−2.1R',metricLabel:'Avg when SL moved' },
  { id:'5', type:'opportunity', category:'Frequency', headline:'You overtrade on Fridays',               detail:'40% more trades on Fridays, but win rate drops to 41%. Restricting Fridays to A+ setups only could help significantly.', metric:'41%',  metricLabel:'Friday win rate' },
  { id:'6', type:'pattern',     category:'Behavior',  headline:'Third trade after a loss underperforms', detail:'After two consecutive losses, your next trade wins only 31% of the time. A cooldown rule could protect capital.',          metric:'31%',  metricLabel:'Win rate after 2 losses' },
]

const CFG = {
  strength:    { icon: Flame,         color: 'var(--profit)',    bg: 'var(--profit-dim)',    label: 'Strength' },
  warning:     { icon: AlertTriangle, color: '#B45309',          bg: 'rgba(180,83,9,0.08)', label: 'Watch out' },
  opportunity: { icon: Lightbulb,     color: 'var(--accent)',    bg: 'var(--accent-dim)',    label: 'Opportunity' },
  pattern:     { icon: Shield,        color: 'var(--ai-accent)', bg: 'var(--ai-dim)',        label: 'Pattern' },
}

function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false)
  const cfg = CFG[insight.type]
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

type Tab = 'All'|'Strength'|'Watch out'|'Opportunity'|'Pattern'
const TABS: Tab[] = ['All','Strength','Watch out','Opportunity','Pattern']

export default function CoachPage() {
  const [tab, setTab] = useState<Tab>('All')
  const list = tab === 'All' ? INSIGHTS : INSIGHTS.filter(i => CFG[i.type].label === tab)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Sparkles size={16} style={{ color: 'var(--ai-accent)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>AI Coach</h1>
          <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 3, background: 'var(--ai-dim)', color: 'var(--ai-accent)' }}>BETA</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{INSIGHTS.length} insights from your last 89 trades</p>
      </div>

      <div style={{ borderRadius: 8, padding: 14, background: 'var(--bg-elevated)', borderLeft: '3px solid var(--ai-accent)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Your biggest edge:</span> London Breakouts on EURUSD before 12 PM.{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Your biggest leak:</span> Trading after 3 PM and moving stop losses.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', background: tab === t ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${tab === t ? 'var(--border-default)' : 'var(--border-subtle)'}` }}>{t}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(i => <InsightCard key={i.id} insight={i} />)}
      </div>

      <div style={{ borderRadius: 8, padding: 16, background: 'var(--bg-elevated)', textAlign: 'center', marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>More insights coming</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pattern recognition, session analysis, emotional trading detection.</p>
      </div>
      <div style={{ height: 16 }} />
    </div>
  )
}