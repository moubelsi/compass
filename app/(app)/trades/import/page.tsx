'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ParsedTrade {
  symbol: string
  direction: 'LONG' | 'SHORT'
  entry_price: number
  exit_price: number
  pnl: number | null
  trade_date: string | null
}

function parseCSV(text: string): ParsedTrade[] {
  const t = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('File appears empty — needs at least a header and one trade row.')

  // Detect separator from the first line that has more than one cell
  const firstMultiCell = lines.find(l => l.includes(';') || l.includes(',')) ?? lines[0]
  const sep = (firstMultiCell.match(/;/g) || []).length >= (firstMultiCell.match(/,/g) || []).length ? ';' : ','

  // Strip surrounding quotes and trailing parenthetical suffixes like "(UTC+2)"
  const clean = (s: string) => s.trim().replace(/^["']|["']$/g, '').replace(/\s*\(.*?\)\s*$/, '').toLowerCase().trim()

  // FIX 1: scan all lines for the header row — skip metadata rows cTrader puts at the top
  let headerRowIdx = -1
  let cols: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const candidate = lines[i].split(sep).map(clean)
    if (candidate.includes('symbol')) { headerRowIdx = i; cols = candidate; break }
  }

  if (headerRowIdx < 0) throw new Error('Cannot find a header row with a "Symbol" column. Is this a cTrader CSV export?')

  const find = (...names: string[]) => names.reduce((f, n) => f >= 0 ? f : cols.indexOf(n), -1)

  const symbolIdx     = find('symbol')
  // FIX 2: add "opening direction" alias
  const dirIdx        = find('opening direction', 'direction', 'side', 'type')
  const openPriceIdx  = find('open price', 'entry price', 'open_price', 'entry_price')
  // FIX 3: add "closing price" alias
  const closePriceIdx = find('closing price', 'close price', 'exit price', 'close_price', 'exit_price')
  const netProfitIdx  = find('net profit', 'net_profit')
  // FIX 5: "net eur", "net usd", "net gbp" etc. matched by startsWith below
  const grossProfitIdx= find('gross profit', 'gross_profit', 'profit', 'pnl', 'p/l')
  // FIX 4: add "closing time" alias (parenthetical suffix already stripped by clean())
  const closeTimeIdx  = find('closing time', 'close time', 'exit time', 'close_time', 'exit_time', 'close date')
  const openTimeIdx   = find('open time', 'opening time', 'entry time', 'open_time', 'entry_time')

  // FIX 5: fallback — find any column starting with "net " (covers "net eur", "net usd", "net gbp", …)
  const netCurrencyIdx = netProfitIdx >= 0 ? netProfitIdx : cols.findIndex(c => c.startsWith('net '))
  const profitIdx = netCurrencyIdx >= 0 ? netCurrencyIdx : grossProfitIdx

  if (symbolIdx < 0)     throw new Error('Cannot find a "Symbol" column. Is this a cTrader CSV export?')
  if (dirIdx < 0)        throw new Error('Cannot find a "Direction" or "Opening Direction" column.')
  if (openPriceIdx < 0)  throw new Error('Cannot find an "Entry Price" or "Open Price" column.')
  if (closePriceIdx < 0) throw new Error('Cannot find a "Closing Price" or "Close Price" column.')

  const trades: ParsedTrade[] = []

  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cells.length < 3) continue

    const symbol = cells[symbolIdx]?.toUpperCase()
    if (!symbol) continue

    const rawDir = (cells[dirIdx] ?? '').toLowerCase()
    const direction: 'LONG' | 'SHORT' | null = rawDir.includes('buy') ? 'LONG' : rawDir.includes('sell') ? 'SHORT' : null
    if (!direction) continue

    const entry_price = parseFloat(cells[openPriceIdx])
    const exit_price  = parseFloat(cells[closePriceIdx])
    if (isNaN(entry_price) || isNaN(exit_price)) continue

    const pnlRaw = profitIdx >= 0 ? parseFloat(cells[profitIdx]) : NaN
    const pnl = isNaN(pnlRaw) ? null : pnlRaw

    const rawDate = closeTimeIdx >= 0 ? cells[closeTimeIdx] : openTimeIdx >= 0 ? cells[openTimeIdx] : null
    let trade_date: string | null = null
    if (rawDate) {
      const dateOnly = rawDate.split(' ')[0].split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        trade_date = dateOnly
      } else {
        const d = new Date(rawDate)
        if (!isNaN(d.getTime())) trade_date = d.toISOString().split('T')[0]
      }
    }

    trades.push({ symbol, direction, entry_price, exit_price, pnl, trade_date })
  }

  if (trades.length === 0) throw new Error('No valid trades found in the file. Check that you exported "Closed Positions" and not Deals or Orders.')
  return trades
}

export default function ImportPage() {
  const [step, setStep]         = useState<'upload' | 'preview' | 'importing'>('upload')
  const [trades, setTrades]     = useState<ParsedTrade[]>([])
  const [error, setError]       = useState('')
  const [filename, setFilename] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Please upload a .csv file.'); return }
    setFilename(file.name)
    setError('')
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const parsed = parseCSV(e.target?.result as string)
        setTrades(parsed)
        setStep('preview')
      } catch (err: any) {
        setError(err.message)
      }
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    setStep('importing')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired. Please sign in again.'); setStep('preview'); return }

    const rows = trades.map(t => ({
      user_id:      user.id,
      symbol:       t.symbol,
      direction:    t.direction,
      entry_price:  t.entry_price,
      exit_price:   t.exit_price,
      pnl:          t.pnl,
      trade_date:   t.trade_date,
      followed_plan: false,
    }))

    const { error: insertError } = await supabase.from('trades').insert(rows)
    if (insertError) { setError(insertError.message); setStep('preview'); return }

    router.push('/trades')
  }

  const previewRows = trades.slice(0, 50)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Link href="/trades" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 16 }}>
            <ArrowLeft size={13} />Trades
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Import trades</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Upload a cTrader closed positions CSV to bulk import your history.</p>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)' }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div
            className="card"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{ padding: '72px 48px', textAlign: 'center', cursor: 'pointer', border: '1.5px dashed var(--border-default)' }}
          >
            <div style={{ margin: '0 auto 16px', width: 48, height: 48, borderRadius: 12, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={22} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Drop your CSV here</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>or click to browse</p>
            <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        )}

        {(step === 'preview' || step === 'importing') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{filename}</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{trades.length} trade{trades.length !== 1 ? 's' : ''} ready to import</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setStep('upload'); setTrades([]); setFilename(''); setError('') }}
                  disabled={step === 'importing'}
                  style={{ fontSize: 14 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleImport}
                  disabled={step === 'importing'}
                  style={{ fontSize: 14 }}
                >
                  {step === 'importing' ? 'Importing…' : `Import ${trades.length} trade${trades.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>

            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.2fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                {['Symbol', 'Direction', 'Date', 'Entry', 'Exit', 'P&L'].map(h => (
                  <p key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{h}</p>
                ))}
              </div>

              {previewRows.map((t, i) => (
                <div
                  key={i}
                  style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.2fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: i < previewRows.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.symbol}</span>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 4, width: 'fit-content', background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)' }}>
                    {t.direction}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {t.trade_date ? new Date(t.trade_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{t.entry_price}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{t.exit_price}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: t.pnl == null ? 'var(--text-muted)' : t.pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {t.pnl == null ? '—' : `${t.pnl >= 0 ? '+' : '-'}$${Math.abs(t.pnl).toFixed(2)}`}
                  </span>
                </div>
              ))}

              {trades.length > 50 && (
                <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Showing 50 of {trades.length} trades — all will be imported.</p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <CheckCircle size={14} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>How to export from cTrader</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
              Open cTrader → History tab → right-click anywhere → Export to CSV. Select <strong>Closed Positions</strong> (not Deals). The file will download automatically.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
