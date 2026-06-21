'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  date: string
  value: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value as number
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 12px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {v >= 0 ? '+' : ''}{v.toFixed(2)}%
      </p>
    </div>
  )
}

function formatAxis(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

export function EquityCurve({ data }: { data: DataPoint[] }) {
  if (!data.length) return null
  const isUp = data[data.length - 1].value >= 0
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
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatAxis} width={44} domain={['auto', 'auto']} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-default)', strokeWidth: 1, strokeDasharray: '3 3' }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill="url(#grad)" dot={false} activeDot={{ r: 3.5, fill: color, stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
