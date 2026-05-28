// ── Order Expiration Repository ───────────────────────────────
// Data access for order_expiration_settings table.

export async function getExpirationSettings(sb: any, orgId: string) {
  const { data } = await sb.from('order_expiration_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  return data ?? null
}

export async function upsertExpirationSettings(sb: any, orgId: string, settings: Record<string, any>) {
  const { data, error } = await sb.from('order_expiration_settings')
    .upsert({
      organization_id: orgId,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    console.error('[EXPIRATION] upsert error:', error)
    return null
  }
  return data
}

export async function getOrdersExpiring(
  sb: any,
  expirationMinutes: number,
): Promise<any[]> {
  const cutoff = new Date(Date.now() - expirationMinutes * 60 * 1000).toISOString()
  const { data } = await sb.from('orders')
    .select('id, organization_id')
    .eq('status', 'awaiting_payment')
    .lt('created_at', cutoff)
    .limit(50)

  return data ?? []
}
