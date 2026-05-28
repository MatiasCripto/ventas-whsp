import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getOrgId(): Promise<string | null> {
  const sb = createServiceClient()
  // Try real Supabase auth first
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const { data: profile } = await sb.from('profiles').select('organization_id').eq('id', user.id).single()
    if (profile) return profile.organization_id
  }
  // Dev mode fallback: use the first organization in the database
  if (process.env.NODE_ENV === 'development') {
    const { data: orgs } = await sb.from('organizations').select('id').limit(1)
    if (orgs?.[0]?.id) return orgs[0].id
  }
  return null
}

export async function GET() {
  try {
    const orgId = await getOrgId()
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const orgId = await getOrgId()
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
