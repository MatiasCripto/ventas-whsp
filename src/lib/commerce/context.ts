// ── Commerce Context Builder ────────────────────────────────
// Builds the context string sent to the AI.
// The AI ONLY sees real data from the database — never hardcoded values.

import type { CommerceContext, CommerceProduct } from '@/lib/types/commerce.types'

export function buildCommerceContext(
  data: CommerceContext
): string {
  const parts: string[] = []

  if (data.storePolicies) {
    parts.push(`--- TIENDA ---`)
    parts.push(`Nombre: ${data.storePolicies.name}`)
    if (data.storePolicies.shipping) parts.push(`Envíos: ${data.storePolicies.shipping}`)
    if (data.storePolicies.payment) parts.push(`Pagos: ${data.storePolicies.payment}`)
    if (data.storePolicies.returns) parts.push(`Cambios: ${data.storePolicies.returns}`)
    if (data.storePolicies.minOrder) parts.push(`Pedido mínimo: $${data.storePolicies.minOrder}`)
    if (data.storePolicies.freeShippingFrom) parts.push(`Envío gratis desde: $${data.storePolicies.freeShippingFrom}`)
    parts.push('')
  }

  // Categories for browsing
  if (data.categories && data.categories.length > 0) {
    parts.push(`--- CATEGORÍAS DISPONIBLES ---`)
    parts.push(data.categories.join(', '))
    parts.push('')
  }

  // Products (max 5 as per architecture)
  if (data.products && data.products.length > 0) {
    parts.push(`--- PRODUCTOS DISPONIBLES (${data.products.length}) ---`)
    for (const p of data.products) {
      const comparePrice = p.comparePrice ? ` (antes $${p.comparePrice})` : ''
      const stockInfo = p.stock === null ? 'Stock: N/A' : p.stock > 0 ? `Stock: ${p.stock}` : 'SIN STOCK'
      const attrStr = p.attributes?.length
        ? ` | ${p.attributes.map(a => `${a.name}s: ${a.values.join(', ')}`).join(' | ')}`
        : ''
      const desc = p.description ? ` | ${p.description.slice(0, 120)}` : ''
      parts.push(`- ${p.name}: $${p.price}${comparePrice}${stockInfo}${attrStr}${desc}`)
    }
    parts.push('')
  }

  // Cart
  if (data.cart && data.cart.items.length > 0) {
    parts.push(`--- CARRITO ACTUAL ---`)
    for (const item of data.cart.items) {
      parts.push(`- ${item.name} (${item.variant}) x${item.quantity} = $${item.total}`)
    }
    parts.push(`Total: $${data.cart.total}`)
    parts.push('')
  }

  // Customer info
  if (data.customer) {
    parts.push(`--- CLIENTE ---`)
    parts.push(`Nombre: ${data.customer.name}`)
    parts.push(`Compras anteriores: ${data.customer.totalOrders}`)
    if (data.customer.lastPurchase) {
      parts.push(`Última compra: ${data.customer.lastPurchase}`)
    }
    parts.push('')
  }

  // Recent orders
  if (data.recentOrders && data.recentOrders.length > 0) {
    parts.push(`--- PEDIDOS RECIENTES ---`)
    for (const o of data.recentOrders) {
      parts.push(`- Pedido #${o.id}: $${o.total} | ${o.status} | ${o.date} (${o.items} items)`)
    }
    parts.push('')
  }

  // Cart empty notice
  if (data.cart && data.cart.items.length === 0) {
    parts.push(`El carrito está vacío.`)
    parts.push('')
  }

  return parts.join('\n')
}
