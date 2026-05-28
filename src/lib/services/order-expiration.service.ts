// ── Order Expiration Service ──────────────────────────────────
// Business logic for expiring unpaid orders.

import { getExpirationSettings, getOrdersExpiring } from '@/lib/repositories/order-expiration.repository'
import { releaseStockForOrder } from '@/lib/services/stock-reservation.service'
import { recordOrderEvent } from '@/lib/services/order-event.service'

/**
 * Find and expire all orders past their organization's expiration threshold.
 * Returns the number of orders expired.
 */
export async function expireOverdueOrders(sb: any): Promise<number> {
  // Get all organizations with expiration enabled
  const { data: allSettings } = await sb.from('order_expiration_settings')
    .select('organization_id, expiration_minutes, auto_release_stock')
    .eq('enabled', true)

  if (!allSettings?.length) return 0

  let totalExpired = 0

  for (const setting of allSettings) {
    const orders = await getOrdersExpiring(sb, setting.expiration_minutes)

    for (const order of orders) {
      try {
        // Update order status to expired
        await sb.from('orders').update({ status: 'expired' }).eq('id', order.id)

        // Record audit event
        await recordOrderEvent(sb, {
          order_id: order.id,
          type: 'expired',
          actor_type: 'system',
          metadata: { reason: 'payment_timeout', expiration_minutes: setting.expiration_minutes },
        })

        // Auto-release stock if configured
        if (setting.auto_release_stock) {
          await releaseStockForOrder(sb, order.id)
        }

        totalExpired++
        console.log('[EXPIRATION] expired order:', order.id)
      } catch (err) {
        console.error('[EXPIRATION] failed to expire order:', order.id, err)
      }
    }
  }

  return totalExpired
}
