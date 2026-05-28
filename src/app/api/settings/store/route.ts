import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { orgName, storeName, whatsappNumber, evolutionInstance } = await req.json()
    const sb = createServiceClient()

    // Find the store — by evolution_instance if provided, otherwise first store in DB
    let storeId: string | null = null
    let orgId: string | null = null
    if (evolutionInstance) {
      const { data } = await sb.from('stores').select('id, organization_id').eq('evolution_instance', evolutionInstance).maybeSingle()
      if (data) { storeId = data.id; orgId = data.organization_id }
    }
    if (!storeId) {
      const { data } = await sb.from('stores').select('id, organization_id').limit(1).maybeSingle()
      if (data) { storeId = data.id; orgId = data.organization_id }
    }
    if (!storeId || !orgId) {
      return NextResponse.json({ error: 'No store found' }, { status: 404 })
    }

    if (orgName) {
      await sb.from('organizations').update({ name: orgName }).eq('id', orgId)
    }
    const updates: Record<string, string> = {}
    if (storeName) updates.name = storeName
    if (whatsappNumber !== undefined) updates.whatsapp_number = whatsappNumber
    if (evolutionInstance !== undefined) updates.evolution_instance = evolutionInstance
    if (Object.keys(updates).length > 0) {
      await sb.from('stores').update(updates).eq('id', storeId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Settings Store API]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
