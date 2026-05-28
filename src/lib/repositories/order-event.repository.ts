import type { OrderEvent, OrderEventType, OrderEventActorType } from '@/lib/types'

export async function insertOrderEvent(
  sb: any,
  params: {
    order_id: string
    type: OrderEventType
    actor_type: OrderEventActorType
    actor_id?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<OrderEvent | null> {
  try {
    const { data, error } = await sb.from('order_events').insert({
      order_id: params.order_id,
      type: params.type,
      actor_type: params.actor_type,
      actor_id: params.actor_id ?? null,
      metadata: params.metadata ?? {},
    }).select('*').single()

    if (error) {
      console.error('[ORDER_EVENT_REPO] insert error:', error)
      return null
    }
    return data as OrderEvent
  } catch (err) {
    console.error('[ORDER_EVENT_REPO] insert exception:', err)
    return null
  }
}

export async function getOrderEvents(
  sb: any,
  orderId: string,
): Promise<OrderEvent[]> {
  try {
    const { data } = await sb.from('order_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    return (data as OrderEvent[]) ?? []
  } catch (err) {
    console.error('[ORDER_EVENT_REPO] query error:', err)
    return []
  }
}
