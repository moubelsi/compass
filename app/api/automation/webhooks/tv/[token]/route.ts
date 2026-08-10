import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import { processWebhookEvent } from '@/lib/automation/pipeline'

export const runtime = 'nodejs'

/**
 * Public TradingView ingest endpoint — deliberately outside /api/automation/**
 * (no logged-in user is possible here). TradingView alerts can't run code or
 * set custom headers, so a real HMAC-over-the-body signature isn't something
 * TradingView can produce — it can only embed static/placeholder text in the
 * alert JSON. Security here is therefore: (1) the long unguessable url_token
 * in the URL itself, plus (2) a per-webhook shared secret the user embeds as
 * a literal "secret" field in the alert_message JSON, checked with a
 * constant-time compare. Uses the service-role client because there's no
 * session to scope a cookie-based client to; never exposed beyond this file.
 *
 * Expected alert_message JSON:
 * { "secret": "<paste from the Webhook tab>", "ticker": "EURUSD",
 *   "side": "long", "price": 1.0854, "sl": 1.08, "tp": 1.095 }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createSupabaseServiceClient()

  const { data: webhook } = await supabase
    .from('automation_webhooks')
    .select('id, user_id, strategy_version_id, webhook_secret, is_active')
    .eq('url_token', token)
    .maybeSingle()

  if (!webhook || !webhook.is_active) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const rawBody = await req.text()
  let parsedBody: unknown
  try {
    parsedBody = rawBody.length > 0 ? JSON.parse(rawBody) : {}
  } catch {
    parsedBody = { _unparseable_raw_body: rawBody }
  }

  const providedSecret = typeof (parsedBody as Record<string, unknown>)?.secret === 'string'
    ? (parsedBody as Record<string, string>).secret
    : ''
  const secretValid = constantTimeStringEqual(providedSecret, webhook.webhook_secret)

  const result = await processWebhookEvent(supabase, webhook, parsedBody, secretValid)
  return NextResponse.json(result.body, { status: result.httpStatus })
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
