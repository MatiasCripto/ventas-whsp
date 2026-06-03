import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response
    const orgId = auth.orgId

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
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response
    const orgId = auth.orgId

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
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response
    const orgId = auth.orgId

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
