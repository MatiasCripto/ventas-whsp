// ── Server-side validation for commerce actions ─────────────
// The AI proposes; the backend validates.
// Every action is validated against real DB data before execution.

import { createServiceClient } from '@/lib/supabase/service'

export interface ValidationResult {
  valid: boolean
  error?: string
  data?: Record<string, unknown>
}

export async function validateAddToCart(
  variantId: string,
  quantity: number,
  organizationId: string
): Promise<ValidationResult> {
  if (quantity < 1) return { valid: false, error: 'La cantidad debe ser al menos 1' }
  if (quantity > 99) return { valid: false, error: 'Cantidad máxima: 99 unidades' }

  const sb = createServiceClient()
  const { data: variant } = await sb
    .from('product_variants')
    .select('id, stock, is_active, product:products(organization_id, is_active)')
    .eq('id', variantId)
    .maybeSingle()

  if (!variant) return { valid: false, error: 'Variante no encontrada' }
  const v = variant as Record<string, unknown>

  if (v.is_active === false) return { valid: false, error: 'Esta variante ya no está disponible' }

  const product = v.product as Record<string, unknown> | null
  if (!product) return { valid: false, error: 'Producto no encontrado' }
  if (product.is_active === false) return { valid: false, error: 'Este producto ya no está disponible' }
  if (product.organization_id !== organizationId) {
    return { valid: false, error: 'El producto no pertenece a esta tienda' }
  }

  if ((v.stock as number) < quantity) {
    return { valid: false, error: `Stock insuficiente. Disponible: ${v.stock}` }
  }

  return { valid: true }
}

export async function validateCheckout(
  customerId: string,
  organizationId: string
): Promise<ValidationResult> {
  const sb = createServiceClient()
  const { data: customer } = await sb
    .from('customers')
    .select('id, full_name, total_orders')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!customer) return { valid: false, error: 'Cliente no encontrado' }

  const { data: cart } = await sb
    .from('carts')
    .select('id')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!cart) return { valid: false, error: 'No hay carrito activo' }

  const { data: items } = await sb
    .from('cart_items')
    .select('quantity, variant:product_variants(stock)')
    .eq('cart_id', cart.id)

  if (!items || items.length === 0) return { valid: false, error: 'El carrito está vacío' }

  // Validate stock for all items
  for (const item of items as Array<Record<string, unknown>>) {
    const variant = item.variant as { stock: number } | null
    if (variant && (item.quantity as number) > variant.stock) {
      return { valid: false, error: `Stock insuficiente para uno de los productos en tu carrito` }
    }
  }

  return { valid: true, data: { customer } }
}

export async function validateCancelOrder(
  orderId: string,
  organizationId: string,
  customerId: string | null
): Promise<ValidationResult> {
  const sb = createServiceClient()
  let query = sb.from('orders').select('id, status').eq('id', orderId).eq('organization_id', organizationId)
  if (customerId) query = query.eq('customer_id', customerId)

  const { data: order } = await query.maybeSingle()
  if (!order) return { valid: false, error: 'Pedido no encontrado' }

  const o = order as { status: string }
  const cancellable = ['pending', 'confirmed', 'paid']
  if (!cancellable.includes(o.status)) {
    return { valid: false, error: `No se puede cancelar un pedido en estado "${o.status}"` }
  }

  return { valid: true }
}

export async function validateCoupon(
  code: string,
  organizationId: string,
  subtotal: number
): Promise<ValidationResult> {
  const sb = createServiceClient()
  const { data: coupon } = await sb
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle()

  if (!coupon) return { valid: false, error: 'Código inválido' }

  const c = coupon as Record<string, unknown>

  if (c.expires_at && new Date(c.expires_at as string) < new Date()) {
    return { valid: false, error: 'Este código ya expiró' }
  }
  if ((c.max_uses as number) > 0 && (c.used_count as number) >= (c.max_uses as number)) {
    return { valid: false, error: 'Este código ya no tiene usos disponibles' }
  }
  if ((c.min_purchase as number) > 0 && subtotal < (c.min_purchase as number)) {
    return { valid: false, error: `Compra mínima: $${c.min_purchase}` }
  }

  return { valid: true, data: coupon as Record<string, unknown> }
}
