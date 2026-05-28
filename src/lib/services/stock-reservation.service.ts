// ── Stock Reservation Service ─────────────────────────────────
// Business logic for stock reservations with audit trail.

import {
  callReserveStock, callConfirmStock, callReleaseStock,
  callReleaseExpiredReservations,
} from '@/lib/repositories/stock-reservation.repository'
import { recordOrderEvent } from '@/lib/services/order-event.service'

/**
 * Reserve stock for an order. Called after order creation.
 * Returns false if insufficient stock.
 */
export async function reserveStockForOrder(
  sb: any,
  orderId: string,
  customerId: string | null,
): Promise<boolean> {
  const ok = await callReserveStock(sb, orderId)
  if (ok) {
    await recordOrderEvent(sb, {
      order_id: orderId,
      type: 'stock_reserved',
      actor_type: 'system',
      actor_id: customerId,
    })
    console.log('[STOCK] reserved for order:', orderId)
  } else {
    console.warn('[STOCK] reservation failed — insufficient stock for order:', orderId)
  }
  return ok
}

/**
 * Confirm stock for an order. Called when payment is confirmed.
 * Deducts real stock and records inventory movements.
 */
export async function confirmStockForOrder(sb: any, orderId: string): Promise<boolean> {
  const ok = await callConfirmStock(sb, orderId)
  if (ok) {
    console.log('[STOCK] confirmed for order:', orderId)
  }
  return ok
}

/**
 * Release stock for an order. Called on cancel or expiration.
 */
export async function releaseStockForOrder(sb: any, orderId: string): Promise<boolean> {
  const ok = await callReleaseStock(sb, orderId)
  if (ok) {
    console.log('[STOCK] released for order:', orderId)
  }
  return ok
}

/**
 * Release all expired reservations. Called by cron job.
 * Returns the count of released reservations.
 */
export async function releaseExpiredReservations(sb: any): Promise<number> {
  const count = await callReleaseExpiredReservations(sb)
  if (count > 0) {
    console.log('[STOCK] released', count, 'expired reservations')
  }
  return count
}
