// ── Order Service ─────────────────────────────────────────────
// Order manipulation: add/remove items, recalculate totals, status transitions.
// Pure validation functions + DB operations.
// TODO: Stock reservation architecture (future implementation):
//   - releaseStockReservation(orderId) — release reserved stock when order cancels
//   - confirmStockReservation(orderId) — deduct reserved stock when payment confirmed
//   - checkExpiredReservations() — cron job to release expired reservations

import type { Order } from '@/lib/types'
import { recordOrderEvent } from '@/lib/services/order-event.service'
import { confirmStockForOrder, releaseStockForOrder } from '@/lib/services/stock-reservation.service'

// Orders in these statuses can be edited (items added/removed)
const EDITABLE_STATUSES = new Set([
  'pending',
  'awaiting_payment',
  'payment_under_review',
  'payment_confirmed',
  'preparing',
])

// ── Pure validation ──────────────────────────────────────────

/**
 * Check if an order can be edited based on its status.
 * Pure function — no side effects.
 */
export function canEditOrder(status: string): boolean {
  return EDITABLE_STATUSES.has(status)
}

/**
 * Check if an order can have its status transitioned to the target.
 */
export function isValidTransition(current: string, target: string): boolean {
  const FLOW = [
    'pending',
    'awaiting_payment',
    'payment_under_review',
    'payment_confirmed',
    'preparing',
    'shipped',
    'delivered',
    'completed',
  ]
  const currentIdx = FLOW.indexOf(current)
  const targetIdx = FLOW.indexOf(target)
  if (currentIdx === -1 || targetIdx === -1) return false
  // Allow forward transitions only (except cancel/refund always allowed)
  return targetIdx > currentIdx || target === 'cancelled' || target === 'refunded'
}

// ── DB operations ────────────────────────────────────────────

/**
 * Add items to an existing order and recalculate total.
 */
export async function addItemsToOrder(
  sb: any,
  orderId: string,
  items: Array<{
    variant_id: string
    product_name: string
    variant_label: string
    quantity: number
    unit_price: number
  }>,
): Promise<boolean> {
  try {
    // Verify order is editable
    const { data: order } = await sb.from('orders')
      .select('id, status, subtotal')
      .eq('id', orderId)
      .single()

    if (!order || !canEditOrder(order.status)) {
      console.error('[ORDER] Cannot edit order:', orderId, 'status:', order?.status)
      return false
    }

    // Calculate total for new items
    let additionalTotal = 0
    const orderItemsPayload = items.map(i => {
      const total = i.quantity * i.unit_price
      additionalTotal += total
      return {
        order_id: orderId,
        variant_id: i.variant_id,
        product_name: i.product_name,
        variant_label: i.variant_label,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total,
      }
    })

    // Insert new items
    const { error: insertError } = await sb.from('order_items').insert(orderItemsPayload)
    if (insertError) {
      console.error('[ORDER] Add items error:', insertError)
      return false
    }

    // Recalculate totals
    await recalculateOrderTotal(sb, orderId)

    console.log('[ORDER] Items added:', { orderId, count: items.length, additionalTotal })
    return true
  } catch (err) {
    console.error('[ORDER] Add items exception:', err)
    return false
  }
}

/**
 * Remove an item from an order and recalculate total.
 */
export async function removeItemFromOrder(
  sb: any,
  orderId: string,
  itemId: string,
): Promise<boolean> {
  try {
    const { data: order } = await sb.from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()

    if (!order || !canEditOrder(order.status)) return false

    const { error } = await sb.from('order_items')
      .delete()
      .eq('id', itemId)
      .eq('order_id', orderId)

    if (error) {
      console.error('[ORDER] Remove item error:', error)
      return false
    }

    await recalculateOrderTotal(sb, orderId)
    console.log('[ORDER] Item removed:', { orderId, itemId })
    return true
  } catch (err) {
    console.error('[ORDER] Remove item exception:', err)
    return false
  }
}

/**
 * Recalculate order totals based on current items.
 */
export async function recalculateOrderTotal(
  sb: any,
  orderId: string,
): Promise<void> {
  try {
    const { data: items } = await sb.from('order_items')
      .select('total')
      .eq('order_id', orderId)

    if (!items) return

    const newSubtotal = items.reduce((sum: number, i: any) => sum + (i.total ?? 0), 0)

    // Get current shipping and discount
    const { data: order } = await sb.from('orders')
      .select('shipping_cost, discount')
      .eq('id', orderId)
      .single()

    if (!order) return

    const newTotal = newSubtotal + (order.shipping_cost ?? 0) - (order.discount ?? 0)

    const { error } = await sb.from('orders').update({
      subtotal: newSubtotal,
      total: newTotal,
    }).eq('id', orderId)

    if (error) console.error('[ORDER] Recalculate error:', error)
    else console.log('[ORDER] Recalculated:', { orderId, subtotal: newSubtotal, total: newTotal })
  } catch (err) {
    console.error('[ORDER] Recalculate exception:', err)
  }
}

/**
 * Update order status with validation.
 */
export async function updateOrderStatus(
  sb: any,
  orderId: string,
  newStatus: string,
): Promise<boolean> {
  try {
    const { data: order } = await sb.from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()

    if (!order) return false

    if (!isValidTransition(order.status, newStatus)) {
      console.error('[ORDER] Invalid transition:', order.status, '->', newStatus)
      return false
    }

    // Stock hooks: confirm on payment_confirmed, release on cancel/expire/refund
    if (newStatus === 'payment_confirmed') {
      await confirmStockForOrder(sb, orderId)
    }
    if (newStatus === 'cancelled' || newStatus === 'refunded' || newStatus === 'expired') {
      await releaseStockForOrder(sb, orderId)
    }

    const { error } = await sb.from('orders').update({
      status: newStatus,
    }).eq('id', orderId)

    if (error) {
      console.error('[ORDER] Status update error:', error)
      return false
    }

    // Record audit event for the transition
    await recordOrderEvent(sb, {
      order_id: orderId,
      type: newStatus as any,
      actor_type: 'admin',
      metadata: { from: order.status, to: newStatus },
    })

    console.log('[ORDER] Status updated:', { orderId, from: order.status, to: newStatus })
    return true
  } catch (err) {
    console.error('[ORDER] Status update exception:', err)
    return false
  }
}

// ── Order fetching ───────────────────────────────────────────

/**
 * Get order with items and customer data.
 */
export async function getOrderWithDetails(
  sb: any,
  orderId: string,
): Promise<any | null> {
  try {
    const { data } = await sb.from('orders')
      .select('*, customer:customers(*), items:order_items(*)')
      .eq('id', orderId)
      .single()

    return data
  } catch (err) {
    console.error('[ORDER] Fetch error:', err)
    return null
  }
}
