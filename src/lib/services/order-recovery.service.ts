// ── Order Recovery Service ────────────────────────────────────
// Finds abandoned orders and sends payment reminders.

import { recordOrderEvent } from '@/lib/services/order-event.service'

interface OrderForReminder {
  id: string
  organization_id: string
  customer_id: string
  total: number
  reminder_count: number
  reminder_stopped: boolean
  last_reminder_sent_at: string | null
  created_at: string
  customer?: { phone?: string }
}

export async function findOrdersNeedingReminder(
  sb: any,
  reminderMinutes: number,
  maxReminders: number,
): Promise<OrderForReminder[]> {
  const cutoff = new Date(Date.now() - reminderMinutes * 60 * 1000).toISOString()
  const { data } = await sb.from('orders')
    .select('id, organization_id, customer_id, total, reminder_count, reminder_stopped, last_reminder_sent_at, created_at, customer:customers(phone)')
    .eq('status', 'awaiting_payment')
    .eq('reminder_stopped', false)
    .lt('reminder_count', maxReminders)
    .lt('created_at', cutoff)
    .limit(20)

  return (data ?? []) as OrderForReminder[]
}

export async function sendReminder(
  sb: any,
  order: OrderForReminder,
  message: string,
): Promise<boolean> {
  const phone = order.customer?.phone
  if (!phone) {
    console.warn('[REMINDER] no phone for order:', order.id)
    return false
  }

  try {
    // Send via Evolution API
    await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_API_KEY ?? '',
      },
      body: JSON.stringify({
        number: phone,
        textMessage: { text: message },
        options: { delay: 1200, presence: 'composing' },
      }),
    })

    // Update reminder tracking
    await sb.from('orders').update({
      reminder_count: order.reminder_count + 1,
      last_reminder_sent_at: new Date().toISOString(),
    }).eq('id', order.id)

    // Record audit event
    await recordOrderEvent(sb, {
      order_id: order.id,
      type: 'note_added',
      actor_type: 'system',
      metadata: { reminder: `reminder_${order.reminder_count + 1}` },
    })

    console.log('[REMINDER] sent for order:', order.id, 'count:', order.reminder_count + 1)
    return true
  } catch (err) {
    console.error('[REMINDER] send error:', err)
    return false
  }
}

export function shouldStopReminders(order: OrderForReminder, maxReminders: number): boolean {
  return order.reminder_count >= maxReminders || order.reminder_stopped
}
