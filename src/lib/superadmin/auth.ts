import { createServiceClient } from '@/lib/supabase/service'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function verifySuperadmin(
  req: NextRequest,
): Promise<{ authorized: true; userId: string } | { authorized: false; response: NextResponse }> {
  const sb = createServiceClient()

  // Try Bearer token first
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

  // Fallback: read session from cookies via SSR client
  const cookieClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() { /* read-only — no need to set cookies here */ },
      },
    },
  )

  const { data: { user }, error } = await cookieClient.auth.getUser()
  if (error || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // Verify role with service_role (bypasses RLS)
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
