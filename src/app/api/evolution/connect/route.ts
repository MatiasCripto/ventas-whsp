import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { getQrCode, getConnectionState } from '@/lib/evolution/evolution-api'
import { createInstance as createSimpleInstance, setWebhook } from '@/lib/bot/evolution-client'

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
    return NextResponse.json({ error: 'No hay instancia de WhatsApp configurada para esta tienda' }, { status: 404 })
  }
  const instanceName = store.evolution_instance

  try {
    // 1) Check connection state
    const state = await getConnectionState(instanceName)
    const currentState = state?.state

    // Already connected
    if (currentState === 'open') {
      return NextResponse.json({ connected: true })
    }

    // 2) Try to get QR from existing instance
    const qr = await getQrCode(instanceName)
    if (qr) {
      return NextResponse.json({ base64: qr, state: 'connecting' })
    }

    // 3) Instance exists but no QR yet — still connecting, poll will refresh
    if (currentState === 'connecting') {
      return NextResponse.json({ base64: null, state: 'connecting' })
    }

    // 4) Instance is closed/disconnected — recreate it
    if (currentState === 'close' || !state) {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://ventas24.nexoiarg.com'}/api/webhooks/whatsapp`
      await createSimpleInstance(instanceName)
      await setWebhook(instanceName, webhookUrl)
      const freshQr = await getQrCode(instanceName)
      return NextResponse.json({ base64: freshQr, state: 'connecting' })
    }

    return NextResponse.json({ base64: null, state: 'connecting' })
  } catch (err) {
    console.error('[EVO CONNECT]', err)
    return NextResponse.json({ error: 'Error al conectar con Evolution API' }, { status: 500 })
  }
}
