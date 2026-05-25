'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { ArrowLeft, Truck, CreditCard, User } from 'lucide-react'
import { formatCurrency, formatDateTime, getOrderStatusConfig, getPaymentStatusConfig } from '@/lib/utils/formatters'
import type { Order, OrderItem } from '@/lib/types'

const STATUS_FLOW = ['pending', 'confirmed', 'paid', 'preparing', 'shipped', 'delivered']
const CANCEL_STATUSES = ['pending', 'confirmed']

export default function OrderDetailPage() {
  const { authUser } = useAuthContext()
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!authUser?.organization?.id || !params.id) return
    async function load() {
      const orgId = authUser?.organization?.id
      if (!orgId) return
      try {
        const sb = createServiceClient()
        const { data } = await sb.from('orders')
          .select('*, customer:customers(*), items:order_items(*)')
          .eq('id', params.id as string)
          .eq('organization_id', orgId)
          .single()
        setOrder(data as unknown as Order)
      } catch {
        // dev mode — Supabase not available
      }
      setLoading(false)
    }
    load()
  }, [authUser, params.id])

  async function handleUpdateStatus(newStatus: string) {
    if (!order) return
    setUpdating(true)
    try {
      const sb = createServiceClient()
      await sb.from('orders').update({ status: newStatus }).eq('id', order.id)
      setOrder({ ...order, status: newStatus as Order['status'] })
    } catch {
      // dev mode — Supabase not available
    }
    setUpdating(false)
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
  if (!order) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Pedido no encontrado</div>

  const statusCfg = getOrderStatusConfig(order.status)
  const payCfg = getPaymentStatusConfig(order.payment_status)
  const canCancel = CANCEL_STATUSES.includes(order.status)
  const currentIdx = STATUS_FLOW.indexOf(order.status)

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/orders" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={18} />
          </a>
          <h1 className="text-xl font-semibold">Pedido #{order.id.slice(0, 8)}</h1>
        </div>
        {canCancel && (
          <button onClick={() => handleUpdateStatus('cancelled')} disabled={updating}
            className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-white"
            style={{ background: '#ef4444' }}
          >
            Cancelar Pedido
          </button>
        )}
      </div>

      {/* Status timeline */}
      <div className="card p-5">
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((s, i) => {
            const cfg = getOrderStatusConfig(s as Order['status'])
            const done = i <= currentIdx
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1"
                style={{ cursor: i === currentIdx + 1 && order.status !== 'cancelled' ? 'pointer' : 'default' }}
                onClick={() => {
                  if (i === currentIdx + 1 && order.status !== 'cancelled') handleUpdateStatus(s)
                }}
              >
                <div className="w-3 h-3 rounded-full transition-colors"
                  style={{ background: done ? statusCfg.color : 'var(--surface-2)' }}
                />
                <span className="text-[10px] text-center leading-tight" style={{ color: done ? statusCfg.color : 'var(--subtle)' }}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
        {order.status === 'cancelled' && (
          <div className="text-center mt-3">
            <span className="text-xs px-2 py-1 rounded-[var(--radius-full)] font-medium"
              style={{ background: '#fef2f2', color: '#991b1b' }}>
              Cancelado
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer info */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User size={14} style={{ color: 'var(--muted)' }} />
            Cliente
          </div>
          {order.customer ? (
            <>
              <p className="text-sm font-medium">{order.customer.full_name}</p>
              {order.customer.phone && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{order.customer.phone}</p>
              )}
              {order.customer.email && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{order.customer.email}</p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Cliente no disponible</p>
          )}
          {order.shipping_address && (
            <div className="pt-2 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--subtle)' }}>Dirección de envío:</span>
              <p className="mt-0.5">{order.shipping_address}</p>
            </div>
          )}
        </div>

        {/* Payment & shipping */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CreditCard size={14} style={{ color: 'var(--muted)' }} />
            Pago
          </div>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--muted)' }}>Estado</span>
            <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] font-medium"
              style={{ background: payCfg.bg, color: payCfg.color }}>
              {payCfg.label}
            </span>
          </div>
          {order.payment_method && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--muted)' }}>Método</span>
              <span>{order.payment_method}</span>
            </div>
          )}
          {order.tracking_number && (
            <div className="pt-2 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-1">
                <Truck size={12} style={{ color: 'var(--subtle)' }} />
                <span style={{ color: 'var(--subtle)' }}>Seguimiento:</span>
              </div>
              <p className="mt-0.5">{order.tracking_number}</p>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm">Productos</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th className="text-left px-4 py-2 font-medium">Producto</th>
              <th className="text-left px-4 py-2 font-medium">Variante</th>
              <th className="text-right px-4 py-2 font-medium">Cant.</th>
              <th className="text-right px-4 py-2 font-medium">Precio</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items ?? []).map((item: OrderItem) => (
              <tr key={item.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-2">{item.product_name}</td>
                <td className="px-4 py-2" style={{ color: 'var(--muted)' }}>{item.variant_label || '—'}</td>
                <td className="px-4 py-2 text-right">{item.quantity}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
              <td colSpan={4} className="px-4 py-2 text-right text-xs" style={{ color: 'var(--muted)' }}>Subtotal</td>
              <td className="px-4 py-2 text-right text-sm">{formatCurrency(order.subtotal)}</td>
            </tr>
            {order.shipping_cost > 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-2 text-right text-xs" style={{ color: 'var(--muted)' }}>Envío</td>
                <td className="px-4 py-2 text-right text-sm">{formatCurrency(order.shipping_cost)}</td>
              </tr>
            )}
            {order.discount > 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-2 text-right text-xs" style={{ color: 'var(--muted)' }}>Descuento</td>
                <td className="px-4 py-2 text-right text-sm" style={{ color: '#10b981' }}>-{formatCurrency(order.discount)}</td>
              </tr>
            )}
            <tr className="border-t-2" style={{ borderColor: 'var(--border)' }}>
              <td colSpan={4} className="px-4 py-2 text-right text-sm font-semibold">Total</td>
              <td className="px-4 py-2 text-right font-bold">{formatCurrency(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="text-xs" style={{ color: 'var(--subtle)' }}>
        Creado {formatDateTime(order.created_at)}
        {order.notes && <p className="mt-1">Notas: {order.notes}</p>}
      </div>
    </div>
  )
}
