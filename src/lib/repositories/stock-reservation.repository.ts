// ── Stock Reservation Repository ──────────────────────────────
// Data access for stock_reservations table.
// Uses PL/pgSQL functions for transactional integrity.

export async function callReserveStock(sb: any, orderId: string): Promise<boolean> {
  const { data, error } = await sb.rpc('reserve_stock_for_order', {
    p_order_id: orderId,
  })
  if (error) {
    console.error('[STOCK_RESERVATION] reserve error:', error)
    return false
  }
  return data === true
}

export async function callConfirmStock(sb: any, orderId: string): Promise<boolean> {
  const { data, error } = await sb.rpc('confirm_stock_for_order', {
    p_order_id: orderId,
  })
  if (error) {
    console.error('[STOCK_RESERVATION] confirm error:', error)
    return false
  }
  return data === true
}

export async function callReleaseStock(sb: any, orderId: string): Promise<boolean> {
  const { data, error } = await sb.rpc('release_stock_for_order', {
    p_order_id: orderId,
  })
  if (error) {
    console.error('[STOCK_RESERVATION] release error:', error)
    return false
  }
  return data === true
}

export async function callReleaseExpiredReservations(sb: any): Promise<number> {
  const { data, error } = await sb.rpc('release_expired_reservations')
  if (error) {
    console.error('[STOCK_RESERVATION] release expired error:', error)
    return 0
  }
  return (data as number) ?? 0
}

export async function getActiveReservationsByOrder(sb: any, orderId: string) {
  const { data } = await sb.from('stock_reservations')
    .select('*')
    .eq('order_id', orderId)
    .eq('status', 'active')

  return data ?? []
}

export async function getVariantAvailableStock(sb: any, variantId: string): Promise<number> {
  const { data, error } = await sb.rpc('get_available_stock', {
    p_variant_id: variantId,
  })
  if (error) {
    console.error('[STOCK_RESERVATION] get_available_stock error:', error)
    return 0
  }
  return (data as number) ?? 0
}
