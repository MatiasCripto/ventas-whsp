import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'

const EVO_BASE = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
const EVO_KEY  = process.env.EVOLUTION_API_KEY  || ''

async function evoFetch(path: string, opts?: RequestInit): Promise<any> {
  try {
    const res = await fetch(`${EVO_BASE}${path}`, {
      headers: { apikey: EVO_KEY },
      ...opts,
    })
    if (!res.ok) return null
    const text = await res.text()
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireOrgAccess(req)
  if (!auth.authorized) return auth.response
  const orgId = auth.orgId

  const sb = createServiceClient()
  const { data: store } = await sb.from('stores')
    .select('evolution_instance')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle()
  if (!store?.evolution_instance) {
    return NextResponse.json({ ok: true })
  }
  const instanceName = store.evolution_instance

  await evoFetch(`/instance/logout/${instanceName}`, { method: 'DELETE' })
  return NextResponse.json({ ok: true })
}
