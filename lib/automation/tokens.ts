/** Isomorphic (browser + Node) random hex string generator via Web Crypto —
 * used to mint webhook url_token/webhook_secret client-side on version creation. */
function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 192 bits — unguessable, goes in the public webhook URL path. */
export function generateUrlToken(): string {
  return randomHex(24)
}

/** 256 bits — the shared secret pasted into the TradingView alert body. */
export function generateWebhookSecret(): string {
  return randomHex(32)
}
