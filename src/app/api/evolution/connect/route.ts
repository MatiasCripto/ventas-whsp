import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import {
  ensureInstance,
  getQrCode,
  deleteInstance,
  createInstance,
  fetchInstances,
} from '@/lib/evolution/evolution-api'

export async function GET(req: NextRequest) {
  const auth = await requireOrgAccess(req)
  if (!auth.authorized) return auth.response
  const orgId = auth.orgId

  const instanceName = process.env.EVOLUTION_INSTANCE || 'concierge-wpp'
  const webhookUrl = `http://host.docker.internal:3010/api/webhooks/whatsapp`

  // Verify the instance belongs to a store in the authenticated org
  const sb = createServiceClient()
  const { data: store } = await sb.from('stores')
    .select('id')
    .eq('organization_id', orgId)
    .eq('evolution_instance', instanceName)
    .maybeSingle()
  if (!store) {
    console.warn('[EVO CONNECT] instance not found for org:', orgId, 'instance:', instanceName)
    return NextResponse.json({ error: 'Instancia no encontrada para esta organización' }, { status: 403 })
  }

  try {
    // 1) Try normal flow — create if missing, return QR
    const result = await ensureInstance(instanceName, webhookUrl)
    if (result.qrBase64) {
      return NextResponse.json({ base64: result.qrBase64, state: 'connecting' })
    }

    const currentState = result.state?.state

    // Already connected
    if (currentState === 'open') {
      return NextResponse.json({ connected: true })
    }

    // 2) Try standalone QR endpoint (works on some versions)
    const qr = await getQrCode(instanceName)
    if (qr) {
      return NextResponse.json({ base64: qr, state: 'connecting' })
    }

    // 3) Only recreate if instance is actually dead/disconnected
    if (currentState === 'close') {
      await deleteInstance(instanceName)
      await new Promise(r => setTimeout(r, 1000))
      const createRes = await createInstance(instanceName, webhookUrl)
      const freshQr = createRes?.qrcode?.base64 ?? null
      return NextResponse.json({ base64: freshQr, state: 'connecting' })
    }

    // Still connecting — leave it alone, dashboard keeps the existing QR
    return NextResponse.json({ base64: null, state: 'connecting' })
  } catch (err) {
    console.error('[EVO CONNECT]', err)
    return NextResponse.json({ error: 'Error al conectar con Evolution API' }, { status: 500 })
  }
}
