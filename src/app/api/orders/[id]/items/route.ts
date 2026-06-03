import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { addItemTransactional, removeItemTransactional } from '@/lib/services/order-editing.service'
import { requireOrgAccess } from '@/lib/auth/require-org'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await req.json()
    const sb = createServiceClient()
    const result = await addItemTransactional(sb, id, body)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response

    const { id } = await params
    const url = new URL(req.url)
    const itemId = url.searchParams.get('itemId')
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

    const sb = createServiceClient()
    const result = await removeItemTransactional(sb, id, itemId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
