import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { getConnectionState, fetchInstances } from '@/lib/evolution/evolution-api'

export async function GET(req: NextRequest) {
  const auth = await requireOrgAccess(req)
  if (!auth.authorized) return auth.response
  const orgId = auth.orgId

  const instanceName = process.env.EVOLUTION_INSTANCE || 'concierge-wpp'

  // Verify the instance belongs to a store in the authenticated org
  const sb = createServiceClient()
  const { data: store } = await sb.from('stores')
    .select('id')
    .eq('organization_id', orgId)
    .eq('evolution_instance', instanceName)
    .maybeSingle()
  if (!store) {
    // Don't leak whether the instance exists — just return "closed"
    return NextResponse.json({ instance: { state: 'close' } })
  }

  try {
    const instances = await fetchInstances()
    const existing = instances.find((i: any) => i.name === instanceName)

    if (!existing) {
      return NextResponse.json({ instance: { state: 'close' } })
    }

    const state = await getConnectionState(instanceName)
    return NextResponse.json({ instance: state ?? { state: 'close' } })
  } catch (err) {
    console.error('[EVO STATUS]', err)
    return NextResponse.json({ instance: { state: 'close' } })
  }
}
