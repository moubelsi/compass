import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processWebhookEvent, type WebhookRow } from '@/lib/automation/pipeline'

/**
 * Test/demo trade opener — simulates a TradingView webhook entry signal
 * to test the full execution flow without waiting for strategy signals.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const body = await req.json().catch(() => ({}))
    const { symbol = 'GER40', side = 'long', price, sl, tp } = body

    // Verify version exists
    const { data: versionCheck } = await supabase
      .from('automation_strategy_versions')
      .select('id')
      .eq('id', id)
      .single()
    if (!versionCheck) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Get webhook
    const webhook = await supabase
      .from('automation_webhooks')
      .select('id, user_id, webhook_secret, strategy_version_id')
      .eq('strategy_version_id', id)
      .single()
      .then(r => r.data as (WebhookRow & { webhook_secret: string }) | null)
    if (!webhook) return NextResponse.json({ error: 'no webhook for this version' }, { status: 404 })

    const entryPrice = price || 26100
    const slPrice = sl || (side === 'long' ? entryPrice - 100 : entryPrice + 100)
    const tpPrice = tp || (side === 'long' ? entryPrice + 100 : entryPrice - 100)

    const rawBody = {
      secret: webhook.webhook_secret,
      ticker: symbol,
      side,
      price: entryPrice,
      sl: slPrice,
      tp: tpPrice,
      id: `test-open-${id}-${symbol}-${Date.now()}`,
    }

    console.log('[test-open] Starting execution for version:', id, 'signal:', rawBody)

    // For test-open, force paper mode to avoid credential issues while testing UI
    const { data: version } = await supabase
      .from('automation_strategy_versions')
      .select('mode, broker_account_id')
      .eq('id', id)
      .single()
    const originalMode = version?.mode
    if (originalMode === 'live') {
      console.log('[test-open] Temporarily switching to paper mode for testing')
      await supabase.from('automation_strategy_versions').update({ mode: 'paper' }).eq('id', id)
    }

    const result = await processWebhookEvent(supabase, webhook, rawBody, true)

    // Restore original mode
    if (originalMode === 'live') {
      await supabase.from('automation_strategy_versions').update({ mode: 'live' }).eq('id', id)
    }
    console.log('[test-open] Pipeline result:', result)

    // Check the webhook event to see what happened
    const { data: event } = await supabase
      .from('automation_webhook_events')
      .select('id, status, rejection_reason')
      .eq('webhook_id', webhook.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    console.log('[test-open] Latest webhook event:', event)

    // Always check the actual order to see if execution succeeded
    const { data: order } = await supabase
      .from('automation_orders')
      .select('status, broker_response, symbol')
      .eq('strategy_version_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    console.log('[test-open] Latest order:', order)

    if (order && order.status !== 'filled') {
      let brokerError = 'Unknown error'
      if (typeof order.broker_response === 'object' && order.broker_response !== null) {
        const resp = order.broker_response as Record<string, unknown>
        brokerError = String(resp.error ?? resp.message ?? JSON.stringify(resp))
      } else if (order.broker_response) {
        brokerError = String(order.broker_response)
      }
      console.error('[test-open] Execution failed with status=' + order.status, 'error=' + brokerError)
      return NextResponse.json({
        ok: false,
        error: 'execution_failed',
        broker_error: brokerError,
        order_status: order.status,
      }, { status: 200 })
    }

    return NextResponse.json(result.body, { status: result.httpStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Test open error:', message, err)
    return NextResponse.json({ error: 'internal_error', details: message }, { status: 500 })
  }
}
