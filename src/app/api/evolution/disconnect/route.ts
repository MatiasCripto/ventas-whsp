import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { logoutInstance } from '@/lib/evolution/evolution-api'

export async function GET(req: NextRequest) {
  const auth = await requireOrgAccess(req)
  if (!auth.authorized) return auth.response
  const orgId = auth.orgId

  // Load instance name from the store DB record (multi-tenant)
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

  try {
    await logoutInstance(instanceName)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[EVO DISCONNECT]', err)
    return NextResponse.json({ ok: true })
  }
}
