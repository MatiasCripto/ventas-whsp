import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifySuperadmin } from '@/lib/superadmin/auth'

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
