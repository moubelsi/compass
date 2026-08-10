import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The open entry order (if any) for a strategy version + symbol. "Open" means
 * a filled long/short order that no filled close order references via
 * closes_order_id. Only one open position per version+symbol is allowed in
 * M1 (see risk.ts's no_open_position check) so this never has to pick among
 * several candidates — it's still written to tolerate more than one.
 */
export async function findOpenEntryOrder(supabase: SupabaseClient, strategyVersionId: string, symbol: string) {
  const { data: entries } = await supabase
    .from('automation_orders')
    .select('*')
    .eq('strategy_version_id', strategyVersionId)
    .eq('symbol', symbol)
    .in('side', ['long', 'short'])
    .eq('status', 'filled')
    .order('created_at', { ascending: false })

  if (!entries || entries.length === 0) return null

  const { data: closes } = await supabase
    .from('automation_orders')
    .select('closes_order_id')
    .in('closes_order_id', entries.map(e => e.id))
  const closedIds = new Set((closes ?? []).map(c => c.closes_order_id as string))

  return entries.find(e => !closedIds.has(e.id)) ?? null
}
