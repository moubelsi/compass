import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getAuthUrl } from '@/lib/brokers/ctrader/oauth'

/**
 * Starts a SEPARATE cTrader OAuth flow with scope=trading, distinct from
 * app/api/ctrader/login (scope=accounts, read-only import). Same client_id/
 * secret, different consent + tokens — the tokens land in
 * automation_broker_accounts, never broker_connections.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.nextUrl))

  const state = crypto.randomUUID()
  const redirectUri = `${req.nextUrl.origin}/api/automation/ctrader/callback`

  let authUrl: string
  try {
    authUrl = getAuthUrl(redirectUri, state, 'trading')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cTrader is not configured.'
    return NextResponse.redirect(new URL(`/automation/brokers?ctrader_error=${encodeURIComponent(msg)}`, req.nextUrl))
  }

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('automation_ctrader_oauth_state', state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/automation/ctrader',
  })
  return res
}
