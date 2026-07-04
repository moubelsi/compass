'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface DataPoint {
  date: string
  value: number
  pnl?: number
}

function CustomTooltip({ active, payload, label, currencySymbol = '$' }: any) {
  if (!active || !payload?.length) return null
  const v   = payload[0]?.value as number
  const pnl = payload[0]?.payload?.pnl as number | undefined
  const up  = v >= 0
  const color = up ? 'var(--profit)' : 'var(--loss)'
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 14px', minWidth: 110 }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {up ? '+' : ''}{v.toFixed(2)}%
      </p>
      {pnl !== undefined && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
          {pnl >= 0 ? '+' : ''}{currencySymbol}{Math.abs(pnl).toFixed(2)}
        </p>
      )}
    </div>
  )
}

function formatAxis(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

export function EquityCurve({ data, currencySymbol = '$' }: { data: DataPoint[]; currencySymbol?: string }) {
  if (!data.length) return null
  const isUp = data[data.length - 1].value >= 0
  const color = isUp ? 'var(--profit)' : 'var(--loss)'
  const minVal = data.reduce((m, d) => Math.min(m, d.value), 0)
  const maxVal = data.reduce((m, d) => Math.max(m, d.value), 0)
  const yMin = Math.floor(minVal / 10) * 10
  const yMax = Math.ceil(maxVal / 10) * 10
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={isUp ? '#3D9970' : '#C0392B'} stopOpacity={0.25} />
            <stop offset="100%" stopColor={isUp ? '#3D9970' : '#C0392B'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="var(--border-subtle)" horizontal vertical={false} />
        <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1} />
        <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" tickMargin={8} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatAxis} width={58} domain={[yMin, yMax]} />
        <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} cursor={{ stroke: 'var(--border-default)', strokeWidth: 1, strokeDasharray: '3 3' }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: color, stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
