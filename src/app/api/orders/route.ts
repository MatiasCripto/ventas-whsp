import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccessWithParam } from '@/lib/auth/require-org'

const ORDER_SELECT = `
  id, organization_id, store_id, customer_id, status,
  subtotal, shipping_cost, discount, total,
  payment_method, payment_status, shipping_address,
  tracking_number, notes, source, created_at, updated_at,
  customer:customers(full_name, phone, email),
  items:order_items(id, product_name, variant_label, quantity, unit_price, total)
`

export async function GET(req: NextRequest) {
  const auth = await requireOrgAccessWithParam(req, 'organization_id')
  if (!auth.authorized) return auth.response
  const orgId = auth.matchedOrgId!
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 })

  const customerId = req.nextUrl.searchParams.get('customer_id')
  const status = req.nextUrl.searchParams.get('status')

  const sb = createServiceClient()
  let query = sb.from('orders').select(ORDER_SELECT).eq('organization_id', orgId).order('created_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  if (status) query = query.eq('status', status)

  const { data } = await query.limit(50)
  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAccessWithParam(req, 'organization_id')
  if (!auth.authorized) return auth.response

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb.from('orders').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('organization_id', auth.orgId).select(ORDER_SELECT).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
