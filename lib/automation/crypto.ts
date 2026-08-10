import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Broker-credential encryption for automation_broker_accounts.credentials.
 * Application-level AES-256-GCM — chosen over Supabase Vault because Vault's
 * decrypted_secrets view isn't reachable through the REST client without an
 * extra dashboard schema-exposure step, and this needs to work reliably
 * without that. Decrypt only ever happens server-side, just-in-time, inside
 * the webhook pipeline — the plaintext never reaches the client or a log line.
 */

export interface EncryptedCredentials {
  method: 'aesgcm'
  iv: string
  authTag: string
  ciphertext: string
}

function getKey(): Buffer {
  const hex = process.env.AUTOMATION_CREDENTIALS_KEY
  if (!hex) throw new Error('AUTOMATION_CREDENTIALS_KEY is not set.')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) throw new Error('AUTOMATION_CREDENTIALS_KEY must be 32 bytes (64 hex characters).')
  return key
}

export function encryptCredentials(plaintext: Record<string, unknown>): EncryptedCredentials {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(plaintext), 'utf8')), cipher.final()])
  return {
    method: 'aesgcm',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
}

export function decryptCredentials<T = Record<string, unknown>>(stored: EncryptedCredentials): T {
  if (stored.method !== 'aesgcm') throw new Error(`Unsupported credential encryption method "${stored.method}".`)
  const key = getKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(stored.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(stored.authTag, 'base64'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(stored.ciphertext, 'base64')), decipher.final()])
  return JSON.parse(plaintext.toString('utf8'))
}

/** Run once to provision AUTOMATION_CREDENTIALS_KEY — not used at request time. */
export function generateCredentialsKey(): string {
  return randomBytes(32).toString('hex')
}
