import { createHmac } from 'crypto'

/**
 * Minimal signed-REST client for the MEXC Contract (futures) API.
 * Signature: hex(HMAC-SHA256(secret, accessKey + timestamp + paramString))
 * where paramString is the query string with keys in dictionary order
 * (GET/DELETE) or the raw JSON body (POST).
 */

const BASE = 'https://contract.mexc.com'

export interface MexcApiError extends Error {
  code?: number
}

function apiError(message: string, code?: number): MexcApiError {
  const err = new Error(message) as MexcApiError
  err.code = code
  return err
}

export async function mexcGet(
  apiKey: string,
  apiSecret: string,
  path: string,
  params: Record<string, string | number> = {},
): Promise<any> {
  const sorted = Object.keys(params).sort()
  const query = sorted.map(k => `${k}=${params[k]}`).join('&')
  const timestamp = String(Date.now())
  const signature = createHmac('sha256', apiSecret)
    .update(apiKey + timestamp + query)
    .digest('hex')

  const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, {
    headers: {
      'ApiKey': apiKey,
      'Request-Time': timestamp,
      'Signature': signature,
      'Content-Type': 'application/json',
    },
  })

  const data = await res.json().catch(() => null)
  if (!data) throw apiError(`MEXC returned an invalid response (HTTP ${res.status}).`)
  if (data.success === false || (data.code !== undefined && Number(data.code) !== 0)) {
    // Common codes: 401/602 signature or key invalid, 510 rate limit
    const code = Number(data.code)
    const message =
      code === 401 || code === 602 ? 'MEXC rejected the API key or secret. Check both values and make sure the key has futures read permission.'
      : code === 510 ? 'MEXC is rate limiting requests. Try again in a minute.'
      : `MEXC error: ${data.message || data.msg || `code ${data.code}`}`
    throw apiError(message, code)
  }
  return data.data
}

/** Cheap authenticated call used to validate credentials. */
export async function fetchAssets(apiKey: string, apiSecret: string): Promise<Array<Record<string, any>>> {
  const data = await mexcGet(apiKey, apiSecret, '/api/v1/private/account/assets')
  return Array.isArray(data) ? data : []
}

/** One page of historical (closed) positions, newest first. */
export async function fetchHistoryPositions(
  apiKey: string,
  apiSecret: string,
  pageNum: number,
  pageSize = 100,
): Promise<Array<Record<string, any>>> {
  const data = await mexcGet(apiKey, apiSecret, '/api/v1/private/position/list/history_positions', {
    page_num: pageNum,
    page_size: pageSize,
  })
  // Some deployments wrap the list, others return it directly
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.resultList)) return data.resultList
  return []
}
