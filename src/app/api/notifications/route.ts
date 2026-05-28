import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getOrgId(req?: NextRequest): Promise<string | null> {
  if (req) {
    const url = new URL(req.url)
    const paramOrgId = url.searchParams.get('orgId')
    if (paramOrgId) return paramOrgId
  }
  const sb = createServiceClient()
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const { data: profile } = await sb.from('profiles').select('organization_id').eq('id', user.id).single()
    if (profile) return profile.organization_id
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '50')
    const unreadOnly = url.searchParams.get('unread') === 'true'

    const sb = createServiceClient()
    let query = sb.from('notifications').select('*').eq('organization_id', orgId)

    if (unreadOnly) query = query.eq('read', false)

    const { data } = await query.order('created_at', { ascending: false }).limit(limit)
    const { count } = await sb.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('read', false)

    return NextResponse.json({ notifications: data ?? [], unreadCount: count ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, markAll } = body

    const sb = createServiceClient()
    if (markAll) {
      await sb.from('notifications').update({ read: true })
        .eq('organization_id', orgId)
        .eq('read', false)
    } else if (id) {
      await sb.from('notifications').update({ read: true }).eq('id', id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
