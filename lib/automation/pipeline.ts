import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSignal, computeIdempotencyKey } from './signal'
import { evaluateEntryRisk, evaluateCloseRisk } from './risk'
import { getExecutionAdapter } from './execution/registry'
import { createCTraderAdapter } from './execution/ctrader'
import { createOkxAdapter } from './execution/okx'
import type { ExecutionAdapter } from './execution/types'
import { findOpenEntryOrder } from './positions'
import { getFreshCTraderCredentials, getOkxCredentials } from './broker-accounts'
import { localDateStr } from '@/lib/utils'

/** Resolves the adapter to execute against for this version's mode — 'paper'
 * is always the stateless singleton; 'live' loads the version's connected
 * broker account, decrypts its credentials just-in-time, and builds an
 * adapter scoped to that specific account (demo or real, whichever it is). */
async function resolveAdapter(
  supabase: SupabaseClient,
  version: { mode: string; broker_account_id: string | null },
): Promise<{ adapter: ExecutionAdapter; isLiveAccount: boolean | null } | { error: string }> {
  if (version.mode === 'paper') return { adapter: getExecutionAdapter('paper'), isLiveAccount: null }
  if (version.mode !== 'live') return { error: `mode "${version.mode}" has no execution adapter` }
  if (!version.broker_account_id) return { error: 'live mode has no broker account connected' }

  const { data: account } = await supabase
    .from('automation_broker_accounts')
    .select('id, broker, is_live, status')
    .eq('id', version.broker_account_id)
    .single()
  if (!account || account.status !== 'connected') return { error: 'connected broker account not found' }

  if (account.broker === 'ctrader') {
    const creds = await getFreshCTraderCredentials(supabase, account.id)
    if (!creds) return { error: 'could not load cTrader credentials' }
    return { adapter: createCTraderAdapter(creds, account.is_live), isLiveAccount: account.is_live }
  }
  if (account.broker === 'okx') {
    const creds = await getOkxCredentials(supabase, account.id)
    if (!creds) return { error: 'could not load OKX credentials' }
    return { adapter: createOkxAdapter(creds, account.is_live), isLiveAccount: account.is_live }
  }
  return { error: `unknown broker "${account.broker}"` }
}

export interface WebhookRow {
  id: string
  user_id: string
  strategy_version_id: string
}

export interface PipelineResult {
  httpStatus: number
  body: Record<string, unknown>
}

async function markRejected(supabase: SupabaseClient, eventId: string, reason: string) {
  await supabase.from('automation_webhook_events').update({ status: 'rejected', rejection_reason: reason }).eq('id', eventId)
}

/**
 * Signal → Validate → Risk → Execute → Trade (design doc §7/§12). Runs
 * synchronously in the webhook route — no queue: everything here is local DB
 * reads/writes plus, in M1, a simulated paper fill, so it comfortably
 * finishes in well under a second.
 *
 * Never silently drops a signal — every branch writes (or already wrote) an
 * automation_webhook_events row with a status/rejection_reason.
 */
export async function processWebhookEvent(
  supabase: SupabaseClient,
  webhook: WebhookRow,
  rawBody: unknown,
  secretValid: boolean,
): Promise<PipelineResult> {
  const receivedAtMs = Date.now()

  if (!secretValid) {
    await supabase.from('automation_webhook_events').insert({
      user_id: webhook.user_id,
      webhook_id: webhook.id,
      raw_payload: rawBody as object,
      secret_valid: false,
      idempotency_key: `invalid-secret-${receivedAtMs}-${Math.random().toString(36).slice(2)}`,
      status: 'rejected',
      rejection_reason: 'invalid_secret',
    })
    return { httpStatus: 401, body: { ok: false, error: 'invalid_secret' } }
  }

  const parsed = parseSignal(rawBody)
  if (!parsed.ok) {
    await supabase.from('automation_webhook_events').insert({
      user_id: webhook.user_id,
      webhook_id: webhook.id,
      raw_payload: rawBody as object,
      secret_valid: true,
      idempotency_key: `invalid-payload-${receivedAtMs}-${Math.random().toString(36).slice(2)}`,
      status: 'rejected',
      rejection_reason: `invalid_payload: ${parsed.errors.join('; ')}`,
    })
    return { httpStatus: 400, body: { ok: false, errors: parsed.errors } }
  }

  const signal = parsed.data
  const idempotencyKey = computeIdempotencyKey(rawBody as Record<string, unknown>, signal, receivedAtMs)

  const { data: event, error: insertError } = await supabase
    .from('automation_webhook_events')
    .insert({
      user_id: webhook.user_id,
      webhook_id: webhook.id,
      raw_payload: rawBody as object,
      secret_valid: true,
      idempotency_key: idempotencyKey,
      parsed_signal: signal as object,
      status: 'received',
    })
    .select('id')
    .single()

  if (insertError) {
    // 23505 = unique_violation on (webhook_id, idempotency_key) — a duplicate
    // delivery of an alert already processed. Ack quietly, do not reprocess.
    if (insertError.code === '23505') {
      return { httpStatus: 200, body: { ok: true, duplicate: true } }
    }
    const details = `${insertError.code}: ${insertError.message}`
    console.error('Webhook event insert error:', details, insertError)
    throw new Error(`Failed to insert webhook event: ${details}`)
  }

  await supabase.from('automation_webhooks').update({ last_received_at: new Date().toISOString() }).eq('id', webhook.id)

  const { data: version } = await supabase
    .from('automation_strategy_versions')
    .select('*')
    .eq('id', webhook.strategy_version_id)
    .single()

  if (!version || version.status !== 'active' || version.mode === 'off') {
    await markRejected(supabase, event.id, 'strategy version is not active or mode is off')
    return { httpStatus: 200, body: { ok: true, status: 'rejected', reason: 'version_inactive' } }
  }

  const resolved = await resolveAdapter(supabase, version)
  if ('error' in resolved) {
    await markRejected(supabase, event.id, resolved.error)
    return { httpStatus: 200, body: { ok: true, status: 'rejected', reason: 'mode_not_executable' } }
  }

  await supabase.from('automation_webhook_events').update({ status: 'validated' }).eq('id', event.id)

  const risk = signal.side === 'close'
    ? await evaluateCloseRisk(supabase, version, signal)
    : await evaluateEntryRisk(supabase, version, signal)

  await supabase.from('automation_risk_evaluations').insert({
    user_id: webhook.user_id,
    webhook_event_id: event.id,
    passed: risk.passed,
    checks: risk.checks as object,
    computed_qty: risk.computedQty,
    computed_risk_amount: risk.computedRiskAmount,
  })

  if (!risk.passed) {
    const reason = Object.entries(risk.checks).filter(([, c]) => !c.ok).map(([k, c]) => `${k}: ${c.detail}`).join('; ')
    await markRejected(supabase, event.id, reason)
    return { httpStatus: 200, body: { ok: true, status: 'rejected', reason } }
  }

  const { adapter, isLiveAccount } = resolved

  if (signal.side === 'close') {
    return closePosition(supabase, webhook, event.id, version, signal, adapter, isLiveAccount)
  }
  return openPosition(supabase, webhook, event.id, version, signal, risk.computedQty!, adapter, isLiveAccount)
}

async function openPosition(
  supabase: SupabaseClient,
  webhook: WebhookRow,
  eventId: string,
  version: Record<string, unknown>,
  signal: { symbol: string; side: 'long' | 'short' | 'close'; price: number; sl: number | null; tp: number | null },
  qty: number,
  adapter: ExecutionAdapter,
  isLiveAccount: boolean | null,
): Promise<PipelineResult> {
  const result = await adapter.placeOrder({
    symbol: signal.symbol,
    side: signal.side as 'long' | 'short',
    qty,
    price: signal.price,
    sl: signal.sl,
    tp: signal.tp,
  })

  const { data: order } = await supabase
    .from('automation_orders')
    .insert({
      user_id: webhook.user_id,
      strategy_version_id: version.id,
      webhook_event_id: eventId,
      mode: version.mode,
      is_live_account: isLiveAccount,
      symbol: signal.symbol,
      side: signal.side,
      order_type: 'market',
      requested_price: signal.price,
      filled_price: result.filledPrice,
      requested_qty: qty,
      sl: signal.sl,
      tp: signal.tp,
      status: result.status === 'filled' ? 'filled' : 'rejected',
      broker_order_id: result.brokerOrderId,
      broker_response: result.brokerResponse as object,
      execution_latency_ms: result.executionLatencyMs,
    })
    .select('id')
    .single()

  await supabase
    .from('automation_webhook_events')
    .update({ status: result.status === 'filled' ? 'processed' : 'error' })
    .eq('id', eventId)

  return { httpStatus: 200, body: { ok: true, status: 'position_opened', orderId: order?.id } }
}

async function closePosition(
  supabase: SupabaseClient,
  webhook: WebhookRow,
  eventId: string,
  version: Record<string, unknown>,
  signal: { symbol: string; price: number },
  adapter: ExecutionAdapter,
  isLiveAccount: boolean | null,
): Promise<PipelineResult> {
  const openOrder = await findOpenEntryOrder(supabase, version.id as string, signal.symbol)
  if (!openOrder) {
    // Risk check already required this, but guard again — state can't have
    // shifted between the check and here since this all runs single-threaded
    // per request, but a defensive check costs nothing.
    await markRejected(supabase, eventId, 'no open position to close')
    return { httpStatus: 200, body: { ok: true, status: 'rejected', reason: 'no_open_position' } }
  }

  const result = await adapter.closePosition({
    symbol: signal.symbol,
    qty: Number(openOrder.requested_qty),
    price: signal.price,
    openOrder: { brokerOrderId: openOrder.broker_order_id, brokerResponse: openOrder.broker_response },
  })

  const { data: closeOrder } = await supabase
    .from('automation_orders')
    .insert({
      user_id: webhook.user_id,
      strategy_version_id: version.id,
      webhook_event_id: eventId,
      closes_order_id: openOrder.id,
      mode: version.mode,
      is_live_account: isLiveAccount,
      symbol: signal.symbol,
      side: 'close',
      order_type: 'market',
      requested_price: signal.price,
      filled_price: result.filledPrice,
      requested_qty: openOrder.requested_qty,
      status: result.status === 'filled' ? 'filled' : 'rejected',
      broker_order_id: result.brokerOrderId,
      broker_response: result.brokerResponse as object,
      execution_latency_ms: result.executionLatencyMs,
    })
    .select('id')
    .single()

  if (result.status === 'filled' && closeOrder) {
    await publishTrade(supabase, webhook.user_id, version, openOrder, closeOrder.id, result.filledPrice ?? signal.price, isLiveAccount)
  }

  await supabase
    .from('automation_webhook_events')
    .update({ status: result.status === 'filled' ? 'processed' : 'error' })
    .eq('id', eventId)

  return { httpStatus: 200, body: { ok: true, status: 'position_closed', orderId: closeOrder?.id } }
}

/** Publishes the completed round-trip into the existing trades table — no
 * separate analytics store (design doc §9). Setting `strategy` to the
 * strategy's name means it shows up in Playbook's setup stats for free. */
async function publishTrade(
  supabase: SupabaseClient,
  userId: string,
  version: Record<string, unknown>,
  openOrder: Record<string, unknown>,
  closeOrderId: string,
  exitPrice: number,
  isLiveAccount: boolean | null,
) {
  const entry = Number(openOrder.filled_price ?? openOrder.requested_price)
  const qty = Number(openOrder.requested_qty)
  const sign = openOrder.side === 'long' ? 1 : -1
  const pnl = sign * (exitPrice - entry) * qty
  const returnPct = entry !== 0 ? (pnl / (entry * qty)) * 100 : 0

  const { data: riskEval } = await supabase
    .from('automation_risk_evaluations')
    .select('computed_risk_amount')
    .eq('webhook_event_id', openOrder.webhook_event_id as string)
    .maybeSingle()
  const riskAmount = riskEval?.computed_risk_amount ? Number(riskEval.computed_risk_amount) : null
  const rr = riskAmount && riskAmount > 0 ? pnl / riskAmount : null

  const { data: strategy } = await supabase
    .from('automation_strategies')
    .select('name')
    .eq('id', version.strategy_id as string)
    .single()

  await supabase.from('trades').insert({
    user_id: userId,
    trade_date: localDateStr(),
    symbol: openOrder.symbol,
    direction: openOrder.side === 'long' ? 'LONG' : 'SHORT',
    entry_price: entry,
    exit_price: exitPrice,
    pnl,
    return_pct: returnPct,
    rr,
    stop_loss: openOrder.sl,
    take_profit: openOrder.tp,
    strategy: strategy?.name ?? null,
    source: 'automatic',
    mode: version.mode,
    is_live_account: isLiveAccount,
    automation_strategy_version_id: version.id,
    automation_order_id: closeOrderId,
  })
}
