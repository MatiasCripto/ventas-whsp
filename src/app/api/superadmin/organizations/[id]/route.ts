import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifySuperadmin } from '@/lib/superadmin/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  const { id } = await params

  try {
    const sb = createServiceClient()

    const { data: org } = await sb
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { data: stores } = await sb
      .from('stores')
      .select('*')
      .eq('organization_id', id)

    const { data: profiles } = await sb
      .from('profiles')
      .select('*')
      .eq('organization_id', id)

    const { data: recentOrders } = await sb
      .from('orders')
      .select('*')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    // AI config (mask API key)
    const settings = (org.settings as Record<string, any>) ?? {}
    const ai = settings.ai as Record<string, any> | undefined

    return NextResponse.json({
      ...org,
      stores: stores ?? [],
      profiles: profiles ?? [],
      recent_orders: recentOrders ?? [],
      ai_config: ai
        ? {
            provider: ai.provider ?? '',
            api_key_preview: ai.apiKey ? (ai.apiKey as string).slice(0, 8) + '...' : '',
            model: ai.model ?? '',
          }
        : null,
    })
  } catch (err) {
    console.error('[SUPERADMIN] org detail error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.active !== undefined) updates.active = !!body.active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const sb = createServiceClient()
    const { error } = await sb.from('organizations').update(updates).eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SUPERADMIN] org update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  const { id } = await params

  try {
    const sb = createServiceClient()

    // Get all profiles for this org to delete auth users
    const { data: profiles } = await sb
      .from('profiles')
      .select('id')
      .eq('organization_id', id)

    // Delete stores
    await sb.from('stores').delete().eq('organization_id', id)

    // Delete profiles
    await sb.from('profiles').delete().eq('organization_id', id)

    // Delete organization
    await sb.from('organizations').delete().eq('id', id)

    // Delete auth users (best effort)
    if (profiles) {
      for (const p of profiles) {
        await sb.auth.admin.deleteUser(p.id).catch((err) => console.error('[SUPERADMIN] failed to delete auth user:', p.id, err))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SUPERADMIN] org delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
