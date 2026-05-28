// ── Payment Account Repository ────────────────────────────────
// Data access for payment_accounts table.

import type { PaymentAccount } from '@/lib/types'

export async function getActiveAccounts(sb: any, orgId: string): Promise<PaymentAccount[]> {
  const { data } = await sb.from('payment_accounts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return (data as PaymentAccount[]) ?? []
}

export async function getDefaultAccount(sb: any, orgId: string): Promise<PaymentAccount | null> {
  const { data } = await sb.from('payment_accounts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle()

  return (data as PaymentAccount) ?? null
}

export async function deactivateAllAccounts(sb: any, orgId: string) {
  await sb.from('payment_accounts')
    .update({ is_active: false })
    .eq('organization_id', orgId)
    .eq('is_active', true)
}

export async function upsertAccount(sb: any, orgId: string, data: Partial<PaymentAccount>) {
  const { bank_name, account_holder } = data
  if (!bank_name || !account_holder) return null

  // Check if exists
  const { data: existing } = await sb.from('payment_accounts')
    .select('id')
    .eq('organization_id', orgId)
    .eq('bank_name', bank_name)
    .eq('account_holder', account_holder)
    .maybeSingle()

  let result
  if (existing) {
    const { data: updated } = await sb.from('payment_accounts').update({
      ...data,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id).select('*').single()
    result = updated
  } else {
    const { data: created } = await sb.from('payment_accounts').insert({
      organization_id: orgId,
      ...data,
    }).select('*').single()
    result = created
  }

  return result as PaymentAccount | null
}
