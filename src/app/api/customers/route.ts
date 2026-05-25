import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('organization_id')
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
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb.from('customers').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
