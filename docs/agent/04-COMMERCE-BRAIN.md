# Fase 4: Commerce Brain — Retrieval + AI Orchestration

## Arquitectura del Módulo

```
src/lib/commerce/
  brain.ts              ← Orquestador principal
  retrieval.ts          ← Búsqueda de productos (full-text + trigram + tags)
  context.ts            ← Builder de contexto para IA
  intent.ts             ← Clasificador de intención
  actions.ts            ← Acciones ejecutables (add_to_cart, checkout, etc.)
  cart.ts               ← Manejo de carrito conversacional
  validation.ts         ← Validación server-side de acciones IA
  
src/lib/bot/
  ai-chat.ts            ← REUSADO de Clinify (providers + parser)
  evolution-client.ts   ← REUSADO de Clinify (WhatsApp)
  
src/app/api/webhooks/whatsapp/
  route.ts              ← Orquestador webhook (ADAPTADO de Clinify)
```

## Commerce Brain Flow

```typescript
// brain.ts — Orquestador principal

async function processCommerceMessage(
  message: string,
  context: BotContext,
  customer: Customer | null
): Promise<{ response: string, action?: AgentAction, context: BotContext }> {
  
  // 1. Clasificar intención
  const intent = classifyIntent(message)
  
  // 2. Manejar según intención
  switch (intent) {
    case 'search_products':
      // Buscar productos
      const products = await retrieveProducts(message)
      // Construir contexto con productos
      const searchContext = buildSearchContext(products, customer)
      // Llamar IA para respuesta natural
      return generateResponse('search', searchContext, message)
      
    case 'get_product':
      const product = await getProductDetail(extractProductRef(message))
      return generateResponse('product_detail', { product, customer }, message)
      
    case 'add_to_cart':
      const variant = await resolveVariant(message, context.cartContext)
      if (!variant || variant.stock <= 0) {
        return { response: 'No tenemos stock de eso en este momento', context }
      }
      const cart = await addToCart(customer.id, variant.id)
      return generateResponse('cart_updated', { cart, variant }, message)
      
    case 'checkout':
      // Validar carrito
      const cartItems = await getCart(customer.id)
      if (cartItems.length === 0) {
        return { response: 'Tu carrito está vacío', context }
      }
      // Solicitar datos faltantes
      const missing = getMissingCheckoutData(customer, context)
      if (missing.length > 0) {
        return generateResponse('checkout_missing', { missing }, message)
      }
      // Crear pedido
      const order = await createOrder(customer.id, cartItems)
      return {
        response: `¡Pedido confirmado! N° ${order.id}. Total: $${order.total}`,
        action: { type: 'order_created', payload: { orderId: order.id } },
        context
      }
      
    case 'cancel_order':
      const orderToCancel = await getLastOrder(customer.id)
      if (!orderToCancel || !canCancel(orderToCancel.status)) {
        return { response: 'No puedo cancelar ese pedido porque ya fue enviado', context }
      }
      await cancelOrder(orderToCancel.id)
      return { response: 'Pedido cancelado correctamente', context }
      
    case 'human_handoff':
      return {
        response: 'Te paso con un asesor humano',
        action: { type: 'human_handoff', payload: {} },
        context: { ...context, humanTakeover: true }
      }
  }
}
```

## Product Retrieval

```typescript
// retrieval.ts — Búsqueda inteligente

async function retrieveProducts(query: string, options?: {
  organizationId: string
  customer?: Customer
  limit?: number
}): Promise<ProductResult[]> {
  
  // 1. Extraer términos de búsqueda del mensaje natural
  // "tenés algo sexy negro?" → keywords: ["sexy", "negro"]
  const keywords = extractKeywords(query)
  
  // 2. Buscar por multiple estrategias
  const results = await Promise.all([
    // Full-text search
    searchFullText(keywords),
    // Trigram similarity
    searchTrigram(keywords),
    // Tags match
    searchByTags(keywords),
    // Categoría match
    searchByCategory(keywords),
  ])
  
  // 3. Fusionar y rankear resultados
  const merged = mergeResults(results)
  
  // 4. Si hay customer, boost por preferencias
  if (options?.customer?.preferences) {
    boostByPreferences(merged, options.customer.preferences)
  }
  
  // 5. Top N (default: 5)
  return merged.slice(0, options?.limit || 5)
}

function extractKeywords(text: string): string[] {
  // Remover stopwords, acentos, palabras de pregunta
  // "tenés algo sexy negro?" → ["sexy", "negro"]
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!,.]/g, '')
    .split(/\s+/)
    .filter(word => !STOP_WORDS.includes(word) && word.length > 2)
}
```

## Context Builder

```typescript
// context.ts — Construye el contexto para la IA

interface CommerceContext {
  // Cliente
  customer?: {
    name: string
    totalOrders: number
    preferredSizes?: string[]
    preferredColors?: string[]
    lastPurchase?: string
  }
  // Productos recuperados
  products?: {
    name: string
    price: number
    colors: string[]
    sizes: string[]
    stock: number
    image?: string
  }[]
  // Carrito actual
  cart?: {
    items: { name: string, variant: string, quantity: number, price: number }[]
    total: number
  }
  // Órdenes recientes
  recentOrders?: {
    id: string
    status: string
    total: number
    date: string
  }[]
  // Políticas de la tienda
  storePolicies?: {
    shipping: string
    payment: string
    returns: string
    minOrder?: number
    freeShippingFrom?: number
  }
}

function buildCommerceContext(data: CommerceContext): string {
  // Productos disponibles (máximo 5)
  let ctx = ''
  
  if (data.products) {
    ctx += '--- PRODUCTOS DISPONIBLES ---\n'
    data.products.forEach(p => {
      ctx += `- ${p.name}: $${p.price} | Colores: ${p.colors.join(', ')} | Talles: ${p.sizes.join(', ')} | Stock: ${p.stock}\n`
    })
  }
  
  if (data.cart) {
    ctx += '\n--- CARRITO ACTUAL ---\n'
    data.cart.items.forEach(i => {
      ctx += `- ${i.name} (${i.variant}) x${i.quantity} = $${i.price * i.quantity}\n`
    })
    ctx += `Total: $${data.cart.total}\n`
  }
  
  if (data.customer) {
    ctx += `\n--- CLIENTE ---\n`
    ctx += `Nombre: ${data.customer.name}\n`
    ctx += `Compras anteriores: ${data.customer.totalOrders}\n`
    if (data.customer.preferredSizes?.length)
      ctx += `Talles frecuentes: ${data.customer.preferredSizes.join(', ')}\n`
    if (data.customer.preferredColors?.length)
      ctx += `Colores favoritos: ${data.customer.preferredColors.join(', ')}\n`
    if (data.customer.lastPurchase)
      ctx += `Última compra: ${data.customer.lastPurchase}\n`
  }
  
  return ctx
}
```
