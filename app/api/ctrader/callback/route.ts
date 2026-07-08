import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { exchangeCode } from '@/lib/brokers/ctrader/oauth'

/**
 * OAuth callback: verifies the CSRF state, exchanges the code for tokens and
 * stores them in broker_connections (RLS-scoped to the signed-in user).
 * On reconnect the existing row is updated; broker_account_id and the sync
 * cursor are intentionally left untouched so history is not re-imported.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const toSettings = (params: Record<string, string>) => {
    const dest = new URL('/settings', url)
    Object.entries(params).forEach(([k, v]) => dest.searchParams.set(k, v))
    const res = NextResponse.redirect(dest)
    res.cookies.delete('ctrader_oauth_state')
    return res
  }

  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) {
    const reason = url.searchParams.get('error_description') || url.searchParams.get('error') || 'Authorization was cancelled.'
    return toSettings({ ctrader_error: reason })
  }
  if (!state || state !== req.cookies.get('ctrader_oauth_state')?.value) {
    return toSettings({ ctrader_error: 'Security check failed. Please try connecting again.' })
  }

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', url))

  try {
    const tokens = await exchangeCode(code, `${url.origin}/api/ctrader/callback`)
    const { error } = await supabase
      .from('broker_connections')
      .upsert({
        user_id: user.id,
        broker: 'ctrader',
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,broker' })
    if (error) throw new Error(error.message)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed. Please try again.'
    return toSettings({ ctrader_error: msg })
  }

  return toSettings({ ctrader: 'connected' })
}
