import { NextRequest, NextResponse } from 'next/server'
import { getInstanceStatus } from '@/lib/bot/evolution-client'
import { requireOrgAccess } from '@/lib/auth/require-org'

export async function GET(req: NextRequest) {
  const auth = await requireOrgAccess(req)
  if (!auth.authorized) return auth.response

  try {
    const data = await getInstanceStatus()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
