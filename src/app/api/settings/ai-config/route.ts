import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto/encryption'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response
    const orgId = auth.orgId

    const sb = createServiceClient()
    const { data: org } = await sb.from('organizations').select('settings').eq('id', orgId).single()
    const ai = (org?.settings as Record<string, any> | null)?.ai ?? null
    // Decrypt the key for display (masked) — needed for the "••••LAST4" preview
    const rawKey = ai?.apiKey ? decrypt(ai.apiKey) : ''
    return NextResponse.json({
      provider: ai?.provider ?? '',
      apiKey: rawKey ? '••••' + rawKey.slice(-4) : '',
      model: ai?.model ?? '',
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response
    const orgId = auth.orgId

    const { provider, apiKey, model } = await req.json()
    if (!provider || !apiKey) return NextResponse.json({ error: 'provider and apiKey required' }, { status: 400 })

    const sb = createServiceClient()
    const { data: org } = await sb.from('organizations').select('settings').eq('id', orgId).single()
    const settings = (org?.settings as Record<string, any>) ?? {}

    // Encrypt the API key before storing, unless it's already encrypted
    // (when the UI sends back the masked "••••LAST4" key without changes)
    const finalKey = isEncrypted(apiKey) ? apiKey : encrypt(apiKey)

    await sb.from('organizations').update({
      settings: { ...settings, ai: { provider, apiKey: finalKey, model: model || 'gpt-4o' } },
    }).eq('id', orgId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
