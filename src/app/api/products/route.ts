import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccessWithParam } from '@/lib/auth/require-org'

export async function GET(req: NextRequest) {
  const auth = await requireOrgAccessWithParam(req, 'organization_id')
  if (!auth.authorized) return auth.response
  const orgId = auth.matchedOrgId!
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 })

  const sb = createServiceClient()
  const { data: products } = await sb
    .from('products')
    .select(`
      id, name, slug, description, price, compare_price, images, tags, brand,
      is_active, featured, created_at,
      category:categories(name),
      variants:product_variants(id, attribute_values, stock, price_override, is_active)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  return NextResponse.json(products ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgAccessWithParam(req, 'organization_id')
  if (!auth.authorized) return auth.response

  const body = await req.json()
  const { organization_id, name, slug, description, category_id, brand, tags, price, compare_price, images, is_active, featured } = body

  if (!organization_id || !name || !slug || price === undefined) {
    return NextResponse.json({ error: 'Missing required fields: organization_id, name, slug, price' }, { status: 400 })
  }
  if (organization_id !== auth.orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = createServiceClient()
  const { data, error } = await sb.from('products').insert({
    organization_id, name, slug, description, category_id, brand,
    tags: tags ?? [],
    price, compare_price: compare_price ?? null,
    images: images ?? [],
    is_active: is_active ?? true,
    featured: featured ?? false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAccessWithParam(req, 'organization_id')
  if (!auth.authorized) return auth.response

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb.from('products').update(updates).eq('id', id).eq('organization_id', auth.orgId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAccessWithParam(req, 'organization_id')
  if (!auth.authorized) return auth.response

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = createServiceClient()
  const { error } = await sb.from('products').delete().eq('id', id).eq('organization_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
