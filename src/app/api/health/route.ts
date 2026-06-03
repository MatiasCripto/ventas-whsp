import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const checks: Record<string, string | boolean | Record<string, boolean>> = {}
  let healthy = true

  // 1. Check Supabase connectivity
  try {
    const sb = createServiceClient()
    const { error } = await sb.from('organizations').select('id').limit(1)
    checks.supabase = error ? `error: ${error.message}` : true
    if (error) healthy = false
  } catch (err) {
    checks.supabase = `error: ${err instanceof Error ? err.message : String(err)}`
    healthy = false
  }

  // 2. Check required env vars
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_KEY',
  ] as const
  const envChecks: Record<string, boolean> = {}
  for (const v of requiredVars) {
    envChecks[v] = !!process.env[v] && !process.env[v]!.includes('placeholder')
  }
  checks.env_vars = envChecks
  if (Object.values(envChecks).some((v) => !v)) healthy = false

  // 3. Check Evolution API status (optional — don't fail health if Evolution is down)
  try {
    const evoUrl = process.env.EVOLUTION_API_URL
    const evoKey = process.env.EVOLUTION_API_KEY
    const instance = process.env.EVOLUTION_INSTANCE ?? 'concierge'
    if (evoUrl && evoKey && !evoUrl.includes('placeholder')) {
      const res = await fetch(`${evoUrl}/instance/connectionState/${instance}`, {
        headers: { apikey: evoKey },
        signal: AbortSignal.timeout(5000),
      })
      checks.evolution_api = res.ok ? true : `http ${res.status}`
    } else {
      checks.evolution_api = 'not configured'
    }
  } catch (err) {
    checks.evolution_api = `error: ${err instanceof Error ? err.message : String(err)}`
  }

  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: healthy ? 200 : 503 })
}
