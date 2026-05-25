// ── Commerce Actions ─────────────────────────────────────────
// Server-side validated action execution.
// The AI proposes actions; this module validates and executes them.
// NEVER trust the AI — always validate against real DB data.

import { createServiceClient } from '@/lib/supabase/service'
import { addToCart, clearCart, getCartItems } from './cart'
import type { AgentAction } from '@/lib/types/whatsapp.types'

export interface ActionResult {
  ok: boolean
  message: string
  data?: Record<string, unknown>
}

export async function executeAction(
  action: AgentAction,
  context: { organizationId: string | null; customerId: string | null; phone: string }
): Promise<ActionResult> {
  switch (action.type) {
    case 'add_to_cart':
      return handleAddToCart(action, context)
    case 'remove_from_cart':
      return handleRemoveFromCart(action)
    case 'checkout':
      return handleCheckout(action, context)
    case 'cancel_order':
      return handleCancelOrder(action, context)
    case 'apply_coupon':
      return handleApplyCoupon(action, context)
    case 'human_handoff':
      return handleHumanHandoff(action, context)
    default:
      return { ok: false, message: 'Acción desconocida' }
  }
}

async function handleAddToCart(
  action: AgentAction,
  context: { organizationId: string | null; customerId: string | null; phone: string }
): Promise<ActionResult> {
  const { variantId, quantity = 1 } = action.payload as { variantId?: string; quantity?: number }
  if (!variantId || !context.organizationId) {
    return { ok: false, message: 'Faltan datos para agregar al carrito' }
  }

  const result = await addToCart(
    context.organizationId,
    context.customerId,
    variantId,
    quantity,
    context.phone
  )

  if (!result.ok) {
    return { ok: false, message: result.error ?? 'Error al agregar al carrito' }
  }

  return { ok: true, message: 'Producto agregado al carrito' }
}

async function handleRemoveFromCart(action: AgentAction): Promise<ActionResult> {
  const { itemId } = action.payload as { itemId?: string }
  if (!itemId) return { ok: false, message: 'Falta el item a quitar' }

  try {
    const sb = createServiceClient()
    await sb.from('cart_items').delete().eq('id', itemId)
    return { ok: true, message: 'Producto quitado del carrito' }
  } catch {
    return { ok: false, message: 'Error al quitar el producto' }
  }
}

async function handleCheckout(
  action: AgentAction,
  context: { organizationId: string | null; customerId: string | null }
): Promise<ActionResult> {
  const { address, paymentMethod } = action.payload as { address?: string; paymentMethod?: string }
  if (!context.organizationId || !context.customerId) {
    return { ok: false, message: 'Necesito identificarte para procesar el pedido' }
  }

  if (!address) {
    return { ok: false, message: '¿Cuál es tu dirección para el envío?' }
  }

  const cart = await getCartItems(context.organizationId, context.customerId)
  if (cart.items.length === 0) {
    return { ok: false, message: 'Tu carrito está vacío' }
  }

  const sb = createServiceClient()
  const subtotal = cart.total

  const { data: order } = await sb.from('orders').insert({
    organization_id: context.organizationId,
    customer_id: context.customerId,
    subtotal,
    shipping_cost: 0,
    discount: 0,
    total: subtotal,
    shipping_address: address,
    payment_method: paymentMethod ?? null,
    status: 'pending',
    payment_status: 'pending',
    source: 'whatsapp',
  }).select('id').single()

  if (!order) return { ok: false, message: 'Error al crear el pedido' }

  // Insert order items
  const orderItems = cart.items.map(i => ({
    order_id: order.id,
    variant_id: i.variantId,
    product_name: i.productName,
    variant_label: i.variantLabel,
    quantity: i.quantity,
    unit_price: i.unitPrice,
    total: i.total,
  }))

  await sb.from('order_items').insert(orderItems)

  // Clear the cart
  if (cart.cartId) await clearCart(cart.cartId)

  // Update customer stats
  await sb.from('customers').update({
    total_orders: sb.rpc('increment', { x: 1 }),
    lifetime_value: sb.rpc('increment', { x: subtotal }),
    last_order_at: new Date().toISOString(),
  }).eq('id', context.customerId)

  return {
    ok: true,
    message: `Pedido #${order.id} creado por $${subtotal}`,
    data: { orderId: order.id, total: subtotal },
  }
}

async function handleCancelOrder(
  action: AgentAction,
  context: { organizationId: string | null }
): Promise<ActionResult> {
  const { orderId } = action.payload as { orderId?: string }
  if (!orderId || !context.organizationId) {
    return { ok: false, message: 'Falta el pedido a cancelar' }
  }

  const sb = createServiceClient()
  const { data: order } = await sb.from('orders')
    .select('status')
    .eq('id', orderId)
    .eq('organization_id', context.organizationId)
    .maybeSingle()

  if (!order) return { ok: false, message: 'Pedido no encontrado' }
  const o = order as { status: string }
  if (o.status === 'shipped' || o.status === 'delivered') {
    return { ok: false, message: 'No se puede cancelar un pedido ya enviado' }
  }

  await sb.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
  return { ok: true, message: `Pedido #${orderId} cancelado` }
}

async function handleApplyCoupon(
  action: AgentAction,
  context: { organizationId: string | null }
): Promise<ActionResult> {
  const { code } = action.payload as { code?: string }
  if (!code || !context.organizationId) {
    return { ok: false, message: 'Falta el código de descuento' }
  }

  const sb = createServiceClient()
  const { data: coupon } = await sb.from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('organization_id', context.organizationId)
    .eq('is_active', true)
    .maybeSingle()

  if (!coupon) return { ok: false, message: 'Código inválido' }
  const c = coupon as Record<string, unknown>

  if (c.expires_at && new Date(c.expires_at as string) < new Date()) {
    return { ok: false, message: 'El código ya expiró' }
  }
  if ((c.max_uses as number) > 0 && (c.used_count as number) >= (c.max_uses as number)) {
    return { ok: false, message: 'El código ya no tiene usos disponibles' }
  }

  return {
    ok: true,
    message: `Cupón aplicado: ${c.type === 'percentage' ? `${c.value}%` : `$${c.value}`} de descuento`,
    data: coupon as Record<string, unknown>,
  }
}

async function handleHumanHandoff(
  action: AgentAction,
  context: { organizationId: string | null; phone: string }
): Promise<ActionResult> {
  const reason = (action.payload as { reason?: string }).reason ?? 'Solicitado por el cliente'
  try {
    const sb = createServiceClient()
    await sb.from('conversations')
      .update({
        human_takeover: true,
        human_takeover_at: new Date().toISOString(),
        human_takeover_reason: reason,
        status: 'human',
      })
      .eq('channel_contact_id', context.phone)
    return { ok: true, message: 'Transferido a humano', data: { reason } }
  } catch {
    return { ok: false, message: 'Error al transferir' }
  }
}
