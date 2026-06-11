import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { logoutInstance } from '@/lib/evolution/evolution-api'

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
    console.warn('[EVO DISCONNECT] instance not found for org:', orgId, 'instance:', instanceName)
    return NextResponse.json({ error: 'Instancia no encontrada para esta organización' }, { status: 403 })
  }

  try {
    await logoutInstance(instanceName)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[EVO DISCONNECT]', err)
    return NextResponse.json({ ok: true })
  }
}
