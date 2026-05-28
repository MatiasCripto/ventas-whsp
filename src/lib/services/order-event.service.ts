import { insertOrderEvent, getOrderEvents } from '@/lib/repositories/order-event.repository'
import type { OrderEvent, OrderEventType, OrderEventActorType } from '@/lib/types'

export async function recordOrderEvent(
  sb: any,
  params: {
    order_id: string
    type: OrderEventType
    actor_type: OrderEventActorType
    actor_id?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<OrderEvent | null> {
  return insertOrderEvent(sb, params)
}

export async function getOrderTimeline(
  sb: any,
  orderId: string,
): Promise<OrderEvent[]> {
  return getOrderEvents(sb, orderId)
}
