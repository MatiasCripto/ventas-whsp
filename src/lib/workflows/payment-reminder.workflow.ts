// ── Payment Reminder Workflow ─────────────────────────────────
// Orchestrates sending payment reminders for abandoned orders.

import { findOrdersNeedingReminder, sendReminder } from '@/lib/services/order-recovery.service'

const REMINDER_MESSAGES = [
  '¡Hola! 😊 Vimos que tu pedido está pendiente de pago. Cuando quieras podés completarlo con transferencia o efectivo contra entrega.',
  '¡Hola! 😊 Te recordamos que tenés un pedido esperando. ¿Necesitás ayuda con el pago?',
]

export async function runPaymentReminders(sb: any): Promise<number> {
  // Get all organizations with reminder settings
  const { data: allSettings } = await sb.from('order_expiration_settings')
    .select('organization_id, reminder_1_minutes, reminder_2_minutes, reminder_final_minutes')
    .eq('enabled', true)

  if (!allSettings?.length) return 0

  let totalSent = 0

  for (const setting of allSettings) {
    // Check each reminder interval
    const intervals = [
      { minutes: setting.reminder_1_minutes, max: 1 },
      { minutes: setting.reminder_2_minutes, max: 2 },
      { minutes: setting.reminder_final_minutes, max: 3 },
    ]

    for (const interval of intervals) {
      if (!interval.minutes) continue

      const orders = await findOrdersNeedingReminder(sb, interval.minutes, interval.max)

      for (const order of orders) {
        const msgIndex = Math.min(order.reminder_count, REMINDER_MESSAGES.length - 1)
        const ok = await sendReminder(sb, order, REMINDER_MESSAGES[msgIndex])
        if (ok) totalSent++
      }
    }
  }

  return totalSent
}
