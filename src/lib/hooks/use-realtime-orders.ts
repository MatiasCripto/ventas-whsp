// ── useRealtimeOrders Hook ────────────────────────────────────
// Realtime subscription for the orders list page.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'

interface UseRealtimeOrdersOptions {
  organizationId: string | null
  limit?: number
}

export function useRealtimeOrders({ organizationId, limit = 50 }: UseRealtimeOrdersOptions) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const loadOrders = useCallback(async () => {
    if (!organizationId) return
    const sb = createClient()
    const { data } = await sb.from('orders')
      .select('*, customer:customers(full_name, phone)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)
    setOrders((data ?? []) as unknown as Order[])
    setLoading(false)
  }, [organizationId, limit])

  useEffect(() => { loadOrders() }, [loadOrders])

  // Realtime subscription for INSERT/UPDATE/DELETE
  useEffect(() => {
    if (!organizationId) return
    const sb = createClient()

    const channel = sb.channel('orders-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `organization_id=eq.${organizationId}`,
      }, () => { loadOrders() })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [organizationId, loadOrders])

  return { orders, loading, refresh: loadOrders }
}
