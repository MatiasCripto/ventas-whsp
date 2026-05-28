// ── useNotifications Hook ─────────────────────────────────────
// Realtime subscription for admin notifications.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'

interface UseNotificationsOptions {
  organizationId: string | null
  limit?: number
}

export function useNotifications({ organizationId, limit = 50 }: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!organizationId) return
    const sb = createClient()

    const { data } = await sb.from('notifications')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    setNotifications((data ?? []) as Notification[])

    const { count } = await sb.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('read', false)
    setUnreadCount(count ?? 0)
    setLoading(false)
  }, [organizationId, limit])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Realtime subscription
  useEffect(() => {
    if (!organizationId) return
    const sb = createClient()

    const channel = sb.channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `organization_id=eq.${organizationId}`,
      }, () => {
        loadNotifications()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `organization_id=eq.${organizationId}`,
      }, () => {
        loadNotifications()
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [organizationId, loadNotifications])

  const markAsRead = useCallback(async (id: string) => {
    const sb = createClient()
    await sb.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!organizationId) return
    const sb = createClient()
    await sb.from('notifications').update({ read: true })
      .eq('organization_id', organizationId)
      .eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [organizationId])

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead }
}
