import type { BrokerTokens } from '../types'

/**
 * cTrader Open API OAuth 2.0 (Spotware).
 * Consent screen lives on id.ctrader.com; token exchange on openapi.ctrader.com.
 * Scope 'accounts' grants read access to trading data — enough for a journal,
 * and deliberately NOT enough to place orders.
 */
const AUTH_URL  = 'https://id.ctrader.com/my/settings/openapi/grantingaccess/'
const TOKEN_URL = 'https://openapi.ctrader.com/apps/token'

function credentials() {
  const clientId = process.env.CTRADER_CLIENT_ID
  const clientSecret = process.env.CTRADER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('cTrader is not configured. Set CTRADER_CLIENT_ID and CTRADER_CLIENT_SECRET.')
  }
  return { clientId, clientSecret }
}

export function getAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = credentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'accounts',
    state,
  })
  return `${AUTH_URL}?${params}`
}

async function requestToken(params: Record<string, string>): Promise<BrokerTokens> {
  const { clientId, clientSecret } = credentials()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret }),
  })
  const data = await res.json().catch(() => null)
  if (!data) throw new Error(`cTrader token endpoint returned an invalid response (HTTP ${res.status}).`)

  // Spotware responds with camelCase; be tolerant of snake_case variants
  const accessToken  = data.accessToken ?? data.access_token
  const refreshToken = data.refreshToken ?? data.refresh_token ?? params.refresh_token
  const expiresIn    = Number(data.expiresIn ?? data.expires_in ?? 0)

  if (!res.ok || !accessToken) {
    const reason = data.description || data.error_description || data.errorCode || data.error || `HTTP ${res.status}`
    throw new Error(`cTrader authorization failed: ${reason}`)
  }
  return {
    accessToken,
    refreshToken,
    // Refresh 5 minutes early so a token never expires mid-sync
    expiresAt: new Date(Date.now() + Math.max(expiresIn - 300, 60) * 1000).toISOString(),
  }
}

export function exchangeCode(code: string, redirectUri: string): Promise<BrokerTokens> {
  return requestToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export function refreshAccessToken(refreshToken: string): Promise<BrokerTokens> {
  return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken })
}
