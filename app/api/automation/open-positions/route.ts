import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getLivePricesForBrokerAccount, computeUnrealizedPnl } from '@/lib/automation/live-prices'

interface OrderEntry {
  id: string
  strategy_version_id: string
  symbol: string
  side: 'long' | 'short'
  filled_price: number | null
  requested_price: number
  requested_qty: number
  sl: number | null
  tp: number | null
  created_at: string
}

interface VersionInfo {
  id: string
  version_label: string
  strategy_id: string
  broker_account_id: string | null
  strategyName: string
  broker: 'ctrader' | 'okx' | null
  isLive: boolean
}

export interface OpenPositionSummary {
  id: string
  strategyId: string
  strategyName: string
  versionId: string
  versionLabel: string
  symbol: string
  side: 'long' | 'short'
  entryPrice: number
  qty: number
  sl: number | null
  tp: number | null
  openedAt: string
  currentPrice: number | null
  unrealizedPnl: number | null
  unrealizedReturnPct: number | null
}

/**
 * Every open position across every live-mode strategy version, with live
 * unrealized P&L — the Automation homepage's "what's running right now"
 * panel. Groups by broker account so a strategy with several open positions
 * on the same account only opens one cTrader session / makes one round of
 * OKX ticker calls, not one per position.
 */
export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: versionsRaw } = await supabase
    .from('automation_strategy_versions')
    .select('id, version_label, strategy_id, broker_account_id, automation_strategies(name), automation_broker_accounts(broker, is_live)')
    .eq('mode', 'live')
    .not('broker_account_id', 'is', null)
  if (!versionsRaw || versionsRaw.length === 0) return NextResponse.json({ positions: [] })

  const versions: VersionInfo[] = versionsRaw.map(v => {
    const strategy = v.automation_strategies as unknown as { name: string } | null
    const account = v.automation_broker_accounts as unknown as { broker: 'ctrader' | 'okx'; is_live: boolean } | null
    return {
      id: v.id,
      version_label: v.version_label,
      strategy_id: v.strategy_id,
      broker_account_id: v.broker_account_id,
      strategyName: strategy?.name ?? 'Strategy',
      broker: account?.broker ?? null,
      isLive: account?.is_live ?? false,
    }
  })
  const versionById = new Map(versions.map(v => [v.id, v]))
  const versionIds = versions.map(v => v.id)

  const [{ data: entries }, { data: closes }] = await Promise.all([
    supabase.from('automation_orders')
      .select('id, strategy_version_id, symbol, side, filled_price, requested_price, requested_qty, sl, tp, created_at')
      .in('strategy_version_id', versionIds).in('side', ['long', 'short']).eq('status', 'filled')
      .order('created_at', { ascending: false }),
    supabase.from('automation_orders')
      .select('closes_order_id')
      .in('strategy_version_id', versionIds).eq('side', 'close').not('closes_order_id', 'is', null),
  ])
  const closedIds = new Set((closes ?? []).map(c => c.closes_order_id as string))
  const openEntries = ((entries ?? []) as OrderEntry[]).filter(e => !closedIds.has(e.id))
  if (openEntries.length === 0) return NextResponse.json({ positions: [] })

  // Group symbols by broker account so each account is queried once.
  const symbolsByAccount = new Map<string, Set<string>>()
  for (const e of openEntries) {
    const v = versionById.get(e.strategy_version_id)
    if (!v?.broker_account_id) continue
    if (!symbolsByAccount.has(v.broker_account_id)) symbolsByAccount.set(v.broker_account_id, new Set())
    symbolsByAccount.get(v.broker_account_id)!.add(e.symbol)
  }

  const priceByAccount = new Map<string, Record<string, number | null>>()
  for (const [accountId, symbols] of symbolsByAccount) {
    const v = versions.find(x => x.broker_account_id === accountId)
    if (!v?.broker) continue
    priceByAccount.set(accountId, await getLivePricesForBrokerAccount(supabase, accountId, v.broker, v.isLive, [...symbols]))
  }

  const positions: OpenPositionSummary[] = openEntries.map(e => {
    const v = versionById.get(e.strategy_version_id)!
    const currentPrice = v.broker_account_id ? priceByAccount.get(v.broker_account_id)?.[e.symbol] ?? null : null
    const entryPrice = e.filled_price ?? e.requested_price
    const { unrealizedPnl, unrealizedReturnPct } = computeUnrealizedPnl(e.side, entryPrice, Number(e.requested_qty), currentPrice)
    return {
      id: e.id,
      strategyId: v.strategy_id,
      strategyName: v.strategyName,
      versionId: v.id,
      versionLabel: v.version_label,
      symbol: e.symbol,
      side: e.side,
      entryPrice,
      qty: e.requested_qty,
      sl: e.sl,
      tp: e.tp,
      openedAt: e.created_at,
      currentPrice,
      unrealizedPnl,
      unrealizedReturnPct,
    }
  })

  return NextResponse.json({ positions })
}
