// ── Notification Service ──────────────────────────────────────
// Creates notifications for key events across the system.

import { insertNotification } from '@/lib/repositories/notification.repository'

type NotificationInput = {
  organization_id: string
  type: string
  title: string
  description?: string
  entity_type?: string
  entity_id?: string
  metadata?: Record<string, unknown>
}

export async function createNotification(sb: any, input: NotificationInput) {
  await insertNotification(sb, input)
  console.log('[NOTIFICATION] created:', input.type, 'for org:', input.organization_id)
}

/**
 * Create a notification for a new order.
 */
export async function notifyNewOrder(
  sb: any,
  orgId: string,
  orderId: string,
  orderNumber: string,
  total: number,
) {
  await createNotification(sb, {
    organization_id: orgId,
    type: 'new_order',
    title: `Nuevo pedido #${orderNumber}`,
    description: `Pedido por $${total.toFixed(2)}`,
    entity_type: 'order',
    entity_id: orderId,
  })
}

/**
 * Create a notification when a payment proof is received.
 */
export async function notifyPaymentProof(
  sb: any,
  orgId: string,
  orderId: string,
  proofId: string,
) {
  await createNotification(sb, {
    organization_id: orgId,
    type: 'payment_proof',
    title: 'Nuevo comprobante de pago',
    description: 'Un cliente subió un comprobante para revisar',
    entity_type: 'payment_proof',
    entity_id: proofId,
    metadata: { order_id: orderId },
  })
}
