'use client'

import { useState, useRef } from 'react'

interface DayData {
  date: string
  pnl: number
  trades: number
}

interface Props {
  data: DayData[]
  currencySymbol?: string
  onDayClick?: (date: string, day: DayData) => void
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CELL = 14
const GAP  = 3

function getColor(pnl: number, maxAbs: number) {
  if (maxAbs === 0) return 'var(--bg-elevated)'
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
  const opacity = 0.18 + intensity * 0.82
  if (pnl > 0) return `rgba(61,153,112,${opacity.toFixed(2)})`
  if (pnl < 0) return `rgba(192,57,43,${opacity.toFixed(2)})`
  return 'var(--bg-elevated)'
}

const TODAY_STR = new Date().toISOString().split('T')[0]

export function CalendarHeatmap({ data, currencySymbol = '$', onDayClick }: Props) {
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

  const [tooltip, setTooltip]     = useState<{ x: number; y: number; day: DayData } | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} style={{ position: 'relative', overflowX: 'auto' }}>
      <div style={{ minWidth: 26 * (CELL + GAP) + 32 }}>
        {/* Month labels */}
        <div style={{ display: 'flex', paddingLeft: 32, height: 20, position: 'relative', marginBottom: 4 }}>
          {monthLabels.map(({ label, col }) => (
            <span key={`${label}-${col}`} style={{
              position: 'absolute', left: 32 + col * (CELL + GAP),
              fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600,
              letterSpacing: '0.02em', whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: GAP }}>
          {/* Day labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: 28, flexShrink: 0 }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} style={{ height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', paddingRight: 5, letterSpacing: '0.01em' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {week.map(date => {
                const day      = map.get(date)
                const isFuture = new Date(date) > today
                const isToday  = date === TODAY_STR
                const isHov    = hoveredDate === date
                const bg       = day ? getColor(day.pnl, maxAbs) : (isToday ? 'var(--bg-overlay)' : 'var(--bg-elevated)')

                const shadow = isHov    ? '0 0 0 1.5px var(--border-strong)'
                             : isToday  ? '0 0 0 1.5px var(--border-default)'
                             : 'none'

                return (
                  <div
                    key={date}
                    style={{
                      width: CELL, height: CELL, borderRadius: 3,
                      background: isFuture ? 'transparent' : bg,
                      cursor: day ? 'pointer' : 'default',
                      boxShadow: isFuture ? 'none' : shadow,
                      transition: 'box-shadow 0.12s, opacity 0.12s',
                      opacity: isHov && day ? 0.85 : 1,
                    }}
                    onMouseEnter={e => {
                      setHoveredDate(date)
                      if (!day) return
                      const rect = (e.target as HTMLElement).getBoundingClientRect()
                      const container = containerRef.current?.getBoundingClientRect()
                      if (container) setTooltip({ x: rect.left - container.left + CELL / 2, y: rect.top - container.top, day })
                    }}
                    onMouseLeave={() => { setHoveredDate(null); setTooltip(null) }}
                    onClick={() => { if (day && onDayClick) onDayClick(date, day) }}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, paddingLeft: 32 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>Less</span>
          {[0.18, 0.42, 0.66, 0.90].map(o => (
            <div key={o} style={{ width: CELL, height: CELL, borderRadius: 3, background: `rgba(61,153,112,${o})` }} />
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>More</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>·</span>
          {[0.18, 0.90].map(o => (
            <div key={o} style={{ width: CELL, height: CELL, borderRadius: 3, background: `rgba(192,57,43,${o})` }} />
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>Loss</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y - 80,
          transform: 'translateX(-50%)',
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 8, padding: '10px 14px', pointerEvents: 'none', zIndex: 10,
          whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: 130,
        }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.01em' }}>
            {new Date(tooltip.day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <p style={{
            fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
            color: tooltip.day.pnl >= 0 ? 'var(--profit)' : 'var(--loss)',
          }}>
            {tooltip.day.pnl >= 0 ? '+' : ''}{currencySymbol}{Math.abs(tooltip.day.pnl).toFixed(2)}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {tooltip.day.trades} trade{tooltip.day.trades !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
