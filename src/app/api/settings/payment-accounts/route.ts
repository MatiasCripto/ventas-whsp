import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getOrgId(req?: NextRequest): Promise<string | null> {
  // If client passed orgId as query param, use it (source of truth from authUser)
  if (req) {
    const url = new URL(req.url)
    const paramOrgId = url.searchParams.get('orgId')
    if (paramOrgId) return paramOrgId
  }

  // Production: get from auth
  const sb = createServiceClient()
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const { data: profile } = await sb.from('profiles').select('organization_id').eq('id', user.id).single()
    if (profile) return profile.organization_id
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = createServiceClient()
    const { data, error } = await sb.from('payment_accounts')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) console.log('[GET_ERR]', error?.message || error)

    return NextResponse.json(data ?? null)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { bank_name, account_holder, alias, cvu, payment_method, currency, priority, instructions, is_default } = body
    if (!bank_name || !account_holder) {
      return NextResponse.json({ error: 'bank_name and account_holder are required' }, { status: 400 })
    }

    console.log('[SAVE_PAYMENT_ACCOUNT]', { bank_name, account_holder, alias, cvu, payment_method, currency, priority, orgId })

    const sb = createServiceClient()

    // Deactivate any existing active accounts for this org
    await sb.from('payment_accounts')
      .update({ is_active: false })
      .eq('organization_id', orgId)
      .eq('is_active', true)

    // Upsert the new account
    const { data: existing, error: existingError } = await sb.from('payment_accounts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('bank_name', bank_name)
      .eq('account_holder', account_holder)
      .maybeSingle()
    if (existingError) console.log('[SAVE_ERR] existing check failed:', existingError)

    let result; let lastError
    if (existing) {
      const { data, error } = await sb.from('payment_accounts').update({
        alias: alias ?? null,
        cvu: cvu ?? null,
        payment_method: payment_method ?? 'transfer',
        currency: currency ?? 'ARS',
        priority: priority ?? 0,
        instructions: instructions ?? null,
        is_default: is_default ?? false,
        is_active: true,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).select('*').single()
      result = data; lastError = error
    } else {
      const { data, error } = await sb.from('payment_accounts').insert({
        organization_id: orgId,
        bank_name,
        account_holder,
        alias: alias ?? null,
        cvu: cvu ?? null,
        payment_method: payment_method ?? 'transfer',
        currency: currency ?? 'ARS',
        priority: priority ?? 0,
        instructions: instructions ?? null,
        is_default: is_default ?? false,
        is_active: true,
      }).select('*').single()
      result = data; lastError = error
    }

    console.log('[SAVE_RESULT]', {
      saved: result ? { id: (result as any).id, bank_name: (result as any).bank_name, organization_id: (result as any).organization_id, is_active: (result as any).is_active } : null,
      error: lastError?.message || lastError || null,
      orgId,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = createServiceClient()
    await sb.from('payment_accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('organization_id', orgId)
      .eq('is_active', true)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
