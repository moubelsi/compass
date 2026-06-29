'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/useCurrency'
import { formatCurrency, localDateStr } from '@/lib/utils'

// Handles cTrader "2024.06.05 10:30:00", ISO "2024-06-05T10:30", plain "2024-06-05", etc.
function parseTradeDate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const datePart = raw.trim().split(/[T ]/)[0]
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
  // YYYY.MM.DD  (cTrader dots)
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(datePart)) return datePart.replace(/\./g, '-')
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(datePart)) return datePart.replace(/\//g, '-')
  // DD.MM.YYYY or DD/MM/YYYY (European)
  const dmy = datePart.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // MM/DD/YYYY (US) — only if month part > 12 is impossible, so we keep day > 12 as hint
  const mdy = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy && parseInt(mdy[1]) <= 12 && parseInt(mdy[2]) > 12)
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  // Last resort: native parse
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : localDateStr(d)
}

interface ParsedTrade {
  symbol: string
  direction: 'LONG' | 'SHORT'
  entry_price: number
  exit_price: number
  pnl: number | null
  return_pct: number | null
  trade_date: string | null
  raw_date: string | null   // kept only for debug display in preview
}

// ─── cTrader parser ──────────────────────────────────────────────────────────

function parseCTraderCSV(text: string): ParsedTrade[] {
  const t = text.startsWith('﻿') ? text.slice(1) : text.startsWith('ï»¿') ? text.slice(3) : text
  const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('File appears empty — needs at least a header and one trade row.')

  const firstMultiCell = lines.find(l => l.includes(';') || l.includes(',')) ?? lines[0]
  const sep = (firstMultiCell.match(/;/g) || []).length >= (firstMultiCell.match(/,/g) || []).length ? ';' : ','

  const clean = (s: string) => s.trim().replace(/^["']|["']$/g, '').replace(/\s*\(.*?\)\s*$/, '').toLowerCase().trim()

  let headerRowIdx = -1
  let cols: string[] = []
  const symbolAliases = ['symbol', 'instrument', 'ticker', 'asset', 'market', 'security', 'product', 'description', 'pair', 'currency pair']
  for (let i = 0; i < lines.length; i++) {
    const candidate = lines[i].split(sep).map(clean)
    if (symbolAliases.some(a => candidate.includes(a))) { headerRowIdx = i; cols = candidate; break }
  }
  if (headerRowIdx < 0) {
    const sample = lines.slice(0, 3).map(l => l.split(sep).map(clean).join(' | ')).join('\n')
    throw new Error(`Cannot find a header row with a Symbol/Instrument column.\n\nFirst rows detected:\n${sample}\n\nTry selecting "cTrader" or "OKX" source, or check the CSV format.`)
  }
  // Strip any leading BOM / non-alphanumeric residue from the first column name
  if (cols.length > 0) cols[0] = cols[0].replace(/^[^a-z0-9]+/, '')

  const find = (...names: string[]) => names.reduce((f, n) => f >= 0 ? f : cols.indexOf(n), -1)

  const symbolIdx     = find(...symbolAliases)
  const dirIdx        = find('opening direction', 'direction', 'side', 'type', 'action', 'buy/sell', 'trans type', 'transaction type', 'order type')
  const openPriceIdx  = find('open price', 'entry price', 'open_price', 'entry_price', 'avg price', 'entry', 'price', 'avg open price', 'open avg price')
  const closePriceIdx = find('closing price', 'close price', 'exit price', 'close_price', 'exit_price', 'close avg price', 'avg close price', 'sell price', 'exec price', 'exit')
  const netProfitIdx  = find('net profit', 'net_profit', 'realized p&l', 'realized pnl', 'net p&l', 'net p/l', 'realized gain/loss')
  const grossProfitIdx= find('gross profit', 'gross_profit', 'profit', 'pnl', 'p/l', 'gain/loss', 'p&l', 'unrealized p&l')
  const closeTimeIdx  = find('closing time', 'close time', 'closed time', 'exit time', 'close_time', 'exit_time', 'close date', 'closed at', 'date closed', 'trade date', 'date', 'transaction date', 'fill time', 'exec time', 'date/time', 'datetime')
  const openTimeIdx   = find('open time', 'opening time', 'entry time', 'open_time', 'entry_time', 'opened at', 'date opened', 'open date')

  const netCurrencyIdx = netProfitIdx >= 0 ? netProfitIdx : cols.findIndex(c => c.startsWith('net '))
  const profitIdx = netCurrencyIdx >= 0 ? netCurrencyIdx : grossProfitIdx
  const balanceIdx = cols.findIndex(c => c.startsWith('balance '))
  const returnPctIdx = find('return %', 'return_pct', 'return(%)', '% return', 'pct return', 'return pct')

  if (symbolIdx < 0)     throw new Error(`Cannot find a Symbol column. Detected columns: ${cols.slice(0, 8).join(', ')}`)
  if (dirIdx < 0)        throw new Error(`Cannot find a Direction/Side column. Detected columns: ${cols.slice(0, 8).join(', ')}`)
  if (openPriceIdx < 0)  throw new Error(`Cannot find an Entry/Open Price column. Detected columns: ${cols.slice(0, 8).join(', ')}`)
  if (closePriceIdx < 0) throw new Error(`Cannot find a Close/Exit Price column. Detected columns: ${cols.slice(0, 8).join(', ')}`)

  const trades: ParsedTrade[] = []

  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cells.length < 3) continue

    const symbol = cells[symbolIdx]?.toUpperCase()
    if (!symbol) continue

    const rawDir = (cells[dirIdx] ?? '').toLowerCase().trim()
    // BTO/BUY/B/LONG = opened long; STC = sold to close a long → both are LONG trades
    // STO/SELL/S/SHORT = opened short; BTC = bought to close a short → both are SHORT trades
    const direction: 'LONG' | 'SHORT' | null =
      rawDir === 'bto' || rawDir === 'stc' || rawDir === 'b' || rawDir.includes('buy') || rawDir.includes('long')
        ? 'LONG'
        : rawDir === 'sto' || rawDir === 'btc' || rawDir === 's' || rawDir.includes('sell') || rawDir.includes('short')
          ? 'SHORT'
          : null
    if (!direction) continue

    const entry_price = parseFloat(cells[openPriceIdx])
    const exit_price  = parseFloat(cells[closePriceIdx])
    if (isNaN(entry_price) || isNaN(exit_price)) continue

    const pnlRaw = profitIdx >= 0 ? parseFloat(cells[profitIdx]) : NaN
    const pnl = isNaN(pnlRaw) ? null : pnlRaw

    const balanceAfter  = balanceIdx >= 0 ? parseFloat(cells[balanceIdx]) : NaN
    const balanceBefore = (!isNaN(balanceAfter) && !isNaN(pnlRaw)) ? balanceAfter - pnlRaw : NaN
    const returnFromCol = returnPctIdx >= 0 ? parseFloat(cells[returnPctIdx]) : NaN
    const return_pct    = !isNaN(returnFromCol) ? returnFromCol
                        : (balanceBefore > 0 && !isNaN(pnlRaw)) ? (pnlRaw / balanceBefore) * 100 : null

    const rawDate    = closeTimeIdx >= 0 ? cells[closeTimeIdx] : openTimeIdx >= 0 ? cells[openTimeIdx] : null
    const trade_date = parseTradeDate(rawDate)

    trades.push({ symbol, direction, entry_price, exit_price, pnl, return_pct, trade_date, raw_date: rawDate })
  }

  if (trades.length === 0) throw new Error('No valid trades found. Check that you exported "Closed Positions" (not Deals or Orders).')
  return trades
}

// ─── OKX parser ──────────────────────────────────────────────────────────────

function cleanOKXSymbol(raw: string): string {
  // BTC-USDT-SWAP → BTCUSDT  |  ETH-USD-SWAP → ETHUSD  |  BTC-USDT-240329 → BTCUSDT
  return raw
    .replace(/-SWAP$/i, '')
    .replace(/-PERP$/i, '')
    .replace(/-\d{6,8}$/i, '')
    .replace(/-/g, '')
    .toUpperCase()
    .trim()
}

function parseOKXCSV(text: string): ParsedTrade[] {
  const t = text.startsWith('﻿') ? text.slice(1) : text.startsWith('ï»¿') ? text.slice(3) : text
  const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('File appears empty — needs at least a header and one row.')

  const firstMultiCell = lines.find(l => l.includes(',') || l.includes('\t')) ?? lines[0]
  const sep = firstMultiCell.includes('\t') ? '\t' : ','

  const clean = (s: string) => s.trim().replace(/^["']|["']$/g, '').toLowerCase().trim()

  // Find header row — OKX sometimes has a title row at the top
  let headerRowIdx = -1
  let cols: string[] = []
  const instrumentAliases = ['instrument id', 'instrument', 'symbol', 'pair', 'inst id', 'instid', 'contract']
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const candidate = lines[i].split(sep).map(clean)
    if (instrumentAliases.some(a => candidate.includes(a))) { headerRowIdx = i; cols = candidate; break }
  }
  if (headerRowIdx < 0) throw new Error('Cannot find a header row with an "Instrument ID" or "Symbol" column. Is this an OKX Positions History CSV?')
  if (cols.length > 0) cols[0] = cols[0].replace(/^[^a-z0-9]+/, '')

  const find = (...names: string[]) => names.reduce((f, n) => f >= 0 ? f : cols.indexOf(n), -1)

  const instrumentIdx = find('instrument id', 'instrument', 'symbol', 'pair', 'inst id', 'instid', 'contract')
  const directionIdx  = find('direction', 'side', 'pos side', 'position side', 'posSide')
  const openPriceIdx  = find(
    'open avg px', 'avg open price', 'open average price', 'open price', 'entry price',
    'avg entry price', 'opening price', 'avg open px', 'open_price'
  )
  const closePriceIdx = find(
    'close avg px', 'avg close price', 'closing average price', 'close price', 'exit price',
    'avg close px', 'closing price', 'close_price', 'avg closing price'
  )
  const pnlIdx = find(
    'pnl', 'realized pnl', 'profit and loss', 'profit/loss', 'net pnl',
    'realizedpnl', 'profit', 'net profit', 'gain/loss'
  )
  const pnlRatioIdx = find('pnl ratio', 'roi', 'pnl%', 'pnl %', 'return', 'return rate', 'yield')
  const closeTimeIdx = find(
    'update time', 'close time', 'closed at', 'closing time', 'exit time',
    'closed time', 'close_time', 'updatetime'
  )
  const openTimeIdx = find(
    'create time', 'created at', 'open time', 'opening time', 'entry time',
    'createtime', 'open_time'
  )

  if (instrumentIdx < 0) throw new Error('Cannot find an "Instrument ID" column. Are you using OKX Positions History export?')
  if (directionIdx < 0)  throw new Error('Cannot find a "Direction" or "Side" column.')
  if (openPriceIdx < 0)  throw new Error('Cannot find an open/entry price column. Expected "Open avg px" or similar.')
  if (closePriceIdx < 0) throw new Error('Cannot find a close/exit price column. Expected "Close avg px" or similar.')

  const trades: ParsedTrade[] = []

  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cells.length < 3) continue

    const rawSymbol = cells[instrumentIdx] ?? ''
    if (!rawSymbol) continue
    const symbol = cleanOKXSymbol(rawSymbol)

    const rawDir = (cells[directionIdx] ?? '').toLowerCase()
    const direction: 'LONG' | 'SHORT' | null =
      (rawDir.includes('long') || rawDir.includes('buy'))  ? 'LONG' :
      (rawDir.includes('short') || rawDir.includes('sell')) ? 'SHORT' : null
    if (!direction) continue

    const entry_price = parseFloat(cells[openPriceIdx]?.replace(/,/g, '') ?? '')
    const exit_price  = parseFloat(cells[closePriceIdx]?.replace(/,/g, '') ?? '')
    if (isNaN(entry_price) || isNaN(exit_price)) continue

    const pnlRaw = pnlIdx >= 0 ? parseFloat(cells[pnlIdx]?.replace(/,/g, '') ?? '') : NaN
    const pnl = isNaN(pnlRaw) ? null : pnlRaw

    // OKX exports PnL ratio as e.g. "12.34%" or "0.1234" — normalise to percent
    let return_pct: number | null = null
    if (pnlRatioIdx >= 0) {
      const raw = cells[pnlRatioIdx]?.replace(/,/g, '') ?? ''
      const num = parseFloat(raw.replace('%', ''))
      if (!isNaN(num)) return_pct = raw.includes('%') ? num : num * 100
    }

    const rawDate    = closeTimeIdx >= 0 ? cells[closeTimeIdx] : openTimeIdx >= 0 ? cells[openTimeIdx] : null
    const trade_date = parseTradeDate(rawDate)

    trades.push({ symbol, direction, entry_price, exit_price, pnl, return_pct, trade_date, raw_date: rawDate })
  }

  if (trades.length === 0) throw new Error('No valid trades found. Make sure you exported Positions History (not Order History) from OKX.')
  return trades
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Source = 'ctrader' | 'okx'

const SOURCES: { id: Source; label: string; note: string }[] = [
  { id: 'ctrader', label: 'cTrader', note: 'Closed Positions export' },
  { id: 'okx',     label: 'OKX',     note: 'Positions History export' },
]

const INSTRUCTIONS: Record<Source, { title: string; steps: string[] }> = {
  ctrader: {
    title: 'How to export from cTrader',
    steps: [
      'Open cTrader → History tab',
      'Right-click anywhere → Export to CSV',
      'Select Closed Positions (not Deals or Orders)',
      'Upload the downloaded .csv file here',
    ],
  },
  okx: {
    title: 'How to export from OKX',
    steps: [
      'Log in to OKX → go to Trade → Orders',
      'Select Futures or Perpetuals tab → Positions History',
      'Set your date range and click Export / Download',
      'Upload the downloaded .csv file here',
    ],
  },
}

export default function ImportPage() {
  const { symbol } = useCurrency()
  const [source, setSource]       = useState<Source>('ctrader')
  const [step, setStep]           = useState<'upload' | 'preview' | 'importing'>('upload')
  const [trades, setTrades]       = useState<ParsedTrade[]>([])
  const [replaceMode, setReplaceMode] = useState(false)
  const [error, setError]         = useState('')
  const [filename, setFilename]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  function reset() { setStep('upload'); setTrades([]); setFilename(''); setError('') }

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Please upload a .csv file.'); return }
    setFilename(file.name)
    setError('')
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const parsed = source === 'okx' ? parseOKXCSV(text) : parseCTraderCSV(text)
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

    if (replaceMode) {
      const { error: deleteError } = await supabase.from('trades').delete().eq('user_id', user.id)
      if (deleteError) { setError('Failed to clear existing trades: ' + deleteError.message); setStep('preview'); return }
    }

    const rows = trades.map(t => ({
      user_id:       user.id,
      symbol:        t.symbol,
      direction:     t.direction,
      entry_price:   t.entry_price,
      exit_price:    t.exit_price,
      pnl:           t.pnl,
      return_pct:    t.return_pct,
      trade_date:    t.trade_date,
      followed_plan: false,
    }))

    const { error: insertError } = await supabase.from('trades').insert(rows)
    if (insertError) { setError(insertError.message); setStep('preview'); return }

    // Go to journal at the most recent imported trade date so chart is visible immediately
    const dates = trades.map(t => t.trade_date).filter(Boolean) as string[]
    const latestDate = dates.sort().at(-1)
    router.push(latestDate ? `/journal?date=${latestDate}` : '/trades')
  }

  const previewRows = trades.slice(0, 50)
  const instr = INSTRUCTIONS[source]

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Link href="/trades" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 16 }}>
            <ArrowLeft size={13} />Trades
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 6 }}>Import trades</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Bulk import your trade history from your broker.</p>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Source selector */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Broker / platform</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {SOURCES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setSource(s.id); reset() }}
                style={{
                  padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
                  background: source === s.id ? 'var(--bg-overlay)' : 'var(--bg-surface)',
                  border: `1.5px solid ${source === s.id ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                  color: source === s.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.1s', textAlign: 'left',
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>{s.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.note}</p>
              </button>
            ))}
          </div>
        </div>

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
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>or click to browse · {SOURCES.find(s => s.id === source)?.note}</p>
            <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        )}

        {(step === 'preview' || step === 'importing') && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{filename}</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{trades.length} trade{trades.length !== 1 ? 's' : ''} ready to import</p>
                {/* Import mode toggle */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setReplaceMode(false)}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: !replaceMode ? 'var(--bg-overlay)' : 'var(--bg-elevated)', color: !replaceMode ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${!replaceMode ? 'var(--border-default)' : 'var(--border-subtle)'}`, transition: 'all 0.1s' }}
                  >
                    Add to existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaceMode(true)}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: replaceMode ? 'rgba(192,57,43,0.08)' : 'var(--bg-elevated)', color: replaceMode ? 'var(--loss)' : 'var(--text-muted)', border: `1px solid ${replaceMode ? 'rgba(192,57,43,0.3)' : 'var(--border-subtle)'}`, transition: 'all 0.1s' }}
                  >
                    Replace existing
                  </button>
                </div>
                {replaceMode && (
                  <p style={{ fontSize: 11, color: 'var(--loss)', marginTop: 6 }}>
                    All current trades will be deleted before importing.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <button type="button" className="btn-secondary" onClick={reset} disabled={step === 'importing'} style={{ fontSize: 14 }}>Cancel</button>
                <button type="button" className="btn-primary" onClick={handleImport} disabled={step === 'importing'} style={{ fontSize: 14 }}>
                  {step === 'importing' ? 'Importing…' : replaceMode ? `Replace with ${trades.length} trade${trades.length !== 1 ? 's' : ''}` : `Import ${trades.length} trade${trades.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>

            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                {['Symbol', 'Direction', 'Date', 'Entry', 'Exit', 'P&L', 'Return'].map(h => (
                  <p key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{h}</p>
                ))}
              </div>

              {previewRows.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: i < previewRows.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.symbol}</span>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 4, width: 'fit-content', background: t.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: t.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)' }}>{t.direction}</span>
                  {t.trade_date ? (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {new Date(t.trade_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#B45309', fontFamily: 'monospace' }} title="Could not parse this date — please report the format">
                      {t.raw_date || '—'}
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{t.entry_price}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{t.exit_price}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: t.pnl == null ? 'var(--text-muted)' : t.pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {t.pnl == null ? '—' : formatCurrency(t.pnl, true, symbol)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: t.return_pct == null ? 'var(--text-muted)' : t.return_pct >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {t.return_pct == null ? '—' : `${t.return_pct >= 0 ? '+' : ''}${t.return_pct.toFixed(3)}%`}
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

        {/* Instructions */}
        <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <CheckCircle size={14} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>{instr.title}</p>
            <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {instr.steps.map((step, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', minWidth: 16, marginTop: 2 }}>{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

      </div>
    </div>
  )
}
