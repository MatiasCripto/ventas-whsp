import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifySuperadmin } from '@/lib/superadmin/auth'
import { generateTempPassword } from '@/lib/superadmin/utils'

export async function GET(req: NextRequest) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  try {
    const sb = createServiceClient()

    const { data: profiles } = await sb
      .from('profiles')
      .select('id, full_name, role, created_at, organization_id, organizations:organizations(name)')
      .order('created_at', { ascending: false })

    if (!profiles) return NextResponse.json([])

    const users = profiles.map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role,
      organization_id: p.organization_id,
      organization_name: (p.organizations as any)?.name ?? '—',
      created_at: p.created_at,
    }))

    return NextResponse.json(users)
  } catch (err) {
    console.error('[SUPERADMIN] users list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { organization_id, email, full_name, role } = body
  if (!organization_id || !email || !full_name || !role) {
    return NextResponse.json({ error: 'Missing required fields: organization_id, email, full_name, role' }, { status: 400 })
  }

  if (!['owner', 'admin', 'agent', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const sb = createServiceClient()
  const tempPassword = generateTempPassword()

  try {
    const { data: authData, error: authError } = await sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })
    if (authError) throw new Error(`Auth error: ${authError.message}`)

    const { error: profileError } = await sb.from('profiles').insert({
      id: authData.user.id,
      organization_id,
      full_name,
      role,
    })
    if (profileError) {
      await sb.auth.admin.deleteUser(authData.user.id).catch(() => {})
      throw new Error(`Profile error: ${profileError.message}`)
    }

    return NextResponse.json({
      id: authData.user.id,
      temp_password: tempPassword,
    })
  } catch (err) {
    console.error('[SUPERADMIN] create user error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
