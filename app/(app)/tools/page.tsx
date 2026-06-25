'use client'

import { useState } from 'react'

const ASSET_TYPES = [
  { label: 'Forex',     multiplier: 100000, unit: 'lots',      pip: 0.0001 },
  { label: 'Indices',   multiplier: 1,      unit: 'contracts', pip: 1      },
  { label: 'Gold',      multiplier: 100,    unit: 'lots',      pip: 0.1    },
  { label: 'Crypto',    multiplier: 1,      unit: 'units',     pip: 1      },
]

export default function ToolsPage() {
  const [assetType, setAssetType] = useState('Indices')
  const [accountSize, setAccountSize]   = useState('')
  const [riskPct, setRiskPct]           = useState('1')
  const [entryPrice, setEntryPrice]     = useState('')
  const [stopLoss, setStopLoss]         = useState('')

  const asset    = ASSET_TYPES.find(a => a.label === assetType)!
  const account  = parseFloat(accountSize)
  const risk     = parseFloat(riskPct)
  const entry    = parseFloat(entryPrice)
  const sl       = parseFloat(stopLoss)

  const riskAmount  = !isNaN(account) && !isNaN(risk) ? (account * risk) / 100 : null
  const distance    = !isNaN(entry) && !isNaN(sl) ? Math.abs(entry - sl) : null
  const lotSize     = riskAmount && distance && distance > 0 ? riskAmount / (distance * asset.multiplier) : null
  const posSize     = lotSize ? lotSize * asset.multiplier : null

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>Tools</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Position size calculator</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 48px' }}>
        <div className="card" style={{ padding: 28 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20 }}>Position size calculator</p>

          {/* Asset type */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 8 }}>Asset type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {ASSET_TYPES.map(a => (
                <button key={a.label} type="button" onClick={() => setAssetType(a.label)} style={{ padding: '8px 4px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: assetType === a.label ? 'var(--accent-dim)' : 'var(--bg-elevated)', color: assetType === a.label ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${assetType === a.label ? 'rgba(47,128,237,0.25)' : 'var(--border-subtle)'}` }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Account size ($)</label>
              <input className="input tabular-nums" type="number" step="any" placeholder="10000" value={accountSize} onChange={e => setAccountSize(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>
                Risk per trade
                <span style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 6 }}>{riskPct}%</span>
              </label>
              <input type="range" min={0.1} max={5} step={0.1} value={riskPct} onChange={e => setRiskPct(e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-disabled)', marginTop: 2 }}>
                <span>0.1%</span><span>5%</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Entry price</label>
              <input className="input tabular-nums" type="number" step="any" placeholder="1.0850" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Stop loss</label>
              <input className="input tabular-nums" type="number" step="any" placeholder="1.0800" value={stopLoss} onChange={e => setStopLoss(e.target.value)} />
            </div>
          </div>

          {/* Results */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { label: 'Risk amount', value: riskAmount != null ? `$${riskAmount.toFixed(2)}` : '—', color: riskAmount != null ? 'var(--loss)' : undefined },
                { label: 'Distance', value: distance != null ? distance.toFixed(distance < 1 ? 5 : 2) : '—', color: undefined },
                { label: `Size (${asset.unit})`, value: lotSize != null ? lotSize.toFixed(2) : '—', color: lotSize != null ? 'var(--accent)' : undefined },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '16px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>{label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</p>
                </div>
              ))}
            </div>

            {lotSize != null && (
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(47,128,237,0.15)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Trade <strong style={{ color: 'var(--text-primary)' }}>{lotSize.toFixed(2)} {asset.unit}</strong> to risk <strong style={{ color: 'var(--loss)' }}>${riskAmount?.toFixed(2)}</strong> ({riskPct}% of ${account?.toLocaleString()})
                  {distance != null && ` with a ${distance.toFixed(distance < 1 ? 5 : 2)} point stop.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
