// ── Conversational Cart Management ──────────────────────────
// Server-side validated cart operations.
// The AI proposes; the backend validates and executes.

import { createServiceClient } from '@/lib/supabase/service'

export interface CartItemResult {
  id: string
  variantId: string
  productName: string
  variantLabel: string
  quantity: number
  unitPrice: number
  total: number
  image: string | null
  stock: number
}

export async function getOrCreateCart(
  organizationId: string,
  customerId: string | null,
  sessionId?: string
): Promise<string> {
  const sb = createServiceClient()

  // If customer exists, find their active cart
  if (customerId) {
    const { data: existing } = await sb
      .from('carts')
      .select('id')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existing) return existing.id
  }

  // Create new cart
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 72) // 72h expiry

  const { data: cart } = await sb
    .from('carts')
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      session_id: sessionId ?? null,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (!cart) throw new Error('Failed to create cart')
  return cart.id
}

export async function addToCart(
  organizationId: string,
  customerId: string | null,
  variantId: string,
  quantity: number,
  sessionId?: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient()

  // Validate variant exists and has stock
  const { data: variant } = await sb
    .from('product_variants')
    .select('id, stock, price_override, is_active, product:products(id, name, price, organization_id)')
    .eq('id', variantId)
    .maybeSingle()

  if (!variant) return { ok: false, error: 'Variante no encontrada' }
  const v = variant as Record<string, unknown>
  if (v.is_active === false) return { ok: false, error: 'Esta variante ya no está disponible' }
  if ((v.stock as number) < quantity) return { ok: false, error: `Stock insuficiente. Disponible: ${v.stock}` }

  const product = v.product as Record<string, unknown> | null
  if (!product) return { ok: false, error: 'Producto no encontrado' }

  // Validate org matches
  if (product.organization_id !== organizationId) {
    return { ok: false, error: 'Producto no pertenece a esta tienda' }
  }

  const unitPrice = (v.price_override as number | null) ?? (product.price as number)

  // Get or create cart
  const cartId = await getOrCreateCart(organizationId, customerId, sessionId)

  // Check if variant already in cart
  const { data: existingItem } = await sb
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('variant_id', variantId)
    .maybeSingle()

  if (existingItem) {
    const newQty = (existingItem.quantity as number) + quantity
    if (newQty > (v.stock as number)) {
      return { ok: false, error: `Ya tenés ${existingItem.quantity} en tu carrito. No hay más stock disponible.` }
    }
    await sb.from('cart_items').update({ quantity: newQty }).eq('id', existingItem.id)
  } else {
    await sb.from('cart_items').insert({
      cart_id: cartId,
      variant_id: variantId,
      quantity,
    })
  }

  return { ok: true }
}

export async function getCartItems(
  organizationId: string,
  customerId: string | null,
  sessionId?: string
): Promise<{ items: CartItemResult[]; total: number; cartId: string | null }> {
  const sb = createServiceClient()

  let cartId: string | null = null

  if (customerId) {
    const { data: cart } = await sb
      .from('carts')
      .select('id')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle()
    if (cart) cartId = cart.id
  }

  if (!cartId && sessionId) {
    const { data: cart } = await sb
      .from('carts')
      .select('id')
      .eq('session_id', sessionId)
      .eq('organization_id', organizationId)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle()
    if (cart) cartId = cart.id
  }

  if (!cartId) return { items: [], total: 0, cartId: null }

  const { data: items } = await sb
    .from('cart_items')
    .select(`
      id, variant_id, quantity,
      variant:product_variants(
        id, color, size, stock, price_override,
        product:products(id, name, price, images)
      )
    `)
    .eq('cart_id', cartId)
    .order('added_at', { ascending: true })

  if (!items) return { items: [], total: 0, cartId }

  const results: CartItemResult[] = []
  let total = 0

  for (const item of items as Array<Record<string, unknown>>) {
    const variant = item.variant as Record<string, unknown>
    const product = variant?.product as Record<string, unknown> | null
    if (!product) continue

    const unitPrice = (variant.price_override as number | null) ?? (product.price as number)
    const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ')
    const lineTotal = unitPrice * (item.quantity as number)
    total += lineTotal
    const images = (product.images as string[]) ?? []

    results.push({
      id: item.id as string,
      variantId: item.variant_id as string,
      productName: product.name as string,
      variantLabel,
      quantity: item.quantity as number,
      unitPrice,
      total: lineTotal,
      image: images[0] ?? null,
      stock: (variant.stock as number) ?? 0,
    })
  }

  return { items: results, total, cartId }
}

export async function removeFromCart(itemId: string): Promise<void> {
  const sb = createServiceClient()
  await sb.from('cart_items').delete().eq('id', itemId)
}

export async function updateCartItemQuantity(itemId: string, quantity: number): Promise<{ ok: boolean; error?: string }> {
  if (quantity < 1) {
    await removeFromCart(itemId)
    return { ok: true }
  }

  const sb = createServiceClient()
  const { data: item } = await sb
    .from('cart_items')
    .select('variant:product_variants(stock)')
    .eq('id', itemId)
    .maybeSingle()

  if (item) {
    const variant = item.variant as unknown as Record<string, unknown> | null
    if (variant && (variant.stock as number) < quantity) {
      return { ok: false, error: `Stock insuficiente. Máximo: ${variant.stock}` }
    }
  }

  await sb.from('cart_items').update({ quantity }).eq('id', itemId)
  return { ok: true }
}

export async function clearCart(cartId: string): Promise<void> {
  const sb = createServiceClient()
  await sb.from('cart_items').delete().eq('cart_id', cartId)
}
