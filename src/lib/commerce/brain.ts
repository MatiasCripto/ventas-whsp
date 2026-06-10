// ── Commerce Brain — Main Orchestrator ─────────────────────
// The heart of Concierge AI.
// Flow: message → intent → retrieval → context → AI → action
//
// Principle: The AI NEVER invents data. All commerce data comes
// from real Supabase queries. The AI generates natural language
// responses FROM the retrieved data.

import { classifyCommerceIntent, extractKeywords } from './intent'
import { retrieveProducts, getProductDetail } from './retrieval'
import { buildCommerceContext } from './context'
import { addToCart, getCartItems } from './cart'
import { createServiceClient } from '@/lib/supabase/service'
import type { CommerceIntent, CommerceContext, CommerceProduct } from '@/lib/types/commerce.types'
import type { ProductResult } from '@/lib/types/whatsapp.types'
import type { BotContext } from '@/lib/types/whatsapp.types'

function productResultToCommerce(p: ProductResult): CommerceProduct {
  const attributes = extractAttributes(p.variants)
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    comparePrice: p.compare_price ? Number(p.compare_price) : null,
    description: p.description ?? null,
    attributes,
    stock: 999,
    images: p.images ?? [],
    category: p.category_name ?? null,
    brand: p.brand ?? null,
    tags: p.tags ?? [],
  }
}

function extractAttributes(
  variants: ProductResult['variants']
): Array<{ name: string; values: string[] }> {
  if (!variants || variants.length === 0) return []
  const attrMap: Record<string, Set<string>> = {}
  for (const v of variants) {
    if (v.attribute_values) {
      for (const [key, val] of Object.entries(v.attribute_values)) {
        if (!attrMap[key]) attrMap[key] = new Set()
        attrMap[key].add(val)
      }
    }
  }
  return Object.entries(attrMap).map(([name, values]) => ({
    name,
    values: [...values],
  }))
}

export async function processCommerceMessage(
  message: string,
  ctx: BotContext,
  organizationId: string | null
): Promise<{
  response: string
  newContext: Record<string, any>
  action?: { type: string; payload: Record<string, unknown> }
}> {
  const ctxAny = ctx as Record<string, any>
  const intent = classifyCommerceIntent(message)

  // Always include store info if available
  const storeInfo = ctxAny.storeInfo as CommerceContext['storePolicies']

  switch (intent) {
    case 'search_products':
    case 'catalog': {
      if (!organizationId) {
        return { response: 'Disculpame, no pude identificar tu tienda. ¿Podés intentar de nuevo?', newContext: {} }
      }

      const keywords = extractKeywords(message)
      let categoryFilter: string | undefined

      // Check if user mentioned a category
      if (ctxAny.availableCategories && ctxAny.availableCategories.length > 0) {
        const matchedCat = ctxAny.availableCategories.find((c: string) =>
          message.toLowerCase().includes(c.toLowerCase())
        )
        if (matchedCat) categoryFilter = matchedCat
      }

      const results = await retrieveProducts(message, {
        organizationId,
        limit: 5,
        categoryFilter,
        inStock: true,
      })

      if (results.length === 0) {
        return {
          response: 'No encontré productos que coincidan con tu búsqueda. ¿Querés que te muestre las categorías que tenemos?',
          newContext: { lastSearch: keywords.join(' '), searchResults: [] },
        }
      }

      const products = results.map(productResultToCommerce)
      const commerceCtx: CommerceContext = {
        products,
        categories: ctxAny.availableCategories,
        storePolicies: storeInfo,
        customer: ctxAny.customer,
        state: 'search_products',
      }

      return {
        response: buildPromptForAI('search', commerceCtx, message),
        newContext: { lastSearch: keywords.join(' '), searchResults: results },
        action: { type: 'search_products', payload: { count: results.length } },
      }
    }

    case 'get_product': {
      if (!organizationId || !ctxAny.searchResults || ctxAny.searchResults.length === 0) {
        return { response: '¿Sobre qué producto querés saber más?', newContext: {} }
      }

      // Try to find which product the user is asking about
      const lowerMsg = message.toLowerCase()
      const matchedProduct = ctxAny.searchResults.find((p: any) =>
        lowerMsg.includes(p.name.toLowerCase())
      )

      if (!matchedProduct) {
        // Show the current results
        const names = ctxAny.searchResults.map((p: any) => `"${p.name}"`).join(', ')
        return {
          response: `Tenemos: ${names}. ¿De cuál querés saber más?`,
          newContext: {},
        }
      }

      const detail = await getProductDetail(matchedProduct.productId, organizationId)
      if (!detail) {
        return { response: 'No pude encontrar los detalles de ese producto.', newContext: {} }
      }

      const commerceCtx: CommerceContext = {
        products: [productResultToCommerce(detail)],
        customer: ctxAny.customer,
        storePolicies: storeInfo,
        state: 'product_detail',
      }

      return {
        response: buildPromptForAI('product_detail', commerceCtx, message),
        newContext: {},
      }
    }

    case 'view_cart': {
      if (!ctxAny.customerId || !organizationId) {
        return {
          response: 'Tu carrito está vacío. ¿Querés ver nuestros productos?',
          newContext: {},
        }
      }

      const cart = await getCartItems(organizationId, ctxAny.customerId)
      if (cart.items.length === 0) {
        return {
          response: 'Tu carrito está vacío. ¿Querés ver lo que tenemos disponible?',
          newContext: { cartTotal: 0, cartItemCount: 0 },
        }
      }

      const commerceCtx: CommerceContext = {
        cart: {
          items: cart.items.map(i => ({
            productId: '',
            variantId: i.variantId,
            name: i.productName,
            variant: i.variantLabel,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
            image: i.image,
          })),
          total: cart.total,
        },
        customer: ctxAny.customer,
        storePolicies: storeInfo,
        state: 'cart_view',
      }

      return {
        response: buildPromptForAI('cart_view', commerceCtx, message),
        newContext: { cartTotal: cart.total, cartItemCount: cart.items.length },
      }
    }

    case 'add_to_cart': {
      if (!organizationId) {
        return { response: 'No pude procesar tu solicitud. ¿Podés intentar de nuevo?', newContext: {} }
      }

      // If we have search results, try to determine which product + variant
      const results: any = ctxAny.searchResults ?? []
      const lowerMsg = message.toLowerCase()
      const matchedProduct = results.find((p: any) =>
        lowerMsg.includes(p.name.toLowerCase())
      )

      if (!matchedProduct) {
        return {
          response: '¿Qué producto querés llevarte? Decime el nombre y te lo agrego al carrito.',
          newContext: {},
        }
      }

      // Fetch all active variants and find the best match from the message
      const sb = createServiceClient()
      const { data: allVariants } = await sb
        .from('product_variants')
        .select('id, stock, attribute_values')
        .eq('product_id', matchedProduct.productId)
        .eq('is_active', true)

      if (!allVariants || allVariants.length === 0) {
        return {
          response: `No encontré variantes disponibles para "${matchedProduct.name}". ¿Te sirve otra opción?`,
          newContext: {},
        }
      }

      // Collect unique attribute values to detect what the user mentioned
      const uniqueValues = new Set<string>()
      for (const v of allVariants) {
        const av = v.attribute_values as Record<string, string> | null
        if (av) Object.values(av).forEach(val => uniqueValues.add(val))
      }

      const mentionedValues = [...uniqueValues].filter(val =>
        lowerMsg.includes(val.toLowerCase())
      )

      // Find the variant that matches all mentioned attribute values
      let variant = mentionedValues.length > 0
        ? allVariants.find(v => {
            const av = v.attribute_values as Record<string, string> | null
            return av && mentionedValues.every(mv =>
              Object.values(av).some(v => v.toLowerCase() === mv.toLowerCase())
            )
          })
        : null

      if (!variant) variant = allVariants[0]

      const variantLabel = variant.attribute_values
        ? Object.values(variant.attribute_values as Record<string, string>).filter(Boolean).join(' / ')
        : ''

      if ((variant as Record<string, unknown>).stock === 0) {
        return {
          response: `Uy, "${matchedProduct.name}" en ${variantLabel} se nos agotó. ¿Querés ver otra opción?`,
          newContext: {},
        }
      }

      const result = await addToCart(
        organizationId,
        ctxAny.customerId,
        (variant as Record<string, unknown>).id as string,
        1,
        ctxAny.phone
      )

      if (!result.ok) {
        return {
          response: result.error ?? 'No pude agregar al carrito. ¿Podés intentar de nuevo?',
          newContext: {},
        }
      }

      return {
        response: `¡Listo! Agregué "${matchedProduct.name}" a tu carrito. ¿Querés algo más o querés finalizar tu pedido?`,
        newContext: { cartItemCount: (ctxAny.cartItemCount ?? 0) + 1 },
        action: { type: 'add_to_cart', payload: { productId: matchedProduct.productId } },
      }
    }

    case 'checkout': {
      if (!ctxAny.customerId || !organizationId) {
        return {
          response: 'Antes de finalizar, necesito que me digas tu nombre y dirección para enviarte el pedido.',
          newContext: {},
        }
      }

      const cart = await getCartItems(organizationId, ctxAny.customerId)
      if (cart.items.length === 0) {
        return {
          response: 'Tu carrito está vacío. Agregá productos antes de finalizar.',
          newContext: {},
        }
      }

      const commerceCtx: CommerceContext = {
        cart: {
          items: cart.items.map(i => ({
            productId: '',
            variantId: i.variantId,
            name: i.productName,
            variant: i.variantLabel,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
            image: i.image,
          })),
          total: cart.total,
        },
        customer: ctxAny.customer,
        storePolicies: storeInfo,
        state: 'checkout_confirm',
      }

      return {
        response: buildPromptForAI('checkout', commerceCtx, message),
        newContext: {},
        action: { type: 'checkout', payload: { cartTotal: cart.total } },
      }
    }

    case 'track_order': {
      if (!ctxAny.customerId || !organizationId) {
        return {
          response: 'Decime tu nombre o número de pedido y te busco la información.',
          newContext: {},
        }
      }

      const sb2 = createServiceClient()
      const { data: orders } = await sb2
        .from('orders')
        .select('id, status, total, created_at')
        .eq('customer_id', ctxAny.customerId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!orders || (orders as Array<Record<string, unknown>>).length === 0) {
        return {
          response: 'No tenés pedidos recientes. ¿Querés ver nuestros productos?',
          newContext: {},
        }
      }

      const recentOrders = (orders as Array<Record<string, unknown>>).map(o => ({
        id: o.id as string,
        total: Number(o.total),
        status: o.status as string,
        date: new Date(o.created_at as string).toLocaleDateString('es-AR'),
        items: 0,
      }))

      const commerceCtx: CommerceContext = {
        recentOrders,
        customer: ctxAny.customer,
        state: 'order_tracking',
      }

      return {
        response: buildPromptForAI('track_order', commerceCtx, message),
        newContext: {},
      }
    }

    case 'human_handoff': {
      return {
        response: 'Te paso con un asesor para ayudarte mejor. En un momento te atiende.',
        newContext: {},
        action: { type: 'human_handoff', payload: {} },
      }
    }

    default: {
      // Unknown intent — let AI handle it conversationally
      const commerceCtx: CommerceContext = {
        customer: ctxAny.customer,
        storePolicies: storeInfo,
        state: ctxAny.state,
      }
      return {
        response: buildPromptForAI('unknown', commerceCtx, message),
        newContext: {},
      }
    }
  }
}

// ── Build prompt for AI with commerce context ───────────────

function buildPromptForAI(
  mode: string,
  ctx: CommerceContext,
  userMessage: string
): string {
  const parts: string[] = []

  parts.push(buildCommerceContext(ctx))

  parts.push(`Estado actual: ${ctx.state}`)
  parts.push('')

  if (mode === 'search' && ctx.products && ctx.products.length > 0) {
    parts.push('Respondé recomendando estos productos de forma natural. Preguntá color/talle que prefieren.')
  } else if (mode === 'product_detail' && ctx.products && ctx.products.length === 1) {
    const p = ctx.products[0]
    const attrDesc = p.attributes?.map(a =>
      `${a.name}s disponibles (${a.values.join(', ')})`
    ).join(', ') ?? ''
    parts.push(`Respondé con el detalle de "${p.name}" — precio, ${attrDesc}, y stock.`)
  } else if (mode === 'checkout' && ctx.cart) {
    parts.push(`El carrito tiene ${ctx.cart.items.length} items por un total de $${ctx.cart.total}. Preguntá dirección y método de pago para finalizar.`)
  } else if (mode === 'cart_view' && ctx.cart) {
    parts.push(`Mostrá el contenido del carrito al cliente. Preguntá si quiere agregar algo más o finalizar.`)
  } else if (mode === 'track_order' && ctx.recentOrders) {
    parts.push('Mostrá los pedidos recientes al cliente.')
  }

  parts.push('')
  parts.push(`Mensaje del cliente: "${userMessage}"`)

  return parts.join('\n')
}
