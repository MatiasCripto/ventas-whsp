'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Phone, Mail, MapPin, ShoppingBag, DollarSign, Clock } from 'lucide-react'
import { formatCurrency, formatDate, formatRelative, getRfmConfig } from '@/lib/utils/formatters'
import type { Customer, Order, CustomerScore } from '@/lib/types'

export default function CustomerDetailPage() {
  const { authUser } = useAuthContext()
  const params = useParams()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [score, setScore] = useState<CustomerScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId || !params.id) return
    async function load() {
      try {
        const sb = createClient()
        const { data: c } = await sb.from('customers')
          .select('*').eq('id', params.id as string).eq('organization_id', orgId).single()
        if (c) {
          setCustomer(c as Customer)
          const { data: o } = await sb.from('orders')
            .select('id, status, total, created_at')
            .eq('customer_id', c.id).eq('organization_id', orgId)
            .order('created_at', { ascending: false }).limit(20)
          setOrders((o ?? []) as Order[])
          const { data: s } = await sb.from('customer_scores')
            .select('*').eq('customer_id', c.id).single()
          setScore(s as CustomerScore | null)
        }
      } catch {
        // dev mode — Supabase not available
      }
      setLoading(false)
    }
    load()
  }, [authUser, params.id])

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
  if (!customer) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cliente no encontrado</div>

  const rfmCfg = score ? getRfmConfig(score.rfm_segment) : null

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <a href="/customers" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={18} />
        </a>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'var(--brand)' }}>
            {customer.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{customer.full_name}</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Cliente desde {formatDate(customer.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} style={{ color: 'var(--muted)' }} />
              <span>{customer.phone}</span>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail size={14} style={{ color: 'var(--muted)' }} />
              <span>{customer.email}</span>
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} style={{ color: 'var(--muted)' }} />
              <span>{customer.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={14} style={{ color: 'var(--brand)' }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Órdenes</span>
          </div>
          <p className="text-xl font-bold">{customer.total_orders}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} style={{ color: 'var(--success)' }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Gasto Total</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(customer.lifetime_value)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} style={{ color: 'var(--info)' }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Última compra</span>
          </div>
          <p className="text-xl font-bold text-sm">
            {customer.last_order_at ? formatRelative(customer.last_order_at) : 'Nunca'}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs" style={{ color: rfmCfg?.color ?? 'var(--muted)' }}>RFM</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Segmento</span>
          </div>
          {score ? (
            <p className="text-sm font-bold" style={{ color: rfmCfg?.color }}>{rfmCfg?.label}</p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>Sin datos</p>
          )}
        </div>
      </div>

      {/* RFM detail */}
      {score && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-3">Análisis RFM</h2>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span style={{ color: 'var(--subtle)' }}>Recencia</span>
              <p className="text-lg font-bold mt-1">{score.recency_days} días</p>
            </div>
            <div>
              <span style={{ color: 'var(--subtle)' }}>Frecuencia</span>
              <p className="text-lg font-bold mt-1">{score.frequency_count} compras</p>
            </div>
            <div>
              <span style={{ color: 'var(--subtle)' }}>Ticket promedio</span>
              <p className="text-lg font-bold mt-1">{formatCurrency(score.avg_ticket)}</p>
            </div>
          </div>
          {score.preferred_categories.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>Categorías preferidas:</span>
              <div className="flex gap-1 mt-1 flex-wrap">
                {score.preferred_categories.map(c => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-[var(--radius-full)]"
                    style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orders */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm">Historial de Pedidos</h2>
        </div>
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Sin pedidos</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th className="text-left px-4 py-2 font-medium">Pedido</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-center px-4 py-2 font-medium">Estado</th>
                <th className="text-right px-4 py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                  onClick={() => window.location.href = `/orders/${o.id}`}
                >
                  <td className="px-4 py-2 font-medium">#{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(o.total)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`badge status-${o.status}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right" style={{ color: 'var(--muted)' }}>
                    {formatDate(o.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
