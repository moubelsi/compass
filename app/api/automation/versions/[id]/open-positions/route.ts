import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getLivePricesForBrokerAccount, computeUnrealizedPnl } from '@/lib/automation/live-prices'

interface OpenPositionRow {
  id: string
  symbol: string
  side: 'long' | 'short'
  filled_price: number | null
  requested_price: number
  requested_qty: number
}

/**
 * Live/unrealized P&L for a version's open positions — a page-load pull, not
 * a stream. Broker calls happen here (server-side, decrypted credentials)
 * rather than client-side, same boundary as every other execution-adapter
 * call in this app.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: version } = await supabase
    .from('automation_strategy_versions')
    .select('id, broker_account_id, automation_broker_accounts(broker, is_live)')
    .eq('id', id)
    .single()
  if (!version) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: entries }, { data: closes }] = await Promise.all([
    supabase.from('automation_orders')
      .select('id, symbol, side, filled_price, requested_price, requested_qty')
      .eq('strategy_version_id', id).in('side', ['long', 'short']).eq('status', 'filled')
      .order('created_at', { ascending: false }),
    supabase.from('automation_orders')
      .select('closes_order_id')
      .eq('strategy_version_id', id).eq('side', 'close').not('closes_order_id', 'is', null),
  ])
  const closedIds = new Set((closes ?? []).map(c => c.closes_order_id as string))
  const openPositions = (entries ?? []).filter(e => !closedIds.has(e.id)) as OpenPositionRow[]

  const account = version.automation_broker_accounts as unknown as { broker: 'ctrader' | 'okx'; is_live: boolean } | null
  const positions: Record<string, { currentPrice: number | null; unrealizedPnl: number | null; unrealizedReturnPct: number | null }> = {}
  if (openPositions.length === 0 || !version.broker_account_id || !account) {
    return NextResponse.json({ positions })
  }

  const symbols = [...new Set(openPositions.map(p => p.symbol))]
  const priceBySymbol = await getLivePricesForBrokerAccount(supabase, version.broker_account_id, account.broker, account.is_live, symbols)

  for (const p of openPositions) {
    const entry = p.filled_price ?? p.requested_price
    positions[p.id] = { currentPrice: priceBySymbol[p.symbol] ?? null, ...computeUnrealizedPnl(p.side, entry, Number(p.requested_qty), priceBySymbol[p.symbol] ?? null) }
  }

  return NextResponse.json({ positions })
}
