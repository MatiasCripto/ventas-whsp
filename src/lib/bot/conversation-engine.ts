// ── Conversation engine for Concierge AI ────────────────────────
// Manages conversation state, persistence, and customer lookup

import { createServiceClient } from '@/lib/supabase/service'
import type { BotContext } from '@/lib/types/whatsapp.types'
import { recordOrderEvent } from '@/lib/services/order-event.service'
import { reserveStockForOrder } from '@/lib/services/stock-reservation.service'
import { getVariantAvailableStock } from '@/lib/repositories/stock-reservation.repository'
import type { AgentAction } from './ai-chat'
import { getProductEmoji } from '@/lib/bot/product-emoji-map'

function createContext(phone: string): BotContext {
  return {
    phone,
    customerId: null,
    customerName: null,
    state: 'idle',
    selectedProductId: null,
    selectedOrderId: null,
    lastMessageAt: new Date().toISOString(),
    messageCount: 0,
    isKnownCustomer: false,
  }
}

export async function getOrCreateConversation(orgId: string, storeId: string | null, phone: string, pushName?: string) {
  const sb = createServiceClient()
  // Try to find existing customer by phone, or create one
  let { data: customer } = await sb.from('customers')
    .select('id, full_name')
    .eq('organization_id', orgId)
    .eq('phone', phone)
    .maybeSingle()

  if (!customer) {
    const { data: newCustomer } = await sb.from('customers').insert({
      organization_id: orgId,
      phone,
      full_name: pushName ?? null,
    }).select('id, full_name').single()
    customer = newCustomer ?? null
  }

  let customerId = customer?.id ?? null
  let customerName = customer?.full_name ?? pushName ?? null
  console.log('[CHECKOUT] getOrCreateConversation', { phone, customerId, customerName, customerFound: !!customer })

  // Find existing open conversation
  const { data: existing } = await sb.from('conversations')
    .select('id, status, context')
    .eq('organization_id', orgId)
    .eq('channel', 'whatsapp')
    .eq('channel_contact_id', phone)
    .in('status', ['open', 'bot', 'human'])
    .maybeSingle()

  if (existing) {
    const ctx = (existing.context as BotContext) ?? createContext(phone)
    // Merge customer info into the existing context if it's missing
    if (customerId && !ctx.customerId) {
      ctx.customerId = customerId
      ctx.customerName = customerName
      ctx.isKnownCustomer = true
      // Pre-fill checkout data from customer record (migration 013 adds dni/default_address)
      // if (customer?.dni) ctx.checkoutDni = customer.dni
      // if (customer?.default_address) ctx.checkoutAddress = customer.default_address
      await sb.from('conversations').update({
        customer_id: customerId,
        context: ctx,
      }).eq('id', existing.id)
    }
    return { conversationId: existing.id, context: ctx, isNew: false }
  }

  // Create new conversation
  const ctx = createContext(phone)
  if (customerName) ctx.customerName = customerName
  if (customerId) { ctx.customerId = customerId; ctx.isKnownCustomer = true }

  const { data: conv } = await sb.from('conversations').insert({
    organization_id: orgId,
    store_id: storeId,
    customer_id: customerId,
    channel: 'whatsapp',
    channel_contact_id: phone,
    channel_chat_id: phone,
    status: 'bot',
    context: ctx,
  }).select('id').single()

  return { conversationId: conv?.id, context: ctx, isNew: true }
}

export async function saveMessage(convId: string, direction: 'inbound' | 'outbound', body: string) {
  const sb = createServiceClient()
  await sb.from('messages').insert({
    conversation_id: convId,
    direction,
    type: 'text',
    body,
    sent_at: new Date().toISOString(),
  })
}

export async function updateContext(convId: string, ctx: BotContext) {
  ctx.lastMessageAt = new Date().toISOString()
  ctx.messageCount++
  const sb = createServiceClient()
  await sb.from('conversations').update({ context: ctx }).eq('id', convId)
}

// ── Data fetching for AI context ──────────────────────────────

export async function fetchProducts(sb: any, orgId: string) {
  const { data } = await sb.from('products')
    .select(`
      id, name, slug, description, price, compare_price,
      brand, tags, images, category_id, featured,
      variants:product_variants(
        id, sku, color, size, stock, price_override, images, is_active
      )
    `)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('featured', { ascending: false })
    .limit(50)

  return data?.map((p: any) => ({
    ...p,
    variants: p.variants?.filter((v: any) => v.is_active) ?? []
  })) ?? []
}

// ── Catalog search layer ─────────────────────────────────────────
// Allows filtering products by text search, category, price range, and tags.

export interface SearchProductsParams {
  search?: string
  categoryId?: string
  minPrice?: number
  maxPrice?: number
  tags?: string[]
}

export async function searchProducts(sb: any, orgId: string, params: SearchProductsParams) {
  let query = sb.from('products')
    .select(`
      id, name, slug, description, price, compare_price,
      brand, tags, images, category_id, featured,
      variants:product_variants(
        id, sku, color, size, stock, price_override, images, is_active
      )
    `)
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }
  if (params.categoryId) {
    query = query.eq('category_id', params.categoryId)
  }
  if (params.minPrice !== undefined) {
    query = query.gte('price', params.minPrice)
  }
  if (params.maxPrice !== undefined) {
    query = query.lte('price', params.maxPrice)
  }
  if (params.tags?.length) {
    query = query.contains('tags', params.tags)
  }

  const { data } = await query.order('featured', { ascending: false }).limit(50)

  return data?.map((p: any) => ({
    ...p,
    variants: p.variants?.filter((v: any) => v.is_active) ?? []
  })) ?? []
}

export async function fetchCustomerOrders(sb: any, orgId: string, customerId: string) {
  const { data } = await sb.from('orders')
    .select(`
      id, status, total, payment_status, tracking_number,
      created_at, shipping_address,
      items:order_items(
        id, product_name, variant_label, quantity, unit_price, total, variant_id,
        variant:product_variants(
          color, size,
          product:products(name, images)
        )
      )
    `)
    .eq('organization_id', orgId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(5)

  return data ?? []
}

export async function fetchCustomerHistory(sb: any, orgId: string, customerId: string) {
  const { data } = await sb.from('orders')
    .select(`
      created_at, status,
      items:order_items(
        quantity, unit_price,
        variant:product_variants(
          color, size,
          product:products(name)
        )
      )
    `)
    .eq('organization_id', orgId)
    .eq('customer_id', customerId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(3)

  const history: any[] = []
  data?.forEach((o: any) => {
    o.items?.forEach((i: any) => {
      history.push({
        productName: i.variant?.product?.name,
        size: i.variant?.size,
        color: i.variant?.color,
        quantity: i.quantity,
        date: o.created_at?.slice(0, 10),
      })
    })
  })
  return history
}

export async function fetchCart(sb: any, customerId: string) {
  const { data } = await sb.from('carts')
    .select(`
      id,
      items:cart_items(
        id, quantity,
        variant:product_variants(
          id, color, size, stock, price_override,
          product:products(id, name, price, images)
        )
      )
    `)
    .eq('customer_id', customerId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!data) return null

  const items = data.items?.map((i: any) => ({
    id: i.id,
    variantId: i.variant?.id,
    productName: i.variant?.product?.name,
    color: i.variant?.color,
    size: i.variant?.size,
    stock: i.variant?.stock,
    quantity: i.quantity,
    price: i.variant?.price_override ?? i.variant?.product?.price,
    image: i.variant?.product?.images?.[0],
  })) ?? []

  const total = items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0)
  return { id: data.id, items, total }
}

export async function fetchCoupons(sb: any, orgId: string) {
  const { data } = await sb.from('coupons')
    .select('code, discount_type, discount_value, min_purchase, expires_at')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())

  return data ?? []
}

// ── Conversation Locking (race condition guard) ────────────────
// Prevents concurrent webhook processing for the same conversation.
// Uses a stale-timeout pattern: if a lock is older than staleTimeoutMs,
// it is treated as abandoned and can be acquired.

const DEFAULT_LOCK_TIMEOUT_MS = 30_000

export function acquireConversationLock(ctx: BotContext, staleTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS): boolean {
  if (ctx.processing && ctx.processingStartedAt) {
    const elapsed = Date.now() - new Date(ctx.processingStartedAt).getTime()
    if (elapsed < staleTimeoutMs) {
      return false // Already processing, not stale
    }
    // Stale lock — reclaim it
    console.log('[LOCK] stale lock detected, elapsed:', elapsed, 'ms')
  }
  ctx.processing = true
  ctx.processingStartedAt = new Date().toISOString()
  return true
}

export function releaseConversationLock(ctx: BotContext): void {
  ctx.processing = false
  ctx.processingStartedAt = undefined
}

// ── Product/Variant Resolution (dual lookup) ───────────────────
// Supports: variantId → exact, productId + size/color → exact,
// productName → fuzzy (legacy fallback)

export function resolveProductVariant(
  products: any[],
  item: { productName?: string; productId?: string; variantId?: string; size?: string; color?: string }
): { product: any; variant: any } | null {
  // 1. Exact variant ID lookup
  if (item.variantId) {
    for (const p of products) {
      const v = (p.variants ?? []).find((v: any) => v.id === item.variantId && v.is_active)
      if (v) return { product: p, variant: v }
    }
    console.log('[RESOLVE] variantId not found:', item.variantId)
    // Fall through to other methods
  }

  // 2. Product ID lookup
  if (item.productId) {
    const product = products.find((p: any) => p.id === item.productId)
    if (product) {
      const variant = product.variants?.find((v: any) =>
        v.is_active &&
        (!item.size || v.size?.toLowerCase() === item.size.toLowerCase()) &&
        (!item.color || v.color?.toLowerCase() === item.color.toLowerCase())
      ) ?? product.variants?.find((v: any) => v.is_active)
      if (variant) return { product, variant }
      console.log('[RESOLVE] product found but no matching variant:', product.name)
      return null
    }
    console.log('[RESOLVE] productId not found:', item.productId)
    return null
  }

  // 3. Legacy: fuzzy name matching
  const productName = item.productName
  if (!productName) return null
  const product = products.find((p: any) =>
    p.name.toLowerCase().includes(productName.toLowerCase())
  )
  if (!product) {
    console.log('[RESOLVE] productName not found:', productName)
    return null
  }
  const variant = product.variants?.find((v: any) =>
    v.is_active &&
    (!item.size || v.size?.toLowerCase() === item.size.toLowerCase()) &&
    (!item.color || v.color?.toLowerCase() === item.color.toLowerCase())
  ) ?? product.variants?.find((v: any) => v.is_active)
  if (!variant) {
    console.log('[RESOLVE] product found but no active variant:', product.name)
    return null
  }
  return { product, variant }
}

// ── Stock availability check ──────────────────────────────────────
// Verifies sufficient stock BEFORE order creation to avoid orphan orders.

export interface StockCheckItem {
  variantId: string
  productName: string
  quantity: number
}

export interface StockCheckResult {
  ok: boolean
  insufficientItems: Array<{ variantId: string; productName: string; requested: number; available: number }>
}

export async function checkStockAvailability(sb: any, orgId: string, items: StockCheckItem[]): Promise<StockCheckResult> {
  const insufficientItems: Array<{ variantId: string; productName: string; requested: number; available: number }> = []

  for (const item of items) {
    const available = await getVariantAvailableStock(sb, item.variantId)
    if (available < item.quantity) {
      insufficientItems.push({
        variantId: item.variantId,
        productName: item.productName,
        requested: item.quantity,
        available,
      })
    }
  }

  return {
    ok: insufficientItems.length === 0,
    insufficientItems,
  }
}

// ── Checkout handler ────────────────────────────────────────────

export interface CheckoutInput {
  items: NonNullable<AgentAction['items']>
  shippingMethod?: 'shipping' | 'pickup'
  address?: string
  locality?: string
  pickup?: boolean
  dni?: string
  customerName?: string
  customerNote?: string
}

export interface CheckoutResult {
  ok: boolean
  orderId?: string
  orderNumber?: string
  total?: number
  itemsSummary?: string
  message?: string
}

export async function handleCheckout(
  sb: any,
  orgId: string,
  storeId: string | null,
  customerId: string,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const { items, shippingMethod, address, locality, pickup, dni, customerNote } = input
  if (!items.length) return { ok: false, message: 'No hay productos en la compra' }

  // Look up all products to match by name
  const { data: allProducts } = await sb.from('products')
    .select('id, name, price, variants:product_variants(id, color, size, stock, price_override, is_active)')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  console.log('[CHECKOUT] handleCheckout - products lookup', {
    orgId,
    customerId,
    productsFound: allProducts?.length ?? 0,
    productNames: allProducts?.map((p: any) => p.name) ?? [],
    incomingItems: items,
  })

  if (!allProducts?.length) return { ok: false, message: 'Catalogo no disponible' }

  // Build order items with resolved product/variant info
  const orderItems: Array<{
    variant_id: string
    product_name: string
    variant_label: string
    quantity: number
    unit_price: number
    total: number
  }> = []

  for (const item of items) {
    // Resolve product+variant via dual lookup (ID → name fallback)
    const resolved = resolveProductVariant(allProducts, item)
    if (!resolved) {
      console.log('[CHECKOUT] Product NOT FOUND', { searchedName: item.productName, productId: item.productId, variantId: item.variantId })
      continue
    }
    const { product, variant } = resolved

    const price = variant.price_override ?? product.price
    const label = [variant.color, variant.size].filter(Boolean).join(' / ')

    console.log('[CHECKOUT] Item matched', { productName: product.name, variantId: variant.id, price, label, quantity: item.quantity })

    orderItems.push({
      variant_id: variant.id,
      product_name: product.name,
      variant_label: label,
      quantity: item.quantity || 1,
      unit_price: price,
      total: (item.quantity || 1) * price,
    })
  }

  if (!orderItems.length) return { ok: false, message: 'No se pudieron identificar los productos' }

  const subtotal = orderItems.reduce((sum, i) => sum + i.total, 0)

  // Check stock BEFORE creating the order
  const stockCheck = await checkStockAvailability(
    sb, orgId,
    orderItems.map(i => ({ variantId: i.variant_id, productName: i.product_name, quantity: i.quantity })),
  )
  if (!stockCheck.ok) {
    const details = stockCheck.insufficientItems
      .map(i => `${i.productName}: pediste ${i.requested}, disponible ${i.available}`)
      .join('; ')
    console.log('[CHECKOUT] Insufficient stock:', details)
    return { ok: false, message: `Stock insuficiente: ${details}` }
  }

  // Create order
  const orderPayload: Record<string, any> = {
    organization_id: orgId,
    store_id: storeId,
    customer_id: customerId,
    subtotal,
    shipping_cost: 0,
    discount: 0,
    total: subtotal,
    shipping_method: shippingMethod ?? null,
    shipping_address: address ?? null,
    notes: customerNote ?? null,
    status: 'pending',
    payment_status: 'pending',
    source: 'whatsapp',
  }
  // pickup/dni/locality omitted — schema columns not yet created (migration 013 pending)
  console.log('[CHECKOUT] Order insert payload', orderPayload)
  const { data: order, error: orderError } = await sb.from('orders').insert(orderPayload).select('id').single()
  console.log('[CHECKOUT] Order insert result', { order, error: orderError })

  if (!order) {
    console.log('[CHECKOUT] ORDER INSERT FAILED', { error: orderError })
    return { ok: false, message: 'Error al crear el pedido' }
  }

  // Insert order items
  const orderItemsPayload = orderItems.map(i => ({
    order_id: order.id,
    variant_id: i.variant_id,
    product_name: i.product_name,
    variant_label: i.variant_label,
    quantity: i.quantity,
    unit_price: i.unit_price,
    total: i.total,
  }))
  console.log('[CHECKOUT] Order items insert payload', orderItemsPayload)
  const { error: itemsError } = await sb.from('order_items').insert(orderItemsPayload)
  console.log('[CHECKOUT] Order items insert result', { error: itemsError })

  const itemsSummary = orderItems.map(i =>
    `${getProductEmoji(i.product_name)} ${i.product_name}${i.variant_label ? ' (' + i.variant_label + ')' : ''} x${i.quantity} - $${i.unit_price.toFixed(2)}`
  ).join('\n')

  // Record audit events
  await recordOrderEvent(sb, { order_id: order.id, type: 'created', actor_type: 'customer', actor_id: customerId })
  if (orderPayload.status === 'awaiting_payment') {
    await recordOrderEvent(sb, { order_id: order.id, type: 'payment_requested', actor_type: 'system' })
  }

  // Reserve stock
  const stockOk = await reserveStockForOrder(sb, order.id, customerId)
  if (!stockOk) {
    console.warn('[CHECKOUT] Stock reservation failed for order:', order.id, '— insufficient stock')
  }

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.id.slice(0, 8),
    total: subtotal,
    itemsSummary,
  }
}
