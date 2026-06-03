import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response

    const { orgName, storeName, whatsappNumber, evolutionInstance, logoUrl } = await req.json()
    const sb = createServiceClient()

    // Find the store — filtered by the authenticated user's organization
    let storeId: string | null = null
    let orgId: string | null = null
    if (evolutionInstance) {
      const { data } = await sb.from('stores').select('id, organization_id').eq('evolution_instance', evolutionInstance).eq('organization_id', auth.orgId).maybeSingle()
      if (data) { storeId = data.id; orgId = data.organization_id }
    } else {
      const { data } = await sb.from('stores').select('id, organization_id').eq('organization_id', auth.orgId).limit(1).maybeSingle()
      if (data) { storeId = data.id; orgId = data.organization_id }
    }
    if (!storeId || !orgId) {
      return NextResponse.json({ error: 'No store found' }, { status: 404 })
    }

    if (orgName) {
      await sb.from('organizations').update({ name: orgName }).eq('id', orgId)
    }
    const updates: Record<string, string | null> = {}
    if (storeName) updates.name = storeName
    if (whatsappNumber !== undefined) updates.whatsapp_number = whatsappNumber
    if (evolutionInstance !== undefined) updates.evolution_instance = evolutionInstance
    if (logoUrl !== undefined) updates.logo_url = logoUrl
    if (Object.keys(updates).length > 0) {
      await sb.from('stores').update(updates).eq('id', storeId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Settings Store API]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
