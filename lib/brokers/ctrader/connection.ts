import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshAccessToken } from './oauth'

export interface BrokerConnectionRow {
  id: string
  user_id: string
  broker: string
  broker_account_id: string | null
  access_token: string
  refresh_token: string
  expires_at: string
  account_info: { accounts?: Array<Record<string, any>>; fetched_at?: string } | null
  last_synced_at: string | null
  last_deal_timestamp: number
}

/** Thrown when the user must go through the OAuth flow again (revoked/expired grant). */
export class ReauthRequiredError extends Error {
  constructor(message = 'Your cTrader authorization has expired. Please reconnect.') {
    super(message)
    this.name = 'ReauthRequiredError'
  }
}

/**
 * Loads the signed-in user's cTrader connection (RLS scopes the query) and
 * transparently refreshes the access token when it is about to expire.
 * Returns null when the user has never connected cTrader.
 */
export async function getFreshConnection(supabase: SupabaseClient): Promise<BrokerConnectionRow | null> {
  const { data, error } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('broker', 'ctrader')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const conn = data as BrokerConnectionRow
  if (new Date(conn.expires_at).getTime() > Date.now()) return conn

  let tokens
  try {
    tokens = await refreshAccessToken(conn.refresh_token)
  } catch {
    // Refresh token rejected — the grant was revoked or fully expired
    throw new ReauthRequiredError()
  }

  const { data: updated, error: updateError } = await supabase
    .from('broker_connections')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id)
    .select('*')
    .single()
  if (updateError) throw new Error(updateError.message)
  return updated as BrokerConnectionRow
}
