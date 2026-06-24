'use client'

import { useState, useRef } from 'react'

interface DayData {
  date: string
  pnl: number
  trades: number
}

interface Props {
  data: DayData[]
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CELL = 13
const GAP  = 3

function getColor(pnl: number, maxAbs: number) {
  if (maxAbs === 0) return 'var(--bg-elevated)'
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
  const opacity = 0.18 + intensity * 0.82
  if (pnl > 0) return `rgba(61,153,112,${opacity.toFixed(2)})`
  if (pnl < 0) return `rgba(192,57,43,${opacity.toFixed(2)})`
  return 'var(--bg-elevated)'
}

export function CalendarHeatmap({ data }: Props) {
  const map = new Map<string, DayData>()
  data.forEach(d => map.set(d.date, d))

  const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 0.01)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay()
  const daysToMon = dow === 0 ? 6 : dow - 1
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - daysToMon)

  const startMonday = new Date(thisMonday)
  startMonday.setDate(thisMonday.getDate() - 25 * 7)

  const weeks: string[][] = []
  for (let w = 0; w < 26; w++) {
    const week: string[] = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(startMonday)
      dt.setDate(startMonday.getDate() + w * 7 + d)
      week.push(dt.toISOString().split('T')[0])
    }
    weeks.push(week)
  }

  const monthLabels: { label: string; col: number }[] = []
  weeks.forEach((week, i) => {
    const d = new Date(week[0])
    if (i === 0 || new Date(weeks[i - 1][0]).getMonth() !== d.getMonth()) {
      monthLabels.push({ label: MONTHS[d.getMonth()], col: i })
    }
  })

  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: DayData } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} style={{ position: 'relative', overflowX: 'auto' }}>
      <div style={{ minWidth: 26 * (CELL + GAP) + 32 }}>
        {/* Month labels */}
        <div style={{ display: 'flex', paddingLeft: 32, height: 18, position: 'relative', marginBottom: 2 }}>
          {monthLabels.map(({ label, col }) => (
            <span key={`${label}-${col}`} style={{ position: 'absolute', left: 32 + col * (CELL + GAP), fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {label}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: GAP }}>
          {/* Day labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: 28, flexShrink: 0 }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} style={{ height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', paddingRight: 4 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {week.map(date => {
                const day = map.get(date)
                const isFuture = new Date(date) > today
                const bg = day ? getColor(day.pnl, maxAbs) : 'var(--bg-elevated)'
                return (
                  <div
                    key={date}
                    style={{ width: CELL, height: CELL, borderRadius: 2, background: isFuture ? 'transparent' : bg, cursor: day ? 'pointer' : 'default', transition: 'opacity 0.1s' }}
                    onMouseEnter={e => {
                      if (!day) return
                      const rect = (e.target as HTMLElement).getBoundingClientRect()
                      const container = containerRef.current?.getBoundingClientRect()
                      if (container) setTooltip({ x: rect.left - container.left + CELL / 2, y: rect.top - container.top, day })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingLeft: 32 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Less</span>
          {[0.15, 0.4, 0.65, 0.9].map(o => (
            <div key={o} style={{ width: CELL, height: CELL, borderRadius: 2, background: `rgba(61,153,112,${o})` }} />
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>More</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'absolute', left: tooltip.x, top: tooltip.y - 72, transform: 'translateX(-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{new Date(tooltip.day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: tooltip.day.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
            {tooltip.day.pnl >= 0 ? '+' : ''}${Math.abs(tooltip.day.pnl).toFixed(2)}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tooltip.day.trades} trade{tooltip.day.trades !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}
