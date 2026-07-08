import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { runSync, NoAccountSelectedError } from '@/lib/brokers/sync'
import { getFreshConnection, ReauthRequiredError } from '@/lib/brokers/ctrader/connection'
import { getProvider } from '@/lib/brokers'

export const maxDuration = 60

/**
 * GET — read-only diagnostic: runs the exact same scan the sync would run
 * (from the stored cursor, or ?since=<ms|ISO>) but saves nothing and does
 * not advance the cursor. Shows how many deals were found and why any
 * position was skipped.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await getFreshConnection(supabase)
    if (!conn) return NextResponse.json({ error: 'not_connected' }, { status: 404 })
    if (!conn.broker_account_id) return NextResponse.json({ error: 'no_account_selected' }, { status: 400 })

    const sinceParam = req.nextUrl.searchParams.get('since')
    const sinceMs = sinceParam
      ? (/^\d+$/.test(sinceParam) ? Number(sinceParam) : new Date(sinceParam).getTime())
      : Number(conn.last_deal_timestamp) || 0

    const account = conn.account_info?.accounts?.find(a => a.id === conn.broker_account_id)
    const batch = await getProvider('ctrader').importTrades({
      accessToken: conn.access_token,
      accountId: conn.broker_account_id,
      isLive: account ? !!account.isLive : true,
      sinceMs,
      deadlineMs: Date.now() + 40_000,
    })

    const dates = batch.trades.map(t => t.trade_date).sort()
    return NextResponse.json({
      note: 'dry run — nothing was saved, cursor not advanced',
      account: conn.broker_account_id,
      scanned_from: new Date(sinceMs > 0 ? sinceMs : 0).toISOString(),
      scan_complete: batch.done,
      stats: batch.stats,
      trades_reconstructed: batch.trades.length,
      oldest_trade: dates[0] ?? null,
      newest_trade: dates[dates.length - 1] ?? null,
    })
  } catch (e) {
    if (e instanceof ReauthRequiredError) return NextResponse.json({ error: 'reauth_required' }, { status: 401 })
    const msg = e instanceof Error ? e.message : 'Diagnostic failed.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

/**
 * POST — synchronize closed trades. First run imports the full account
 * history; later runs only fetch deals newer than the stored cursor.
 * Returns { imported, done } — callers repeat the request while !done.
 */
export async function POST() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await getFreshConnection(supabase)
    if (!conn) return NextResponse.json({ error: 'not_connected' }, { status: 404 })
    const outcome = await runSync(supabase, user.id, conn)
    return NextResponse.json(outcome)
  } catch (e) {
    if (e instanceof ReauthRequiredError) return NextResponse.json({ error: 'reauth_required', message: e.message }, { status: 401 })
    if (e instanceof NoAccountSelectedError) return NextResponse.json({ error: 'no_account_selected', message: e.message }, { status: 400 })
    const raw = e instanceof Error ? e.message : 'Sync failed.'
    const msg = /frequen|rate|blocked|too many|throttl/i.test(raw)
      ? 'cTrader is rate limiting requests. Wait a minute, then press Sync now — progress is saved.'
      : raw
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
