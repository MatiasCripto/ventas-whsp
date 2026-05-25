import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('organization_id')
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 })

  const sb = createServiceClient()
  const { data } = await sb
    .from('conversations')
    .select(`
      id, channel, status, human_takeover, last_message_at, created_at,
      customer:customers(id, full_name, phone)
    `)
    .eq('organization_id', orgId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}
