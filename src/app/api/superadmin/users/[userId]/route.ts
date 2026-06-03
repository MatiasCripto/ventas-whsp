import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifySuperadmin } from '@/lib/superadmin/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  const { userId } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (body.full_name !== undefined) updates.full_name = body.full_name
  if (body.role !== undefined) {
    if (!['owner', 'admin', 'agent', 'viewer'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    updates.role = body.role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const sb = createServiceClient()
    const { error } = await sb.from('profiles').update(updates).eq('id', userId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SUPERADMIN] update user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  const { userId } = await params

  try {
    const sb = createServiceClient()
    await sb.from('profiles').delete().eq('id', userId)
    await sb.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SUPERADMIN] delete user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
