'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Truck, CreditCard, User, Image as ImageIcon, CheckCircle, XCircle, Plus, Trash2, Clock, Package } from 'lucide-react'
import { formatCurrency, formatDateTime, getOrderStatusConfig, getPaymentStatusConfig } from '@/lib/utils/formatters'
import type { Order, OrderItem, PaymentProof, Product, ProductVariant, OrderEvent } from '@/lib/types'

const STATUS_FLOW = ['pending', 'awaiting_payment', 'payment_under_review', 'payment_confirmed', 'preparing', 'shipped', 'delivered', 'completed']
const CANCEL_STATUSES = ['pending', 'awaiting_payment']
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  awaiting_payment: 'Esperando pago',
  payment_under_review: 'Pago en revisión',
  payment_confirmed: 'Pago confirmado',
  preparing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  expired: 'Expirado',
}

function getEventConfig(type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    created:                { label: 'Pedido creado',                color: '#3b82f6' },
    stock_reserved:         { label: 'Stock reservado',             color: '#8b5cf6' },
    payment_requested:      { label: 'Pago solicitado',             color: '#f59e0b' },
    proof_received:         { label: 'Comprobante recibido',        color: '#10b981' },
    payment_approved:       { label: 'Pago aprobado',               color: '#10b981' },
    payment_rejected:       { label: 'Pago rechazado',              color: '#ef4444' },
    preparing:              { label: 'En preparación',              color: '#3b82f6' },
    shipped:                { label: 'Enviado',                     color: '#8b5cf6' },
    delivered:              { label: 'Entregado',                   color: '#10b981' },
    completed:              { label: 'Completado',                  color: '#10b981' },
    cancelled:              { label: 'Cancelado',                   color: '#ef4444' },
    expired:                { label: 'Expirado',                    color: '#6b7280' },
    refunded:               { label: 'Reembolsado',                 color: '#f59e0b' },
    item_added:             { label: 'Producto agregado',           color: '#3b82f6' },
    item_removed:           { label: 'Producto removido',           color: '#ef4444' },
    quantity_modified:      { label: 'Cantidad modificada',         color: '#f59e0b' },
    note_added:             { label: 'Nota agregada',               color: '#6b7280' },
  }
  return map[type] ?? { label: type.replace(/_/g, ' '), color: '#6b7280' }
}

export default function OrderDetailPage() {
  const { authUser } = useAuthContext()
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([])
  const [reviewNote, setReviewNote] = useState('')
  const [events, setEvents] = useState<OrderEvent[]>([])

  // Item editing state
  const [showAddItem, setShowAddItem] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [addQuantity, setAddQuantity] = useState(1)

  useEffect(() => {
    if (!authUser?.organization?.id || !params.id) return
    async function load() {
      const orgId = authUser?.organization?.id
      if (!orgId) return
      try {
        const sb = createClient()
        const { data } = await sb.from('orders')
          .select('*, customer:customers(*), items:order_items(*)')
          .eq('id', params.id as string)
          .eq('organization_id', orgId)
          .single()
        setOrder(data as unknown as Order)

        // Load payment proofs
        const { data: proofs } = await sb.from('payment_proofs')
          .select('*')
          .eq('order_id', params.id as string)
          .order('uploaded_at', { ascending: false })
        setPaymentProofs((proofs ?? []) as PaymentProof[])

        // Load order timeline events
        const { data: orderEvents } = await sb.from('order_events')
          .select('*')
          .eq('order_id', params.id as string)
          .order('created_at', { ascending: false })
        setEvents((orderEvents ?? []) as OrderEvent[])

        // Load products for item editing
        const { data: prods } = await sb.from('products')
          .select('*, variants:product_variants(*)')
          .eq('organization_id', orgId)
          .eq('is_active', true)
        setProducts((prods ?? []) as Product[])
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
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Error al cambiar estado')
        return
      }
      setOrder({ ...order, status: newStatus as Order['status'] })
    } catch {
      alert('Error de red al cambiar estado')
    }
    setUpdating(false)
  }

  async function handleApprovePayment(proofId: string) {
    if (!order || !authUser) return
    setUpdating(true)
    try {
      const sb = createClient()
      await sb.from('payment_proofs').update({
        status: 'approved',
        reviewed_by: authUser.user.id,
        reviewed_at: new Date().toISOString(),
        notes: reviewNote || null,
      }).eq('id', proofId)
      // Transition order status via API (logs audit event)
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'payment_confirmed' }),
      })
      if (!res.ok) {
        // Fallback: direct update
        await sb.from('orders').update({
          status: 'payment_confirmed',
          payment_status: 'confirmed',
        }).eq('id', order.id)
      }
      setOrder({ ...order, status: 'payment_confirmed', payment_status: 'confirmed' })
      setPaymentProofs(prev => prev.map(p => p.id === proofId ? { ...p, status: 'approved' as const } : p))
    } catch { /* ignore */ }
    setUpdating(false)
  }

  async function handleRejectPayment(proofId: string) {
    if (!order || !authUser) return
    setUpdating(true)
    try {
      const sb = createClient()
      await sb.from('payment_proofs').update({
        status: 'rejected',
        reviewed_by: authUser.user.id,
        reviewed_at: new Date().toISOString(),
        notes: reviewNote || null,
      }).eq('id', proofId)
      setPaymentProofs(prev => prev.map(p => p.id === proofId ? { ...p, status: 'rejected' as const } : p))
    } catch { /* ignore */ }
    setUpdating(false)
  }

  async function handleAddItem() {
    if (!order || !selectedVariantId || addQuantity < 1) return
    setUpdating(true)
    try {
      const sb = createClient()
      const variant = products.flatMap(p => p.variants ?? []).find(v => v.id === selectedVariantId)
      const product = products.find(p => (p.variants ?? []).some(v => v.id === selectedVariantId))
      if (!variant || !product) return

      const unitPrice = variant.price_override ?? product.price
      const total = unitPrice * addQuantity

      const { error } = await sb.from('order_items').insert({
        order_id: order.id,
        variant_id: selectedVariantId,
        product_name: product.name,
        variant_label: Object.values(variant.attribute_values ?? {}).filter(Boolean).join(' / '),
        quantity: addQuantity,
        unit_price: unitPrice,
        total,
      })
      if (error) return

      // Recalculate order totals
      const { data: items } = await sb.from('order_items').select('total').eq('order_id', order.id)
      const newSubtotal = (items ?? []).reduce((sum, i) => sum + (i.total ?? 0), 0)
      const newTotal = newSubtotal + (order.shipping_cost ?? 0) - (order.discount ?? 0)
      await sb.from('orders').update({ subtotal: newSubtotal, total: newTotal }).eq('id', order.id)

      // Refresh order
      const { data } = await sb.from('orders')
        .select('*, customer:customers(*), items:order_items(*)')
        .eq('id', order.id)
        .single()
      if (data) setOrder(data as unknown as Order)
      setShowAddItem(false)
      setSelectedProductId('')
      setSelectedVariantId('')
      setAddQuantity(1)
    } catch { /* ignore */ }
    setUpdating(false)
  }

  async function handleRemoveItem(itemId: string) {
    if (!order) return
    setUpdating(true)
    try {
      const sb = createClient()
      await sb.from('order_items').delete().eq('id', itemId).eq('order_id', order.id)

      // Recalculate
      const { data: items } = await sb.from('order_items').select('total').eq('order_id', order.id)
      const newSubtotal = (items ?? []).reduce((sum, i) => sum + (i.total ?? 0), 0)
      const newTotal = newSubtotal + (order.shipping_cost ?? 0) - (order.discount ?? 0)
      await sb.from('orders').update({ subtotal: newSubtotal, total: newTotal }).eq('id', order.id)

      const { data } = await sb.from('orders')
        .select('*, customer:customers(*), items:order_items(*)')
        .eq('id', order.id)
        .single()
      if (data) setOrder(data as unknown as Order)
    } catch { /* ignore */ }
    setUpdating(false)
  }

  const selectedProduct = products.find(p => p.id === selectedProductId)

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
  if (!order) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Pedido no encontrado</div>

  const statusCfg = getOrderStatusConfig(order.status)
  const payCfg = getPaymentStatusConfig(order.payment_status)
  const canCancel = CANCEL_STATUSES.includes(order.status)
  const currentIdx = STATUS_FLOW.indexOf(order.status)
  const editableStatuses = ['pending', 'awaiting_payment', 'payment_under_review', 'payment_confirmed', 'preparing']
  const canEdit = editableStatuses.includes(order.status)
  const pendingProof = paymentProofs.find(p => p.status === 'pending')

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/orders" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={18} />
          </a>
          <h1 className="text-xl font-semibold">Pedido #{order.id.slice(0, 8)}</h1>
          <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] font-medium"
            style={{ background: statusCfg.bg, color: statusCfg.color }}>
            {statusCfg.label}
          </span>
        </div>
        {canCancel && (
          <button onClick={() => handleUpdateStatus('cancelled')} disabled={updating}
            className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-white"
            style={{ background: 'var(--danger)' }}
          >
            Cancelar Pedido
          </button>
        )}
      </div>

      {/* Status timeline (read-only) */}
      <div className="card p-5">
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((s, i) => {
            const cfg = getOrderStatusConfig(s as Order['status'])
            const done = i <= currentIdx
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-3 h-3 rounded-full transition-colors"
                  style={{ background: done ? cfg.color : 'var(--surface-2)' }}
                />
                <span className="text-[10px] text-center leading-tight" style={{ color: done ? cfg.color : 'var(--subtle)' }}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Available transitions */}
        {order.status !== 'cancelled' && order.status !== 'refunded' && order.status !== 'expired' && order.status !== 'completed' && (
          <div className="mt-4 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-medium w-full mb-1" style={{ color: 'var(--subtle)' }}>
              Asignar estado manual:
            </span>
            {STATUS_FLOW.slice(currentIdx + 1).map(s => {
              const cfg = getOrderStatusConfig(s as Order['status'])
              return (
                <button
                  key={s}
                  onClick={() => handleUpdateStatus(s)}
                  disabled={updating}
                  className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-opacity disabled:opacity-50 text-white"
                  style={{ background: cfg.color }}
                >
                  {STATUS_LABELS[s] ?? s}
                </button>
              )
            })}
            <button
              onClick={() => handleUpdateStatus('cancelled')}
              disabled={updating}
              className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-white"
              style={{ background: 'var(--danger)' }}
            >
              Cancelar pedido
            </button>
          </div>
        )}

        {order.status === 'cancelled' && (
          <div className="text-center mt-3">
            <span className="text-xs px-2 py-1 rounded-[var(--radius-full)] font-medium status-cancelled">
              Este pedido fue cancelado
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

      {/* ── Payment Proofs ──────────────────────────────────── */}
      {paymentProofs.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon size={14} style={{ color: 'var(--muted)' }} />
            Comprobantes de pago
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {paymentProofs.map(proof => (
              <div key={proof.id} className="rounded-[var(--radius-md)] overflow-hidden border"
                style={{ borderColor: 'var(--border)' }}>
                <a href={proof.image_url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proof.image_url} alt="Comprobante" className="w-full h-40 object-cover" />
                </a>
                <div className="p-2 flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-[var(--radius-full)] ${
                    proof.status === 'approved' ? 'status-confirmed' :
                    proof.status === 'rejected' ? 'status-cancelled' :
                    'status-pending'
                  }`}>
                    {proof.status === 'approved' ? 'Aprobado' : proof.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--subtle)' }}>
                    {new Date(proof.uploaded_at).toLocaleDateString('es-AR')}
                  </span>
                </div>
                {/* OCR extracted data */}
                {proof.extracted_amount !== null || proof.extracted_alias || proof.extracted_bank ? (
                  <div className="px-2 pb-2 space-y-1">
                    <div className="text-[10px] font-medium" style={{ color: 'var(--subtle)' }}>Datos extraídos:</div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                      {proof.extracted_amount !== null && (
                        <><span style={{ color: 'var(--subtle)' }}>Monto:</span><span className="font-medium">{formatCurrency(proof.extracted_amount)}</span></>
                      )}
                      {proof.extracted_alias && (
                        <><span style={{ color: 'var(--subtle)' }}>Alias:</span><span>{proof.extracted_alias}</span></>
                      )}
                      {proof.extracted_bank && (
                        <><span style={{ color: 'var(--subtle)' }}>Banco:</span><span>{proof.extracted_bank}</span></>
                      )}
                      {proof.extracted_holder && (
                        <><span style={{ color: 'var(--subtle)' }}>Titular:</span><span>{proof.extracted_holder}</span></>
                      )}
                    </div>
                    {proof.ocr_confidence !== null && (
                      <div className="text-[10px]" style={{ color: 'var(--subtle)' }}>
                        Confianza: {Math.round(proof.ocr_confidence * 100)}%
                      </div>
                    )}
                  </div>
                ) : null}
                {/* Approve/Reject actions */}
                {proof.status === 'pending' && (
                  <div className="p-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                    <input
                      type="text"
                      placeholder="Nota (opcional)"
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded-[var(--radius-sm)] border"
                      style={{ borderColor: 'var(--border)' }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovePayment(proof.id)}
                        disabled={updating}
                        className="flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-[var(--radius-sm)] text-white"
                        style={{ background: 'var(--success)' }}
                      >
                        <CheckCircle size={12} /> Aprobar
                      </button>
                      <button
                        onClick={() => handleRejectPayment(proof.id)}
                        disabled={updating}
                        className="flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-[var(--radius-sm)] text-white"
                        style={{ background: 'var(--danger)' }}
                      >
                        <XCircle size={12} /> Rechazar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Order Timeline ────────────────────────────────────── */}
      {events.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock size={14} style={{ color: 'var(--muted)' }} />
            Línea de tiempo
          </div>
          <div className="relative pl-6 space-y-0">
            {events.map((ev, idx) => {
              const cfg = getEventConfig(ev.type)
              const isLast = idx === events.length - 1
              return (
                <div key={ev.id} className="relative pb-4">
                  {/* Vertical line (except last) */}
                  {!isLast && (
                    <div className="absolute left-[-11px] top-3 bottom-0 w-px"
                      style={{ background: 'var(--border)' }} />
                  )}
                  {/* Dot */}
                  <div className="absolute left-[-15px] top-0.5 w-2 h-2 rounded-full"
                    style={{ background: cfg.color }} />
                  {/* Content */}
                  <div className="text-sm">{cfg.label}</div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--subtle)' }}>
                    <span>{new Date(ev.created_at).toLocaleString('es-AR')}</span>
                    <span className="capitalize">{ev.actor_type}</span>
                  </div>
                  {ev.type === 'payment_rejected' && (ev.metadata?.notes as string) && (
                    <div className="text-xs mt-1 p-2 rounded-[var(--radius-sm)] status-cancelled">
                      {ev.metadata.notes as string}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick transition buttons for payment_under_review */}
      {order.status === 'payment_under_review' && !pendingProof && (
        <div className="card p-4">
          <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Sin comprobantes pendientes. Acción rápida:</p>
          <div className="flex gap-2">
            <button onClick={() => handleUpdateStatus('payment_confirmed')} disabled={updating}
              className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-white"
              style={{ background: 'var(--success)' }}>
              Confirmar pago manualmente
            </button>
            <button onClick={() => handleUpdateStatus('preparing')} disabled={updating}
              className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
              Pasar a preparación
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm">Productos</h2>
          {canEdit && (
            <button onClick={() => setShowAddItem(!showAddItem)}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-[var(--radius-sm)]"
              style={{ background: 'var(--brand)', color: '#fff' }}>
              <Plus size={12} /> Agregar
            </button>
          )}
        </div>

        {/* Add item form */}
        {showAddItem && (
          <div className="p-4 border-b space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <div>
              <label className="text-xs font-medium block mb-1">Producto</label>
              <select value={selectedProductId} onChange={e => { setSelectedProductId(e.target.value); setSelectedVariantId('') }}
                className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-sm)] border"
                style={{ borderColor: 'var(--border)' }}>
                <option value="">Seleccionar...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>
                ))}
              </select>
            </div>
            {selectedProduct && (selectedProduct.variants?.length ?? 0) > 0 && (
              <div>
                <label className="text-xs font-medium block mb-1">Variante</label>
                <select value={selectedVariantId} onChange={e => setSelectedVariantId(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-sm)] border"
                  style={{ borderColor: 'var(--border)' }}>
                  <option value="">Seleccionar...</option>
                  {selectedProduct.variants?.filter(v => v.is_active).map(v => (
                    <option key={v.id} value={v.id}>
                      {Object.values(v.attribute_values ?? {}).filter(Boolean).join(' / ') || 'Sin variante'} — Stock: {v.stock}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Cantidad</label>
                <input type="number" min={1} value={addQuantity} onChange={e => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-sm)] border"
                  style={{ borderColor: 'var(--border)' }} />
              </div>
              <button onClick={handleAddItem} disabled={updating || !selectedVariantId}
                className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-white"
                style={{ background: selectedVariantId ? 'var(--brand)' : 'var(--surface-2)' }}>
                Agregar
              </button>
            </div>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th className="text-left px-4 py-2 font-medium">Producto</th>
              <th className="text-left px-4 py-2 font-medium">Variante</th>
              <th className="text-right px-4 py-2 font-medium">Cant.</th>
              <th className="text-right px-4 py-2 font-medium">Precio</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
              {canEdit && <th className="text-right px-4 py-2 font-medium">Acción</th>}
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
                {canEdit && (
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleRemoveItem(item.id)} disabled={updating}
                      className="p-1 rounded-[var(--radius-sm)] hover:bg-red-50 transition-colors"
                      title="Eliminar">
                      <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
              <td colSpan={canEdit ? 4 : 4} className="px-4 py-2 text-right text-xs" style={{ color: 'var(--muted)' }}>Subtotal</td>
              <td className="px-4 py-2 text-right text-sm">{formatCurrency(order.subtotal)}</td>
              {canEdit && <td />}
            </tr>
            {order.shipping_cost > 0 && (
              <tr>
                <td colSpan={canEdit ? 4 : 4} className="px-4 py-2 text-right text-xs" style={{ color: 'var(--muted)' }}>Envío</td>
                <td className="px-4 py-2 text-right text-sm">{formatCurrency(order.shipping_cost)}</td>
                {canEdit && <td />}
              </tr>
            )}
            {order.discount > 0 && (
              <tr>
                <td colSpan={canEdit ? 4 : 4} className="px-4 py-2 text-right text-xs" style={{ color: 'var(--muted)' }}>Descuento</td>
                <td className="px-4 py-2 text-right text-sm" style={{ color: 'var(--success)' }}>-{formatCurrency(order.discount)}</td>
                {canEdit && <td />}
              </tr>
            )}
            <tr className="border-t-2" style={{ borderColor: 'var(--border)' }}>
              <td colSpan={canEdit ? 4 : 4} className="px-4 py-2 text-right text-sm font-semibold">Total</td>
              <td className="px-4 py-2 text-right font-bold">{formatCurrency(order.total)}</td>
              {canEdit && <td />}
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
