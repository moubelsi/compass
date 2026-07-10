'use client'

import { useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency } from '@/lib/utils'

const ASSET_TYPES = [
  { label: 'Forex',     multiplier: 100000, unit: 'lots',      pip: 0.0001 },
  { label: 'Indices',   multiplier: 1,      unit: 'contracts', pip: 1      },
  { label: 'Gold',      multiplier: 100,    unit: 'lots',      pip: 0.1    },
  { label: 'Crypto',    multiplier: 1,      unit: 'units',     pip: 1      },
]

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }

// ─── Position size ────────────────────────────────────────────────────────────

function PositionSizeCalculator({ symbol }: { symbol: string }) {
  const [assetType, setAssetType]     = useState('Indices')
  const [accountSize, setAccountSize] = useState('')
  const [riskPct, setRiskPct]         = useState('1')
  const [entryPrice, setEntryPrice]   = useState('')
  const [stopLoss, setStopLoss]       = useState('')

  const asset    = ASSET_TYPES.find(a => a.label === assetType)!
  const account  = parseFloat(accountSize)
  const risk     = parseFloat(riskPct)
  const entry    = parseFloat(entryPrice)
  const sl       = parseFloat(stopLoss)

  const riskAmount  = !isNaN(account) && !isNaN(risk) ? (account * risk) / 100 : null
  const distance    = !isNaN(entry) && !isNaN(sl) ? Math.abs(entry - sl) : null
  const lotSize     = riskAmount && distance && distance > 0 ? riskAmount / (distance * asset.multiplier) : null

  return (
    <div className="card" style={{ padding: 28 }}>
      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20 }}>Position size calculator</p>

      {/* Asset type */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Asset type</label>
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
          <label style={labelStyle}>Account size ({symbol})</label>
          <input className="input tabular-nums" type="number" step="any" placeholder="10000" value={accountSize} onChange={e => setAccountSize(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>
            Risk per trade
            <span style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 6 }}>{riskPct}%</span>
          </label>
          <input type="range" min={0.1} max={5} step={0.1} value={riskPct} onChange={e => setRiskPct(e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 8 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-disabled)', marginTop: 2 }}>
            <span>0.1%</span><span>5%</span>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Entry price</label>
          <input className="input tabular-nums" type="number" step="any" placeholder="1.0850" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Stop loss</label>
          <input className="input tabular-nums" type="number" step="any" placeholder="1.0800" value={stopLoss} onChange={e => setStopLoss(e.target.value)} />
        </div>
      </div>

      {/* Results */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { label: 'Risk amount', value: riskAmount != null ? `${symbol}${riskAmount.toFixed(2)}` : '—', color: riskAmount != null ? 'var(--loss)' : undefined },
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
              Trade <strong style={{ color: 'var(--text-primary)' }}>{lotSize.toFixed(2)} {asset.unit}</strong> to risk <strong style={{ color: 'var(--loss)' }}>{symbol}{riskAmount?.toFixed(2)}</strong> ({riskPct}% of {symbol}{account?.toLocaleString()})
              {distance != null && ` with a ${distance.toFixed(distance < 1 ? 5 : 2)} point stop.`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Compound interest ────────────────────────────────────────────────────────

const COMPOUND_FREQS = [
  { label: 'Yearly (1/yr)',    perYear: 1 },
  { label: 'Quarterly (4/yr)', perYear: 4 },
  { label: 'Monthly (12/yr)',  perYear: 12 },
  { label: 'Daily (365/yr)',   perYear: 365 },
]

function axisMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

function CompoundTooltip({ active, payload, label, symbol }: any) {
  if (!active || !payload?.length) return null
  const value       = payload.find((p: any) => p.dataKey === 'value')?.value as number | undefined
  const contributed = payload.find((p: any) => p.dataKey === 'contributed')?.value as number | undefined
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 14px', minWidth: 150 }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Year {String(label).replace('Y', '')}</p>
      {value !== undefined && (
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--profit)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(value, false, symbol)}</p>
      )}
      {contributed !== undefined && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>Contributed {formatCurrency(contributed, false, symbol)}</p>
      )}
    </div>
  )
}

function CompoundInterestCalculator({ symbol }: { symbol: string }) {
  const [initial,     setInitial]     = useState('5000')
  const [rate,        setRate]        = useState('10')
  const [ratePeriod,  setRatePeriod]  = useState<'Annual' | 'Monthly'>('Annual')
  const [freq,        setFreq]        = useState(12)
  const [years,       setYears]       = useState('10')
  const [inflation,   setInflation]   = useState('')
  const [deposit,     setDeposit]     = useState('')
  const [depositFreq, setDepositFreq] = useState<'Monthly' | 'Weekly' | 'Yearly'>('Monthly')
  const [depositInc,  setDepositInc]  = useState('')

  const p      = Math.max(parseFloat(initial) || 0, 0)
  const r      = (parseFloat(rate) || 0) / 100
  const yrs    = Math.min(Math.max(parseFloat(years) || 0, 0), 100)
  const infl   = (parseFloat(inflation) || 0) / 100
  const dep    = Math.max(parseFloat(deposit) || 0, 0)
  const depIncPct = (parseFloat(depositInc) || 0) / 100

  // Nominal yearly rate, converted to an equivalent monthly growth factor so
  // any compounding frequency can be simulated on a monthly grid:
  // (1 + g)^12 === (1 + r/f)^f
  const rNominal  = ratePeriod === 'Annual' ? r : r * 12
  const gMonth    = Math.pow(1 + rNominal / freq, freq / 12) - 1
  const effYearly = (Math.pow(1 + gMonth, 12) - 1) * 100

  const months = Math.round(yrs * 12)
  let balance = p
  let contributed = p
  let monthlyDep = depositFreq === 'Monthly' ? dep : depositFreq === 'Weekly' ? (dep * 52) / 12 : 0
  let yearlyDep  = depositFreq === 'Yearly' ? dep : 0
  const chart: Array<{ year: string; contributed: number; value: number }> = [{ year: 'Y0', contributed: p, value: p }]
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + gMonth) + monthlyDep
    contributed += monthlyDep
    if (m % 12 === 0) {
      balance += yearlyDep
      contributed += yearlyDep
      chart.push({ year: `Y${m / 12}`, contributed: Number(contributed.toFixed(2)), value: Number(balance.toFixed(2)) })
      monthlyDep *= 1 + depIncPct
      yearlyDep  *= 1 + depIncPct
    }
  }
  if (months > 0 && months % 12 !== 0) {
    chart.push({ year: `Y${(months / 12).toFixed(1)}`, contributed: Number(contributed.toFixed(2)), value: Number(balance.toFixed(2)) })
  }

  const interest  = balance - contributed
  const ror       = contributed > 0 ? (interest / contributed) * 100 : 0
  const realValue = infl > 0 && yrs > 0 ? balance / Math.pow(1 + infl, yrs) : null
  const hasResult = months > 0 && (p > 0 || dep > 0)

  const tiles = [
    { label: 'Future value',       value: hasResult ? formatCurrency(balance, false, symbol) : '—', color: hasResult ? 'var(--profit)' : undefined },
    { label: 'Total contributed',  value: hasResult ? formatCurrency(contributed, false, symbol) : '—' },
    { label: 'Interest earned',    value: hasResult ? formatCurrency(interest, false, symbol) : '—', color: hasResult ? 'var(--profit)' : undefined },
    { label: 'Compounded yearly',  value: hasResult ? `${effYearly.toFixed(2)}%` : '—' },
    { label: 'All-time return',    value: hasResult ? `${ror.toFixed(1)}%` : '—', color: hasResult ? 'var(--profit)' : undefined },
    { label: 'After inflation',    value: realValue != null ? formatCurrency(realValue, false, symbol) : '—' },
  ]

  return (
    <div className="card" style={{ padding: 28 }}>
      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20 }}>Compound interest calculator</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <div>
          <label style={labelStyle}>Initial investment ({symbol})</label>
          <input className="input tabular-nums" type="number" step="any" min="0" placeholder="5000" value={initial} onChange={e => setInitial(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Duration (years)</label>
          <input className="input tabular-nums" type="number" step="any" min="0" max="100" placeholder="10" value={years} onChange={e => setYears(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Interest rate (%)</label>
          <input className="input tabular-nums" type="number" step="any" placeholder="10" value={rate} onChange={e => setRate(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Rate period</label>
          <select className="input" value={ratePeriod} onChange={e => setRatePeriod(e.target.value as 'Annual' | 'Monthly')}>
            <option value="Annual">Annual</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Compound frequency</label>
          <select className="input" value={freq} onChange={e => setFreq(Number(e.target.value))}>
            {COMPOUND_FREQS.map(f => <option key={f.perYear} value={f.perYear}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Yearly inflation rate (%)</label>
          <input className="input tabular-nums" type="number" step="any" min="0" placeholder="0" value={inflation} onChange={e => setInflation(e.target.value)} />
        </div>
      </div>

      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '4px 0 12px' }}>
        Regular contributions <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Deposit amount ({symbol})</label>
          <input className="input tabular-nums" type="number" step="any" min="0" placeholder="0" value={deposit} onChange={e => setDeposit(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Deposit frequency</label>
          <select className="input" value={depositFreq} onChange={e => setDepositFreq(e.target.value as 'Monthly' | 'Weekly' | 'Yearly')}>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="Yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Annual increase (%)</label>
          <input className="input tabular-nums" type="number" step="any" min="0" placeholder="0" value={depositInc} onChange={e => setDepositInc(e.target.value)} />
        </div>
      </div>

      {/* Results */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: hasResult ? 24 : 0 }}>
          {tiles.map(({ label, value, color }) => (
            <div key={label} style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</p>
            </div>
          ))}
        </div>

        {hasResult && chart.length > 1 && (
          <div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <defs>
                    <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#3D9970" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#3D9970" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="var(--border-subtle)" horizontal vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" tickMargin={8} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={axisMoney} width={52} domain={[0, 'auto']} />
                  <Tooltip content={<CompoundTooltip symbol={symbol} />} cursor={{ stroke: 'var(--border-default)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Area type="monotone" dataKey="value" stroke="var(--profit)" strokeWidth={2} fill="url(#ciGrad)" dot={false} activeDot={{ r: 4, fill: 'var(--profit)', stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="contributed" stroke="var(--accent)" strokeWidth={1.5} dot={false} activeDot={{ r: 3.5, fill: 'var(--accent)', stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 2, background: 'var(--profit)', display: 'inline-block', borderRadius: 1 }} /> Future value
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }} /> Total contributed
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const { symbol } = useCurrency()

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>Tools</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Position size & compound interest calculators</p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PositionSizeCalculator symbol={symbol} />
        <CompoundInterestCalculator symbol={symbol} />
      </div>
    </div>
  )
}
