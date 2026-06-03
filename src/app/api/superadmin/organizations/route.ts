import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifySuperadmin } from '@/lib/superadmin/auth'
import { generateTempPassword, getVariantAttrs } from '@/lib/superadmin/utils'
import { createInstance } from '@/lib/bot/evolution-client'

export async function GET(req: NextRequest) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  try {
    const sb = createServiceClient()

    const { data: orgs } = await sb
      .from('organizations')
      .select(`
        id, name, slug, active, created_at,
        stores:stores(count),
        profiles:profiles(count)
      `)
      .order('created_at', { ascending: false })

    if (!orgs) return NextResponse.json([])

    const orgIds = orgs.map((o: any) => o.id)

    // Batch orders count: single query, count in JS
    const { data: allOrders } = await sb
      .from('orders')
      .select('organization_id')
      .in('organization_id', orgIds)
    const orderCounts = new Map<string, number>()
    for (const o of allOrders ?? []) {
      orderCounts.set(o.organization_id, (orderCounts.get(o.organization_id) ?? 0) + 1)
    }

    // Batch customers count: single query, count in JS
    const { data: allCustomers } = await sb
      .from('customers')
      .select('organization_id')
      .in('organization_id', orgIds)
    const customerCounts = new Map<string, number>()
    for (const c of allCustomers ?? []) {
      customerCounts.set(c.organization_id, (customerCounts.get(c.organization_id) ?? 0) + 1)
    }

    const enriched = orgs.map((org: Record<string, unknown>) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      active: org.active,
      created_at: org.created_at,
      stores_count: (org.stores as { count?: number }[])?.[0]?.count ?? 0,
      profiles_count: (org.profiles as { count?: number }[])?.[0]?.count ?? 0,
      orders_count: orderCounts.get(org.id as string) ?? 0,
      customers_count: customerCounts.get(org.id as string) ?? 0,
    }))

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('[SUPERADMIN] organizations list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    org_name, store_name, rubro,
    owner_email, owner_name,
    ai_provider, ai_api_key, ai_model,
  } = body as Record<string, string | undefined>
  if (!org_name || !store_name || !owner_email || !owner_name) {
    return NextResponse.json({ error: 'Missing required fields: org_name, store_name, owner_email, owner_name' }, { status: 400 })
  }
  if (!ai_provider || !ai_api_key) {
    return NextResponse.json({ error: 'AI provider and API key required' }, { status: 400 })
  }

  const sb = createServiceClient()
  let authUserId: string | null = null
  let orgId: string | null = null
  let storeId: string | null = null
  const evolutionInstance = `org-${Date.now()}`
  const tempPassword = generateTempPassword()

  try {
    // Paso 1: Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await sb.auth.admin.createUser({
      email: owner_email,
      password: tempPassword,
      email_confirm: true,
    })
    if (authError) throw new Error(`Auth error: ${authError.message}`)
    authUserId = authData.user.id

    // Paso 2: Crear organización
    const { data: org, error: orgError } = await sb
      .from('organizations')
      .insert({ name: org_name, active: true })
      .select('id')
      .single()
    if (orgError) throw new Error(`Org error: ${orgError.message}`)
    orgId = org.id

    // Paso 3: Crear profile como owner
    const { error: profileError } = await sb
      .from('profiles')
      .insert({
        id: authUserId,
        organization_id: orgId,
        full_name: owner_name,
        role: 'owner',
      })
    if (profileError) throw new Error(`Profile error: ${profileError.message}`)

    // Paso 4: Guardar configuración AI en organization.settings
    const { data: existingOrg } = await sb
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()
    const settings = (existingOrg?.settings as Record<string, any>) ?? {}
    await sb.from('organizations').update({
      settings: { ...settings, ai: { provider: ai_provider, apiKey: ai_api_key, model: ai_model } },
    }).eq('id', orgId)

    // Paso 5: Crear instancia en Evolution API
    const evoOk = await createInstance(evolutionInstance)
    if (!evoOk) {
      console.warn('[SUPERADMIN] Evolution API instance creation failed — continuing without Evolution')
    }

    // Paso 6: Crear store
    const { attr1, attr2 } = getVariantAttrs(rubro ?? 'otro')
    const { data: store, error: storeError } = await sb
      .from('stores')
      .insert({
        organization_id: orgId,
        name: store_name,
        evolution_instance: evolutionInstance,
        variant_attr1: attr1,
        variant_attr2: attr2,
      })
      .select('id')
      .single()
    if (storeError) throw new Error(`Store error: ${storeError.message}`)
    storeId = store.id

    // Omit pickup/dni/locality — migration 013 pending

    return NextResponse.json({
      org_id: orgId,
      store_id: storeId,
      owner_email,
      temp_password: tempPassword,
      evolution_instance: evolutionInstance,
    })
  } catch (error) {
    // ROLLBACK EN ORDEN INVERSO
    console.error('[SUPERADMIN] onboarding failed, rolling back:', error)
    if (storeId) await sb.from('stores').delete().eq('id', storeId).maybeSingle()
    if (orgId) {
      await sb.from('profiles').delete().eq('organization_id', orgId).maybeSingle()
      await sb.from('organizations').delete().eq('id', orgId).maybeSingle()
    }
    if (authUserId) {
      await sb.auth.admin.deleteUser(authUserId).catch(() => {})
    }
    // Clean up Evolution instance (best effort)
    try {
      await fetch(`${process.env.EVOLUTION_API_URL}/instance/delete/${evolutionInstance}`, {
        method: 'DELETE',
        headers: { apikey: process.env.EVOLUTION_API_KEY! },
      })
    } catch {}
    return NextResponse.json({ error: 'Onboarding failed: ' + String(error) }, { status: 500 })
  }
}
