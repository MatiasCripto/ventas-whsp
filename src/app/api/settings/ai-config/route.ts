import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response
    const orgId = auth.orgId

    const sb = createServiceClient()
    const { data: org } = await sb.from('organizations').select('settings').eq('id', orgId).single()
    const ai = (org?.settings as Record<string, any> | null)?.ai ?? null
    return NextResponse.json({
      provider: ai?.provider ?? '',
      apiKey: ai?.apiKey ? '••••' + ai.apiKey.slice(-4) : '',
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

    await sb.from('organizations').update({
      settings: { ...settings, ai: { provider, apiKey, model: model || 'gpt-4o' } },
    }).eq('id', orgId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
