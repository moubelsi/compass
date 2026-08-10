import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS entirely. Use ONLY in the
 * webhook ingest route (app/api/automation/webhooks/tv/[token]/route.ts),
 * which has no logged-in user to scope a cookie-based client to, and only
 * AFTER that route has verified the webhook token + HMAC signature itself.
 * Never import this in client components or in any route reachable without
 * that check — it has no per-user access control of its own.
 */
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
