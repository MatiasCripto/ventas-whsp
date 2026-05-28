// ── Order Expiration Check Workflow ───────────────────────────
// Orchestrates the expiration check and cleanup process.

import { expireOverdueOrders } from '@/lib/services/order-expiration.service'
import { releaseExpiredReservations } from '@/lib/services/stock-reservation.service'

export async function runExpirationCheck(sb: any): Promise<{
  ordersExpired: number
  reservationsReleased: number
}> {
  const ordersExpired = await expireOverdueOrders(sb)
  const reservationsReleased = await releaseExpiredReservations(sb)

  return { ordersExpired, reservationsReleased }
}
