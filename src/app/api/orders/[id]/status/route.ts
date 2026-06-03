import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateOrderStatus } from '@/lib/bot/order-service'
import { requireOrgAccess } from '@/lib/auth/require-org'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await req.json()
    const { status } = body

    if (!status || typeof status !== 'string') {
      return NextResponse.json({ error: 'status es requerido' }, { status: 400 })
    }

    const sb = createServiceClient()
    const ok = await updateOrderStatus(sb, id, status)

    if (!ok) {
      return NextResponse.json({ error: 'Transición de estado no válida' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
