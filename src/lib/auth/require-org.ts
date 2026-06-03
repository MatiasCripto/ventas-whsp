import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'

type AuthSuccess = { authorized: true; orgId: string; userId: string }
type AuthFailure = { authorized: false; response: NextResponse }
export type AuthResult = AuthSuccess | AuthFailure

/**
 * Validates the user's session from request cookies and returns their org ID.
 * All dashboard API routes should call this first.
 */
export async function requireOrgAccess(req: NextRequest): Promise<AuthResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || supabaseUrl.includes('placeholder') || !anonKey) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Supabase not configured' }, { status: 500 }),
      }
    }

    const cookieClient = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() { /* read-only — no need to set cookies here */ },
      },
    })

    const { data: { user }, error } = await cookieClient.auth.getUser()
    if (error || !user) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      }
    }

    // Get org_id from profile using service client (bypasses RLS)
    const sb = createServiceClient()
    const { data: profile } = await sb
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'No organization found for user' }, { status: 403 }),
      }
    }

    return { authorized: true, orgId: profile.organization_id, userId: user.id }
  } catch (err) {
    console.error('[AUTH] requireOrgAccess error:', err)
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Authentication failed' }, { status: 500 }),
    }
  }
}

/**
 * Validates the user's session and checks they belong to the org specified
 * in the `organization_id` (or `orgId`) query parameter.
 */
export async function requireOrgAccessWithParam(
  req: NextRequest,
  paramName: 'organization_id' | 'orgId' = 'organization_id',
): Promise<AuthResult & { matchedOrgId?: string }> {
  const auth = await requireOrgAccess(req)
  if (!auth.authorized) return auth

  const paramOrgId = req.nextUrl.searchParams.get(paramName)
  if (paramOrgId && paramOrgId !== auth.orgId) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Forbidden: organization mismatch' }, { status: 403 }),
    }
  }

  return { ...auth, matchedOrgId: paramOrgId ?? auth.orgId }
}
