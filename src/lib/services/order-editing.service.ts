// ── Order Editing Service ─────────────────────────────────────
// Transactional order editing with stock validation and audit trail.

import { recordOrderEvent } from '@/lib/services/order-event.service'
import { getVariantAvailableStock } from '@/lib/repositories/stock-reservation.repository'

export async function addItemTransactional(
  sb: any,
  orderId: string,
  params: {
    variant_id: string
    product_name: string
    variant_label: string
    quantity: number
    unit_price: number
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Validate order is editable
    const { data: order } = await sb.from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()
    if (!order) return { ok: false, error: 'Order not found' }
    if (!['pending', 'awaiting_payment', 'payment_under_review', 'payment_confirmed', 'preparing'].includes(order.status)) {
      return { ok: false, error: 'Order is not editable' }
    }

    // 2. Validate stock
    const available = await getVariantAvailableStock(sb, params.variant_id)
    if (available < params.quantity) {
      return { ok: false, error: `Insufficient stock: ${available} available` }
    }

    // 3. Insert item
    const total = params.quantity * params.unit_price
    const { error: insertError } = await sb.from('order_items').insert({
      order_id: orderId,
      variant_id: params.variant_id,
      product_name: params.product_name,
      variant_label: params.variant_label,
      quantity: params.quantity,
      unit_price: params.unit_price,
      total,
    })
    if (insertError) return { ok: false, error: insertError.message }

    // 4. Recalculate totals
    await recalculateOrderTotal(sb, orderId)

    // 5. Record audit
    await recordOrderEvent(sb, {
      order_id: orderId,
      type: 'item_added',
      actor_type: 'admin',
      metadata: { product_name: params.product_name, quantity: params.quantity },
    })

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function removeItemTransactional(
  sb: any,
  orderId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: order } = await sb.from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()
    if (!order) return { ok: false, error: 'Order not found' }
    if (!['pending', 'awaiting_payment', 'payment_under_review', 'payment_confirmed', 'preparing'].includes(order.status)) {
      return { ok: false, error: 'Order is not editable' }
    }

    const { error } = await sb.from('order_items').delete().eq('id', itemId).eq('order_id', orderId)
    if (error) return { ok: false, error: error.message }

    await recalculateOrderTotal(sb, orderId)

    await recordOrderEvent(sb, {
      order_id: orderId,
      type: 'item_removed',
      actor_type: 'admin',
      metadata: { item_id: itemId },
    })

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function recalculateOrderTotal(sb: any, orderId: string) {
  const { data: items } = await sb.from('order_items').select('total').eq('order_id', orderId)
  if (!items) return
  const newSubtotal = items.reduce((sum: number, i: any) => sum + (i.total ?? 0), 0)
  const { data: order } = await sb.from('orders').select('shipping_cost, discount').eq('id', orderId).single()
  if (!order) return
  const newTotal = newSubtotal + (order.shipping_cost ?? 0) - (order.discount ?? 0)
  await sb.from('orders').update({ subtotal: newSubtotal, total: newTotal }).eq('id', orderId)
}
