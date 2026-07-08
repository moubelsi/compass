import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getAuthUrl } from '@/lib/brokers/ctrader/oauth'

/**
 * Starts the cTrader OAuth flow: verifies the Compass session, sets a CSRF
 * state cookie and redirects to the cTrader consent screen. The redirect URI
 * is derived from the request origin, so the same code works on localhost
 * and production (both URIs must be registered in the cTrader application).
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.nextUrl))

  const state = crypto.randomUUID()
  const redirectUri = `${req.nextUrl.origin}/api/ctrader/callback`

  let authUrl: string
  try {
    authUrl = getAuthUrl(redirectUri, state)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cTrader is not configured.'
    return NextResponse.redirect(new URL(`/settings?ctrader_error=${encodeURIComponent(msg)}`, req.nextUrl))
  }

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('ctrader_oauth_state', state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/ctrader',
  })
  return res
}
