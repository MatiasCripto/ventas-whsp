import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function verifySuperadmin(
  req: NextRequest,
): Promise<{ authorized: true; userId: string } | { authorized: false; response: NextResponse }> {
  const sb = createServiceClient()

  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  if (authHeader) {
    const { data: { user }, error } = await sb.auth.getUser(authHeader)
    if (error || !user) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      }
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'superadmin') {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      }
    }

    return { authorized: true, userId: user.id }
  }

  const { data: { user }, error } = await sb.auth.getUser()
  if (error || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'superadmin') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { authorized: true, userId: user.id }
}
