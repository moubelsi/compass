import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServer } from '@/lib/supabase-server'

interface TradeStat {
  count: number
  winRate: string
}

interface SymbolStat {
  name: string
  count: number
  wins: number
  pnl: number
  winRate: string
}

function dirStat(group: any[]): TradeStat {
  const w = group.filter(t => Number(t.pnl) > 0)
  return {
    count: group.length,
    winRate: group.length > 0 ? (w.length / group.length * 100).toFixed(1) : 'N/A',
  }
}

function buildSummary(trades: any[]) {
  const total = trades.length
  const wins = trades.filter(t => Number(t.pnl) > 0)
  const losses = trades.filter(t => Number(t.pnl) < 0)

  const grossProfit = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))

  const recent = trades.slice(0, Math.min(20, total))
  const recentWins = recent.filter(t => Number(t.pnl) > 0).length

  const stratMap: Record<string, { count: number; wins: number; pnl: number }> = {}
  trades.filter(t => t.strategy).forEach(t => {
    if (!stratMap[t.strategy]) stratMap[t.strategy] = { count: 0, wins: 0, pnl: 0 }
    stratMap[t.strategy].count++
    if (Number(t.pnl) > 0) stratMap[t.strategy].wins++
    stratMap[t.strategy].pnl += Number(t.pnl)
  })
  const strategies = Object.entries(stratMap)
    .map(([name, s]) => ({ name, ...s, winRate: (s.wins / s.count * 100).toFixed(1) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const symMap: Record<string, SymbolStat> = {}
  trades.forEach(t => {
    const sym = (t.symbol || 'Unknown').toUpperCase()
    if (!symMap[sym]) symMap[sym] = { name: sym, count: 0, wins: 0, pnl: 0, winRate: '0' }
    symMap[sym].count++
    if (Number(t.pnl) > 0) symMap[sym].wins++
    symMap[sym].pnl += Number(t.pnl)
  })
  const symbols = Object.values(symMap)
    .map(s => ({ ...s, winRate: (s.wins / s.count * 100).toFixed(1) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const planned = trades.filter(t => t.trade_type === 'planned')
  const impulsive = trades.filter(t => t.trade_type === 'impulsive')

  const confTrades = trades.filter(t => t.confidence != null)
  const confBands = confTrades.length >= 5 ? [
    { label: 'Low (1–4)',  group: confTrades.filter(t => Number(t.confidence) <= 4) },
    { label: 'Mid (5–7)',  group: confTrades.filter(t => Number(t.confidence) >= 5 && Number(t.confidence) <= 7) },
    { label: 'High (8–10)', group: confTrades.filter(t => Number(t.confidence) >= 8) },
  ].map(b => ({
    label: b.label,
    count: b.group.length,
    winRate: b.group.length > 0 ? (b.group.filter(t => Number(t.pnl) > 0).length / b.group.length * 100).toFixed(1) : 'N/A',
  })) : null

  return {
    total,
    winRate: (wins.length / total * 100).toFixed(1),
    profitFactor: grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : 'N/A',
    totalReturn: trades.reduce((s, t) => s + Number(t.return_pct || 0), 0).toFixed(2),
    recentCount: recent.length,
    recentWinRate: (recentWins / recent.length * 100).toFixed(1),
    longs: dirStat(trades.filter(t => t.direction === 'LONG')),
    shorts: dirStat(trades.filter(t => t.direction === 'SHORT')),
    strategies,
    symbols,
    planned: { ...dirStat(planned), count: planned.length },
    impulsive: { ...dirStat(impulsive), count: impulsive.length },
    confBands,
  }
}

function buildPrompt(s: ReturnType<typeof buildSummary>): string {
  const lines: string[] = [
    'You are a trading performance coach. Analyze these trading statistics and return 4–6 specific, data-backed insights.',
    '',
    'OVERALL:',
    `- Total trades: ${s.total}`,
    `- Win rate: ${s.winRate}%`,
    `- Profit factor: ${s.profitFactor}`,
    `- Total account return: ${s.totalReturn}%`,
    `- Recent win rate (last ${s.recentCount} trades): ${s.recentWinRate}%`,
    '',
    'DIRECTION:',
    `- LONG: ${s.longs.count} trades, ${s.longs.winRate}% win rate`,
    `- SHORT: ${s.shorts.count} trades, ${s.shorts.winRate}% win rate`,
  ]

  if (s.strategies.length > 0) {
    lines.push('', 'TOP STRATEGIES:')
    s.strategies.forEach(st => lines.push(`- ${st.name}: ${st.count} trades, ${st.winRate}% win rate, €${st.pnl.toFixed(2)} P&L`))
  }

  if (s.symbols.length > 0) {
    lines.push('', 'TOP SYMBOLS:')
    s.symbols.forEach(sy => lines.push(`- ${sy.name}: ${sy.count} trades, ${sy.winRate}% win rate, €${sy.pnl.toFixed(2)} P&L`))
  }

  if (s.planned.count + s.impulsive.count > 0) {
    lines.push('', 'TRADE TYPE:')
    if (s.planned.count > 0) lines.push(`- Planned: ${s.planned.count} trades, ${s.planned.winRate}% win rate`)
    if (s.impulsive.count > 0) lines.push(`- Impulsive: ${s.impulsive.count} trades, ${s.impulsive.winRate}% win rate`)
  }

  if (s.confBands) {
    lines.push('', 'CONFIDENCE BANDS:')
    s.confBands.forEach(b => lines.push(`- ${b.label}: ${b.count} trades, ${b.winRate}% win rate`))
  }

  lines.push(
    '',
    'Return ONLY a JSON array — no markdown, no code fences, just raw JSON — with this exact structure:',
    '[',
    '  {',
    '    "type": "strength" | "warning" | "opportunity" | "pattern",',
    '    "category": "2–3 word category (e.g. Symbol, Risk, Behavior, Strategy, Direction)",',
    '    "headline": "Direct statement, max 8 words",',
    '    "detail": "2–3 sentences with specific numbers from the data. Be direct and actionable.",',
    '    "metric": "A key number to highlight (optional, e.g. \'71%\', \'+€340\')",',
    '    "metricLabel": "Short label for the metric (optional)"',
    '  }',
    ']',
    '',
    'Rules: use exact numbers from the data. Skip obvious observations. Prioritize insights that reveal trading edge, psychological patterns, or specific risks. Be a coach, not a narrator.',
  )

  return lines.join('\n')
}

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 })
  }

  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trades } = await supabase
    .from('trades')
    .select('symbol, direction, pnl, return_pct, rr, strategy, trade_type, confidence, followed_plan, trade_date, created_at')
    .eq('user_id', user.id)
    .order('trade_date', { ascending: false, nullsFirst: false })
    .limit(300)

  if (!trades || trades.length < 5) {
    return NextResponse.json({ error: 'Log at least 5 trades to generate insights.' }, { status: 400 })
  }

  const summary = buildSummary(trades)
  const prompt = buildPrompt(summary)

  const client = new Anthropic()
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''

  let insights
  try {
    const match = text.match(/\[[\s\S]*\]/)
    insights = JSON.parse(match?.[0] ?? '[]')
  } catch {
    return NextResponse.json({ error: 'Unexpected response format. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ insights, tradeCount: trades.length })
}
