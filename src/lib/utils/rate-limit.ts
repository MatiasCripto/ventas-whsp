// ── Database-backed rate limiter ─────────────────────────────
// Uses Supabase's rate_limits table + atomic increment function.
// Works across multi-instance deployments (Vercel, Render, etc.)
// where an in-memory Map would reset on every cold start.
// ────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'

export interface RateLimitOptions {
  windowMs: number
  maxHits: number
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const sb = createServiceClient()
    const windowStart = new Date(
      Math.floor(Date.now() / options.windowMs) * options.windowMs
    ).toISOString()

    const { data, error } = await sb.rpc('increment_rate_limit', {
      p_key: key,
      p_window_start: windowStart,
      p_max_hits: options.maxHits,
    })

    if (error) {
      console.warn('[RATE_LIMIT] RPC error, allowing:', error.message)
      return { allowed: true, remaining: options.maxHits }
    }

    const row = Array.isArray(data) ? data[0] : data
    return {
      allowed: row?.allowed ?? true,
      remaining: row?.remaining ?? options.maxHits,
    }
  } catch (err) {
    console.warn('[RATE_LIMIT] unexpected error, allowing:', err)
    return { allowed: true, remaining: options.maxHits }
  }
}
