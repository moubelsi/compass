import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processWebhookEvent, type WebhookRow } from '@/lib/automation/pipeline'
import { getLivePricesForBrokerAccount } from '@/lib/automation/live-prices'

/**
 * Manual "close position" from the UI — runs the exact same pipeline a real
 * TradingView close signal would (risk check, execution, trade publishing),
 * just with a synthetic signal built server-side instead of a webhook POST.
 * `secretValid: true` is safe here because the caller already authenticated
 * as the owning user via the session-scoped client (RLS enforces ownership
 * on every read/write processWebhookEvent does) — the secret check exists
 * for the public, no-session webhook endpoint, not for this one.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Verify version exists (without user check, since we're using service key)
    const { data: versionCheck } = await supabase
      .from('automation_strategy_versions')
      .select('id')
      .eq('id', id)
      .single()
    if (!versionCheck) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const body = await req.json().catch(() => null)
    const symbol = body?.symbol
    if (typeof symbol !== 'string' || !symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

    const webhook = await supabase
      .from('automation_webhooks')
      .select('id, user_id, webhook_secret, strategy_version_id')
      .eq('strategy_version_id', id)
      .single()
      .then(r => r.data as (WebhookRow & { webhook_secret: string }) | null)
    if (!webhook) return NextResponse.json({ error: 'no webhook for this version' }, { status: 404 })

    const { data: version } = await supabase
      .from('automation_strategy_versions')
      .select('broker_account_id, automation_broker_accounts(broker, is_live)')
      .eq('id', id)
      .single()
    const account = version?.automation_broker_accounts as unknown as { broker: 'ctrader' | 'okx'; is_live: boolean } | null

    // Best-effort live price for the close order's informational "price" field
    // — the broker adapter reports the real fill price regardless of this.
    let price = 0
    if (version?.broker_account_id && account) {
      const prices = await getLivePricesForBrokerAccount(supabase, version.broker_account_id, account.broker, account.is_live, [symbol])
      price = prices[symbol] ?? 0
    }

    const rawBody = {
      secret: webhook.webhook_secret,
      ticker: symbol,
      side: 'close',
      price,
      id: `manual-close-${id}-${symbol}-${Date.now()}`,
    }

    const result = await processWebhookEvent(supabase, webhook, rawBody, true)
    return NextResponse.json(result.body, { status: result.httpStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Close endpoint error:', message, err)
    return NextResponse.json({ error: 'internal_error', details: message }, { status: 500 })
  }
}
