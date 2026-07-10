import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { getConnectionState } from '@/lib/evolution/evolution-api'

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
    return NextResponse.json({ instance: { state: 'close' } })
  }
  const instanceName = store.evolution_instance

  try {
    const state = await getConnectionState(instanceName)
    return NextResponse.json({ instance: state ?? { state: 'close' } })
  } catch (err) {
    console.error('[EVO STATUS]', err)
    return NextResponse.json({ instance: { state: 'close' } })
  }
}
