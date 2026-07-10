import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { setWebhook } from '@/lib/bot/evolution-client'

const EVO_BASE = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
const EVO_KEY  = process.env.EVOLUTION_API_KEY  || ''

async function evoFetch(path: string, opts?: RequestInit): Promise<any> {
  try {
    const res = await fetch(`${EVO_BASE}${path}`, {
      headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
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

  // Load instance name from the store DB record (multi-tenant)
  const sb = createServiceClient()
  const { data: store } = await sb.from('stores')
    .select('evolution_instance')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle()
  if (!store?.evolution_instance) {
    return NextResponse.json({ error: 'No hay instancia de WhatsApp configurada' }, { status: 404 })
  }
  const instanceName = store.evolution_instance

  // 1) Check current state
  const stateData = await evoFetch(`/instance/connectionState/${instanceName}`)
  const currentState = stateData?.instance?.state

  // Already connected
  if (currentState === 'open') {
    return NextResponse.json({ connected: true })
  }

  // 2) If connecting, try to get existing QR
  if (currentState === 'connecting') {
    const qr = await evoFetch(`/instance/qrcode/${instanceName}?base64=true`)
    const base64 = qr?.base64 ?? qr?.qrcode?.base64 ?? null
    return NextResponse.json({ base64, state: 'connecting' })
  }

  // 3) Instance is closed/missing — delete + recreate with QR
  await evoFetch(`/instance/delete/${instanceName}`, { method: 'DELETE' })
  await new Promise(r => setTimeout(r, 500))

  const createRes = await evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({ instanceName, qrcode: true }),
  })

  // Configure webhook
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://ventas24.nexoiarg.com'}/api/webhooks/whatsapp`
  await setWebhook(instanceName, webhookUrl)

  // Return QR from create response or fetch separately
  const qrBase64 = createRes?.qrcode?.base64 ?? null
  if (qrBase64) {
    return NextResponse.json({ base64: qrBase64, state: 'connecting' })
  }

  // Poll a few times for the QR
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const qrData = await evoFetch(`/instance/qrcode/${instanceName}?base64=true`)
    const b64 = qrData?.base64 ?? qrData?.qrcode?.base64 ?? null
    if (b64) return NextResponse.json({ base64: b64, state: 'connecting' })
  }

  return NextResponse.json({ base64: null, state: 'connecting' })
}
