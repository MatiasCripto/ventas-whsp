import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { getQrCode } from '@/lib/evolution/evolution-api'
import { setWebhook } from '@/lib/bot/evolution-client'

const EVO_BASE = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
const EVO_KEY  = process.env.EVOLUTION_API_KEY  || ''

/** Safe fetch — returns null on non-ok instead of throwing. */
async function safeGet(path: string): Promise<any> {
  try {
    const res = await fetch(`${EVO_BASE}${path}`, {
      headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
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
    // 1) Check connection state (safe — returns null on any error)
    const stateData = await safeGet(`/instance/connectionState/${instanceName}`)
    const currentState = stateData?.instance?.state

    // Already connected
    if (currentState === 'open') {
      return NextResponse.json({ connected: true })
    }

    // 2) Try to get QR from existing instance
    const qr = await getQrCode(instanceName)
    if (qr) {
      return NextResponse.json({ base64: qr, state: 'connecting' })
    }

    // 3) Instance is connecting but no QR yet — poll will refresh
    if (currentState === 'connecting') {
      return NextResponse.json({ base64: null, state: 'connecting' })
    }

    // 4) Instance doesn't exist / closed / disconnected — create it
    await fetch(`${EVO_BASE}/instance/create`, {
      method: 'POST',
      headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceName, qrcode: true }),
    })
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://ventas24.nexoiarg.com'}/api/webhooks/whatsapp`
    await setWebhook(instanceName, webhookUrl)
    const freshQr = await getQrCode(instanceName)
    return NextResponse.json({ base64: freshQr, state: 'connecting' })
  } catch (err) {
    console.error('[EVO CONNECT]', err)
    return NextResponse.json({ error: 'Error al conectar con Evolution API' }, { status: 500 })
  }
}
