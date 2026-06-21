'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

const TRADES = [
  { id: '1', symbol: 'EURUSD', direction: 'LONG'  as const, pnl: 320.5, rr: 2.1,  setup: 'London Breakout',    date: 'Today 09:42' },
  { id: '2', symbol: 'GBPJPY', direction: 'SHORT' as const, pnl: -145,  rr: -0.9, setup: 'Reversal',           date: 'Today 07:15' },
  { id: '3', symbol: 'XAUUSD', direction: 'LONG'  as const, pnl: 890,   rr: 3.4,  setup: 'Trend Continuation', date: 'Yesterday' },
  { id: '4', symbol: 'USDJPY', direction: 'SHORT' as const, pnl: -80,   rr: -0.6, setup: 'Range Break',        date: 'Yesterday' },
  { id: '5', symbol: 'EURUSD', direction: 'SHORT' as const, pnl: 215,   rr: 1.8,  setup: 'London Breakout',    date: 'Dec 12' },
]

export function RecentTrades() {
  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      {TRADES.map((t, i) => {
        const up = t.pnl >= 0
        return (
          <Link key={t.id} href={`/trades/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)]" style={{ borderBottom: i < TRADES.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex' }}>
            <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: up ? 'var(--profit-dim)' : 'var(--loss-dim)', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {up
                ? <ArrowUpRight size={13} style={{ color: 'var(--profit)' }} />
                : <ArrowDownRight size={13} style={{ color: 'var(--loss)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>{t.symbol}</span>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3, background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)' }}>{t.direction}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.setup} · {t.date}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: up ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>{up ? '+' : ''}${Math.abs(t.pnl).toFixed(2)}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{t.rr > 0 ? '+' : ''}{t.rr.toFixed(1)}R</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}