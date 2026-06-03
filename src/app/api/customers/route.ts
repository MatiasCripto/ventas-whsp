import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccessWithParam } from '@/lib/auth/require-org'

export async function GET(req: NextRequest) {
  const auth = await requireOrgAccessWithParam(req, 'organization_id')
  if (!auth.authorized) return auth.response
  const orgId = auth.matchedOrgId!
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 })

  const sb = createServiceClient()
  const { data } = await sb
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAccessWithParam(req, 'organization_id')
  if (!auth.authorized) return auth.response

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb.from('customers').update(updates).eq('id', id).eq('organization_id', auth.orgId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
