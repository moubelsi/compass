import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { exchangeCode } from '@/lib/brokers/ctrader/oauth'

/**
 * Exchanges the code, then stores the tokens in a short-lived httpOnly
 * cookie (not the database yet) and sends the user to the Brokers page to
 * pick WHICH account to save — a trading connection can cover several
 * accounts (demo + live), unlike the single-row read-only connection.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const toBrokers = (params: Record<string, string>) => {
    const dest = new URL('/automation/brokers', url)
    Object.entries(params).forEach(([k, v]) => dest.searchParams.set(k, v))
    const res = NextResponse.redirect(dest)
    res.cookies.delete('automation_ctrader_oauth_state')
    return res
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) {
    const reason = url.searchParams.get('error_description') || url.searchParams.get('error') || 'Authorization was cancelled.'
    return toBrokers({ ctrader_error: reason })
  }
  if (!state || state !== req.cookies.get('automation_ctrader_oauth_state')?.value) {
    return toBrokers({ ctrader_error: 'Security check failed. Please try connecting again.' })
  }

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', url))

  try {
    const tokens = await exchangeCode(code, `${url.origin}/api/automation/ctrader/callback`)
    const res = toBrokers({ ctrader_pending: '1' })
    res.cookies.set('automation_ctrader_pending', Buffer.from(JSON.stringify(tokens)).toString('base64'), {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 300,
      path: '/api/automation/ctrader',
    })
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed. Please try again.'
    return toBrokers({ ctrader_error: msg })
  }
}
