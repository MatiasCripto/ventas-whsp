// ── Notification Repository ───────────────────────────────────
// Data access for notifications table.

import type { Notification } from '@/lib/types'

export async function getNotifications(sb: any, orgId: string, limit = 50): Promise<Notification[]> {
  const { data } = await sb.from('notifications')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as Notification[]) ?? []
}

export async function getUnreadCount(sb: any, orgId: string): Promise<number> {
  const { count } = await sb.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('read', false)

  return count ?? 0
}

export async function markAsRead(sb: any, notificationId: string) {
  await sb.from('notifications').update({ read: true }).eq('id', notificationId)
}

export async function markAllAsRead(sb: any, orgId: string) {
  await sb.from('notifications').update({ read: true }).eq('organization_id', orgId).eq('read', false)
}

export async function insertNotification(sb: any, data: {
  organization_id: string
  type: string
  title: string
  description?: string
  entity_type?: string
  entity_id?: string
  metadata?: Record<string, unknown>
}) {
  const { error } = await sb.from('notifications').insert(data)
  if (error) console.error('[NOTIFICATION] insert error:', error)
}
