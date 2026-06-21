'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MOCK_DATA = [
  { date: 'Nov 1',  value: 10000 },
  { date: 'Nov 7',  value: 10180 },
  { date: 'Nov 14', value: 10390 },
  { date: 'Nov 21', value: 10620 },
  { date: 'Nov 28', value: 10880 },
  { date: 'Dec 5',  value: 11200 },
  { date: 'Dec 12', value: 11480 },
  { date: 'Dec 19', value: 11790 },
  { date: 'Dec 26', value: 12100 },
  { date: 'Jan 2',  value: 12580 },
  { date: 'Jan 7',  value: 12890 },
  { date: 'Jan 14', value: 14284 },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value as number
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 12px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        ${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  )
}

export function EquityCurve({ data = MOCK_DATA }: { data?: typeof MOCK_DATA }) {
  const isUp = data[data.length - 1].value >= data[0].value
  const color = isUp ? 'var(--profit)' : 'var(--loss)'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: -8, left: -20 }}>
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={isUp ? '#3D9970' : '#C0392B'} stopOpacity={0.12} />
            <stop offset="95%" stopColor={isUp ? '#3D9970' : '#C0392B'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="var(--border-subtle)" horizontal vertical={false} />
        <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" tickMargin={8} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={38} domain={['auto','auto']} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-default)', strokeWidth: 1, strokeDasharray: '3 3' }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill="url(#grad)" dot={false} activeDot={{ r: 3.5, fill: color, stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}