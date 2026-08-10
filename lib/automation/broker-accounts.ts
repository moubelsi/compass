import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptCredentials, encryptCredentials, type EncryptedCredentials } from './crypto'
import { refreshAccessToken } from '@/lib/brokers/ctrader/oauth'

export interface BrokerAccountRow {
  id: string
  user_id: string
  broker: 'ctrader' | 'okx'
  label: string
  is_live: boolean
  credentials: EncryptedCredentials
  status: string
}

export interface CTraderStoredCreds {
  accessToken: string
  refreshToken: string
  expiresAt: string
  ctidTraderAccountId: number
}

export interface OkxStoredCreds {
  apiKey: string
  apiSecret: string
  passphrase: string
}

/**
 * Loads a cTrader automation account and transparently refreshes an
 * expiring access token — same idea as lib/brokers/ctrader/connection.ts's
 * getFreshConnection for the read-only import flow, just against
 * automation_broker_accounts instead of broker_connections (kept separate
 * on purpose, see the M2 plan).
 */
export async function getFreshCTraderCredentials(
  supabase: SupabaseClient,
  brokerAccountId: string,
): Promise<{ accessToken: string; ctidTraderAccountId: number } | null> {
  const { data: account } = await supabase
    .from('automation_broker_accounts')
    .select('*')
    .eq('id', brokerAccountId)
    .eq('broker', 'ctrader')
    .single()
  if (!account) return null

  let creds = decryptCredentials<CTraderStoredCreds>(account.credentials)
  if (new Date(creds.expiresAt).getTime() <= Date.now()) {
    const tokens = await refreshAccessToken(creds.refreshToken)
    creds = { ...creds, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt }
    await supabase
      .from('automation_broker_accounts')
      .update({ credentials: encryptCredentials(creds as unknown as Record<string, unknown>) })
      .eq('id', brokerAccountId)
  }
  return { accessToken: creds.accessToken, ctidTraderAccountId: creds.ctidTraderAccountId }
}

/** API keys don't expire the way OAuth tokens do — no refresh needed. */
export async function getOkxCredentials(supabase: SupabaseClient, brokerAccountId: string): Promise<OkxStoredCreds | null> {
  const { data: account } = await supabase
    .from('automation_broker_accounts')
    .select('*')
    .eq('id', brokerAccountId)
    .eq('broker', 'okx')
    .single()
  if (!account) return null
  return decryptCredentials<OkxStoredCreds>(account.credentials)
}

export async function writeAuditLog(supabase: SupabaseClient, userId: string, action: string, detail: Record<string, unknown> = {}) {
  await supabase.from('automation_audit_log').insert({ user_id: userId, action, detail })
}
