'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'

interface Order {
  id: string; status: string; total: number; created_at: string
  customer?: { full_name: string } | null
  items?: { id: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'status-pending',
  awaiting_payment: 'status-pending',
  payment_under_review: 'status-under-review',
  payment_confirmed: 'status-paid',
  preparing: 'status-preparing',
  shipped: 'status-shipped',
  delivered: 'status-delivered',
  completed: 'status-delivered',
  cancelled: 'status-cancelled',
  refunded: 'status-cancelled',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  awaiting_payment: 'Esperando pago',
  payment_under_review: 'Pago en revisión',
  payment_confirmed: 'Pago confirmado',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
}

export default function OrdersPage() {
  const { authUser } = useAuthContext()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return
    async function load() {
      try {
        const res = await fetch(`/api/orders?organization_id=${orgId}`)
        const data = await res.json()
        setOrders((data ?? []) as Order[])
      } catch {
        // Dev mode — empty state
      }
      setLoading(false)
    }
    load()
  }, [authUser])

  const filtered = filter ? orders.filter(o => o.status === filter) : orders

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Pedidos</h1>

      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'awaiting_payment', 'payment_under_review', 'payment_confirmed', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-[var(--radius-full)] text-xs font-medium transition-colors ${
              filter === s ? 'text-white' : ''
            }`}
            style={{
              background: filter === s ? 'var(--brand)' : 'var(--surface-2)',
              color: filter === s ? '#fff' : 'var(--muted)',
            }}
          >
            {s ? STATUS_LABELS[s] : 'Todos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay pedidos</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th className="text-left px-4 py-3 font-medium">Pedido</th>
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-right px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="border-t cursor-pointer hover:bg-[var(--surface-2)] transition-colors" style={{ borderColor: 'var(--border)' }}
                  onClick={() => window.location.href = `/orders/${o.id}`}
                >
                  <td className="px-4 py-3 font-medium">#{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{o.customer?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[o.status] ?? ''}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">${o.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>
                    {new Date(o.created_at).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
