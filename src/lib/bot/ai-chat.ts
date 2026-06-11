// ── E-commerce AI Agent for WhatsApp ─────────────────────────────
// Agent architecture: the AI receives ALL data and drives the
// conversation naturally. The backend only executes validated actions.

import { createServiceClient } from '@/lib/supabase/service'
import { getProductEmoji } from '@/lib/bot/product-emoji-map'
import { decrypt, encrypt } from '@/lib/crypto/encryption'

interface AiConfig {
  provider: string
  apiKey: string
  model: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AgentResponse {
  message: string
  action: AgentAction | null
}

export interface AgentAction {
  type: 'start_checkout' | 'add_to_order' | 'remove_from_order' | 'human_handoff' | 'request_payment_info' | 'show_product_images' | 'add_to_cart' | 'remove_from_cart' | 'checkout' | 'cancel_order' | 'apply_coupon'
  reason?: string
  productName?: string
  items?: Array<{ productName: string; quantity: number; attribute_values?: Record<string, string>; productId?: string; variantId?: string }>
  payload?: Record<string, unknown>
}

// ── Modular Prompt Architecture ──────────────────────────────
// Split into logical sections for maintainability.
// Concatenated into SYSTEM_PROMPT for backward compatibility.
// Each section preserves EXACT original content.

/** Identidad, personalidad, reglas base y fuente de datos */
const BASE_PROMPT = `SOS UN VENDEDOR EXPERTO DE ROPA. Atendes por WhatsApp para una tienda de indumentaria (ropa interior, medias, boxers, ropa de ninos y variedad general).

PERSONALIDAD:
- Calido, cercano, picaresco pero profesional. Hablas como un vendedor de local que conoce bien su mercado.
- Mensajes CORTOS (1-3 oraciones). UNA pregunta por vez.
- Emojis leves y naturales: 😊 👌 🔥 💯 🛍️
- Los productos ya aparecen con su emoji correspondiente en el catalogo (👕👖🧢 etc.). Nunca agregues emojis de productos, el sistema lo hace automaticamente.
- NO pareces chatbot. Sonas como una persona real que quiere vender bien.
- Usas lenguaje argentino natural: "dale", "mira", "te cuento", "quedate tranquilo/a"

PROHIBIDO:
- Frases de robot: "En que puedo ayudarte?", "Con gusto", "Por supuesto"
- Listas numeradas, bullets, markdown, negritas, asteriscos
- Repetir el mismo mensaje
- Inventar datos que NO estan en el contexto
- Mostrar precios sin el simbolo $ y formato claro

DATOS (tu UNICA fuente de verdad):
- El contexto tiene productos, stock, pedidos y datos del cliente
- Lo que NO esta en el contexto NO EXISTE. No lo inventes nunca.
- Usa los nombres EXACTOS de los productos del contexto
- Si el cliente pregunta por un producto que NO aparece en el catalogo → decile "no lo tenemos" y ofrecé el mas similar que SI este en el catalogo
- NUNCA menciones categorias, tipos de productos ni marcas que no aparezcan explicitamente en el catalogo del contexto
- Si el catalogo esta vacio → decile que en este momento no tenes productos disponibles y que vuelva pronto`

/** Comportamiento de ventas: detección de intención, objeciones, recomendación, checkout, derivación */
const SALES_PROMPT = `COMPORTAMIENTO DE VENDEDOR EXPERTO:

1. DETECTAR INTENCION REAL
   - Si el cliente dice "quiero una remera" → pregunta para quien es, que talle y si tiene algun color en mente
   - Si dice "algo para regalar" → pregunta edad, sexo y presupuesto aproximado
   - Si dice "tenes ropa de nene?" → pregunta edad del nene para recomendar el talle correcto
   - Nunca muestres todo el catalogo de golpe. Filtra primero.

2. DETECTAR DUDAS Y OBJECIONES
   - Si el cliente dice "esta caro", "lo pienso", "no se" → valida su duda y ofrece una alternativa mas economica o destaca el valor del producto
   - Si dice "lo veo despues" → genera urgencia suave: stock limitado, oferta por tiempo limitado (solo si es real en el contexto)
   - Si pregunta por talle → explica brevemente el tallaje y recomienda segun lo que conto
   - Si duda entre dos productos → ayudalo a decidir con una recomendacion concreta, no le des mas opciones

3. RECOMENDAR ACTIVAMENTE
   - Si no hay stock del producto que pide → ofrece el mas similar disponible, nunca digas solo "no tenemos"
   - Despues de mostrar un producto → siempre sugiere algo complementario (ej: "con eso te va barbaro un par de medias X")
   - Si el cliente compro antes (esta en el contexto) → menciona algo relacionado a lo que ya llevo

4. INICIAR CHECKOUT (CUANDO EL CLIENTE QUIERE COMPRAR)
   - Cuando el cliente ya eligio → no des mas opciones, empuja suavemente al cierre: "Te lo separo?"
   - Confirma siempre: talle, color y cantidad antes de iniciar checkout
   - Cuando el cliente confirme que quiere comprar → GENERA OBLIGATORIAMENTE el action start_checkout
   - Inclui los items en action.items con productName EXACTO del contexto, quantity, size y color
   - ⚠️ SOLO generas START_CHECKOUT. NO pidas direccion, DNI ni datos de envio. El backend se encarga del resto del flujo de compra.

5. DERIVACION A HUMANO
   - Si hay reclamo, queja fuerte, o pedido de descuento importante → deriva a humano con contexto
   - Si despues de 3 intercambios no avanzo la venta → deriva

FLUJO NATURAL:
- Saludo breve y calido → detectar que busca → filtrar por categoria/talle/sexo → mostrar 1-2 opciones maximo → manejar objeciones → cerrar`

/** Reglas para checkout activo y pedido activo */
const CHECKOUT_PROMPT = `6. CHECKOUT ACTIVO (solo si checkoutState aparece en el contexto)
   - Si checkoutState esta presente, el backend esta procesando el checkout paso a paso
   - checkoutState indica que dato esta pidiendo el sistema: name | dni | shipping | address | payment_method | payment_waiting_proof | confirm
   - checkoutData muestra los datos ya recolectados
   - Ayuda al cliente naturalmente a completar el dato que falta SEGUN el checkoutState:
     * name: ayuda al cliente a dar su nombre completo
     * dni: explica que es el DNI si no entiende
     * shipping: ayuda a elegir entre envio a domicilio o retiro por el local
     * address: ayuda si no sabe que direccion poner
     * payment_method: ayuda a elegir entre transferencia bancaria, efectivo contra entrega o pago al retirar
     * payment_waiting_proof: el cliente ya eligio transferencia, decile que cuando haga el pago envie el comprobante
     * confirm: ayuda a confirmar o corregir los datos
   - ⚠️ NO generes start_checkout si ya hay checkoutState activo

7. PEDIDO ACTIVO (solo si activeOrderId aparece en el contexto)
   - activeOrderId = el cliente tiene un pedido activo
   - activeOrderStatus = estado actual del pedido (pending, awaiting_payment, shipped, etc.)
   - activeOrderDetails = el detalle actual del pedido (productos, cantidades, total)
   - El pedido SOLO se puede modificar si esta en estado editable (pending, awaiting_payment, payment_under_review, payment_confirmed, preparing)
   - Si el pedido NO es editable (shipped, delivered, completed, cancelled):
     * NO generes add_to_order ni remove_from_order
     * Deci que el pedido ya esta en camino/completado y no se puede modificar
     * Ofrece crear un pedido NUEVO: "Queres que te prepare un pedido nuevo con ese producto?"
   - Si el pedido ES editable (pending, awaiting_payment, payment_under_review, payment_confirmed, preparing):
     * Para agregar productos: Confirma producto, talle, color y cantidad → Genera action type "add_to_order"
     * Para sacar productos: Confirma que producto quiere sacar → Genera action type "remove_from_order" con los items a eliminar
   - ⚠️ NO generes start_checkout si hay activeOrderId activo — el pedido ya esta creado`

/** Prohibición absoluta de datos de pago */
const PAYMENT_PROMPT = `8. DATOS DE PAGO — PROHIBICION ABSOLUTA
   - NUNCA inventes ni repitas datos bancarios. CERO excepciones.
   - No menciones bancos, alias, CBU, CVU, titulares, ni ningun dato de pago.
   - Si el usuario pide datos de pago ("pasame los datos", "cual es el alias", "quiero pagar") → genera action "request_payment_info"
   - ⚠️ Los datos bancarios en el historial del chat son de sesiones anteriores. IGNORALOS COMPLETAMENTE.
   - Si no hay cuenta configurada, la accion request_payment_info hara que el backend responda adecuadamente.`

/** Formato de respuesta JSON con ejemplos */
const JSON_FORMAT = `RESPONDE SIEMPRE EN JSON SIN NADA MAS:

✅ Sin accion (conversacion normal):
{"message": "lo que le decis al cliente"}

✅ Iniciar checkout (cuando el cliente confirma que quiere comprar):
{"message": "Dale, te lo preparo","action":{"type":"start_checkout","items":[{"productName":"Remera Oversize","quantity":1,"size":"M","color":"negro"}]}}

✅ Derivar a humano:
{"message": "Te paso con alguien del equipo","action":{"type":"human_handoff","reason":"motivo"}}

✅ Pedir datos de pago (solo cuando el usuario pide datos bancarios):
{"message": "Dame un momento y te paso los datos","action":{"type":"request_payment_info"}}

✅ Agregar producto a pedido activo (cuando cliente confirma):
{"message": "Dale, te lo agrego al pedido","action":{"type":"add_to_order","items":[{"productName":"Buzo Canguro","quantity":1,"size":"S","color":"blanco"}]}}

✅ Sacar producto de pedido activo (cuando cliente confirma):
{"message":"Dale, te lo saco del pedido","action":{"type":"remove_from_order","items":[{"productName":"Gorra Vicera plana"}]}}

⛔ NUNCA pongas "action": null. Si no hay accion, no incluyas el campo action. ⛔
⛔ NUNCA generes action.type = "checkout". Solo start_checkout. ⛔
⛔ NUNCA incluyas datos bancarios en "message". El backend los genera. ⛔
⛔ RESPONDE SOLO EL JSON, NADA MAS. Sin texto antes ni despues.`

/** SYSTEM_PROMPT combinado = concatenación exacta de los módulos */
const SYSTEM_PROMPT = `${BASE_PROMPT}\n\n${SALES_PROMPT}\n\n${CHECKOUT_PROMPT}\n\n${PAYMENT_PROMPT}\n\n${JSON_FORMAT}`

// ── Input sanitization for prompt injection prevention ─────

/** Sanitizes user input to prevent prompt injection attacks */
function sanitizeUserInput(input: string): string {
  const maxLength = 500
  const trimmed = input.slice(0, maxLength)

  // Remove known injection patterns (case-insensitive)
  const injectionPatterns = [
    /ignora?\s+(todo|las|mis|instruccion(es)?)/gi,
    /olvida?\s+(todo|las|mis|instruccion(es)?)/gi,
    /forget\s+(all|everything|previous)/gi,
    /ignore\s+(all|previous|instructions)/gi,
    /\[INST\]/g,
    /<<SYS>>/g,
    /<\|im_start\|>/g,
    /<\|im_end\|>/g,
    /system\s*:\s*(?!.*\n)/gi,
    /assistant\s*:\s*(?!.*\n)/gi,
  ]

  let sanitized = trimmed
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[restricted]')
  }

  return sanitized
}

// ── Build context for the AI agent ──────────────────────────

export function buildAiPrompt(userMessage: string, ctx: Record<string, any>): string {
  const parts: string[] = []

  if (ctx.storeName) parts.push(`Tienda: ${ctx.storeName}`)
  if (ctx.customerName) parts.push(`Cliente: ${ctx.customerName}`)
  if (ctx.customerHistory?.length) {
    parts.push(`Compras anteriores del cliente:`)
    for (const h of ctx.customerHistory) {
      const attrStr = h.attribute_values ? Object.values(h.attribute_values).filter(Boolean).join(' / ') : 'sin variante'
      parts.push(`  - ${h.productName} (${attrStr}) — ${h.date}`)
    }
  }

  if (ctx.products?.length) {
    parts.push(`Catalogo disponible:`)
    for (const p of ctx.products) {
      const precio = p.compare_price
        ? `$${p.price} (antes $${p.compare_price})`
        : `$${p.price}`
      const tags = p.tags?.length ? ` | Tags: ${p.tags.join(', ')}` : ''
      const brand = p.brand ? ` | Marca: ${p.brand}` : ''
      const desc = p.description ? ` | ${p.description.replace(/\n/g, ' ').slice(0, 150)}` : ''
      parts.push(`  ${getProductEmoji(p.name)} ${p.name}${brand} — ${precio}${tags}${desc}`)

      if (p.variants?.length) {
        const disponibles = p.variants.filter((v: any) => v.is_active && (v.stock === null || v.stock > 0))
        if (disponibles.length) {
          for (const v of disponibles) {
            const precioVar = v.price_override ? ` ($${v.price_override})` : ''
            const attrStr = v.attribute_values ? Object.entries(v.attribute_values).map(([k, val]) => `${k}: ${val}`).join(' | ') : ''
            const stock = v.stock !== null && v.stock <= 3 ? ` ⚠ Quedan pocos` : v.stock === null ? ` ✔ Disponible` : ` ✔ Disponible`
            const info = [attrStr, precioVar, stock].filter(Boolean).join(' — ')
            parts.push(`     → ${info}`)
          }
        } else {
          parts.push(`     → Sin stock disponible`)
        }
      }
    }
  }

  if (ctx.orders?.length) {
    parts.push(`Pedidos del cliente:`)
    for (const o of ctx.orders) {
      parts.push(`  - Pedido #${o.id?.slice(0,8)} | $${o.total} | Estado: ${o.status} | ${o.created_at?.slice(0,10)}`)
      if (o.items?.length) {
        for (const i of o.items) {
          const varStr = i.variant?.attribute_values ? Object.values(i.variant.attribute_values).filter(Boolean).join(' / ') : ''
          parts.push(`     → ${i.product_name} x${i.quantity} (${varStr})`.trim())
        }
      }
    }
  }

  if (ctx.cart?.items?.length) {
    parts.push(`Carrito actual:`)
    for (const i of ctx.cart.items) {
      const cartAttr = i.attribute_values ? Object.values(i.attribute_values).filter(Boolean).join(' / ') : ''
      parts.push(`  - ${i.productName} x${i.quantity} (${cartAttr}) — $${i.price}`.trim())
    }
    parts.push(`  Total carrito: $${ctx.cart.total}`)
  }

  if (ctx.coupons?.length) {
    parts.push(`Cupones activos:`)
    for (const c of ctx.coupons) {
      parts.push(`  - ${c.code}: ${c.discount_type === 'percent' ? `${c.discount_value}% off` : `$${c.discount_value} off`}`)
    }
  }

  if (ctx.checkoutState) {
    parts.push(`Estado de checkout: ${ctx.checkoutState}`)
    if (ctx.checkoutData) parts.push(`Datos de checkout recolectados: ${ctx.checkoutData}`)
  }

  if (ctx.activeOrderId) {
    parts.push(`Pedido activo ID: ${ctx.activeOrderId}`)
    if (ctx.activeOrderDetails) {
      parts.push(`Detalle del pedido activo:`)
      for (const item of ctx.activeOrderDetails) {
        parts.push(`  - ${item.product_name} x${item.quantity} (${item.variant_label || ''}) — ${item.total}`)
      }
    }
  }

  if (ctx.error) parts.push(`Error: ${ctx.error}`)

  parts.push('')
  parts.push(`Mensaje del cliente: "${sanitizeUserInput(userMessage)}"`)

  return parts.join('\n')
}

// ── Parse agent JSON response ──────────────────────────────

export function parseAgentResponse(raw: string): AgentResponse {
  try {
    let json = raw.trim()

    // Remove markdown code fences if present
    if (json.startsWith('`')) {
      json = json.replace(/^`(?:json)?\s*\n?/, '').replace(/\n?`\s*$/, '')
    }

    // Try direct parse first
    try {
      const parsed = JSON.parse(json) as { message?: string; action?: AgentAction | null }
      if (parsed.message) {
        return { message: parsed.message, action: parsed.action || null }
      }
    } catch { /* try fallback */ }

    // Fallback: extract first JSON object from text (AI sometimes mixes natural text + JSON)
    const jsonMatch = json.match(/\{[\s\S]*?"message"[\s\S]*?"action"[\s\S]*?\}|{[\s\S]*?"message"[\s\S]*?\}/)
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]) as { message?: string; action?: AgentAction | null }
        if (extracted.message) {
          return { message: extracted.message, action: extracted.action || null }
        }
      } catch { /* continue to regex extraction */ }
    }

    // Last resort: extract message value by regex (handles malformed JSON)
    const msgMatch = json.match(/"message"\s*:\s*"([^"]+)"/)
    if (msgMatch && msgMatch[1]) {
      const actionMatch = json.match(/"action"\s*:\s*(\{[^}]+\})/)
      let action: AgentAction | null = null
      if (actionMatch) {
        try { action = JSON.parse(actionMatch[1]) } catch { /* ignore */ }
      }
      return { message: msgMatch[1], action }
    }

    // If still looks like JSON but we couldn't parse it, don't leak raw JSON to customer
    if (json.startsWith('{') || json.startsWith('[')) {
      return { message: '', action: null }
    }
  } catch { /* fallback */ }
  return { message: raw.trim(), action: null }
}

// ── HTTPS JSON POST (avoids Node.js fetch ByteString bug) ──
// Node.js built-in fetch (undici) has a ByteString encoding bug with
// characters > 255. Using node:https directly bypasses this entirely.

import https from 'node:https'

function httpsPost(url: string, headers: Record<string, string>, bodyStr: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const buf = Buffer.from(bodyStr, 'utf-8')
    const options: https.RequestOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': buf.length,
      },
    }
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8')
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTPS ${res.statusCode}: ${body.slice(0, 200)}`))
        } else {
          resolve(body)
        }
      })
    })
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

// ── AI API Callers ─────────────────────────────────────────────

async function callOpenAI(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const raw = await httpsPost('https://api.openai.com/v1/chat/completions', {
    'Authorization': `Bearer ${apiKey}`,
  }, JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 400 }))
  const data = JSON.parse(raw) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callAnthropic(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')
  const raw = await httpsPost('https://api.anthropic.com/v1/messages', {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }, JSON.stringify({
    model,
    system: systemMsg?.content,
    messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
    temperature: 0.3,
    max_tokens: 400,
  }))
  const data = JSON.parse(raw) as { content: Array<{ text: string }> }
  return data.content[0]?.text ?? ''
}

async function callDeepSeek(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const raw = await httpsPost('https://api.deepseek.com/v1/chat/completions', {
    'Authorization': `Bearer ${apiKey}`,
  }, JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 400 }))
  const data = JSON.parse(raw) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callGroq(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const raw = await httpsPost('https://api.groq.com/openai/v1/chat/completions', {
    'Authorization': `Bearer ${apiKey}`,
  }, JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 400 }))
  const data = JSON.parse(raw) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callGoogle(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const systemMsg = messages.find(m => m.role === 'system')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const raw = await httpsPost(url, {}, JSON.stringify({
    contents,
    systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
    generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
  }))
  const data = JSON.parse(raw) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Load AI config ─────────────────────────────────────────────

async function loadConfig(orgId?: string): Promise<AiConfig | null> {
  if (!orgId) {
    console.log('[AI] loadConfig: no orgId')
    return null
  }
  try {
    const sb = createServiceClient()
    const { data: org } = await sb.from('organizations').select('settings').eq('id', orgId).single()
    const ai = (org?.settings as Record<string, any> | null)?.ai as AiConfig | undefined
    if (ai?.apiKey && ai?.provider) {
      // Decrypt the API key if it was encrypted (AES-256-GCM with "enc:" prefix)
      const decryptedKey = decrypt(ai.apiKey)
      // Sanitize API key — strip any non-ASCII chars that may have been stored
      const cleanKey = decryptedKey.replace(/[^\x20-\x7E]/g, '')
      const cleanModel = (ai.model || '').replace(/[^\x20-\x7E\w.-]/g, '')
      if (cleanKey !== decryptedKey) {
        console.log('[AI] sanitized apiKey (had non-ASCII chars, length was', decryptedKey.length, 'now', cleanKey.length, ')')
        // Persist the clean key back (re-encrypted if needed)
        const sb2 = createServiceClient()
        const { data: org2 } = await sb2.from('organizations').select('settings').eq('id', orgId).single()
        const s = (org2?.settings as Record<string, any>) ?? {}
        await sb2.from('organizations').update({
          settings: { ...s, ai: { provider: ai.provider, apiKey: encrypt(cleanKey), model: cleanModel || ai.model } },
        }).eq('id', orgId)
      }
      console.log('[AI] config loaded:', ai.provider, ai.model)
      return { ...ai, apiKey: cleanKey, model: cleanModel || ai.model }
    }
    console.log('[AI] no ai config in org settings')
  } catch (err) {
    console.error('[AI] loadConfig error:', err)
  }
  return null
}

// ── Main AI Agent Function ─────────────────────────────────

export async function generateAiResponse(
  userMessage: string,
  ctx: Record<string, any>,
  orgId?: string
): Promise<AgentResponse | null> {
  const config = await loadConfig(orgId)
  if (!config) {
    console.log('[AI] no config, skipping AI response')
    return null
  }
  console.log('[AI] calling', config.provider, 'model:', config.model)

  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  const history = (ctx.history ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>
  const PAYMENT_PATTERNS = /(banco|alias|transferencia|comprobante|cvu|cbu|titular|pago|cuenta bancaria|datos para|realizar la transferencia)/i
  const cleanHistory = history.filter(h => !PAYMENT_PATTERNS.test(h.content))
  for (const h of cleanHistory.slice(-6)) {
    messages.push({ role: h.role, content: h.content })
  }
  messages.push({ role: 'user', content: buildAiPrompt(userMessage, ctx) })

  let raw: string | null = null
  try {
    switch (config.provider) {
      case 'anthropic': raw = await callAnthropic(config.apiKey, config.model || 'claude-sonnet-4-20250514', messages); break
      case 'deepseek':  raw = await callDeepSeek(config.apiKey, config.model || 'deepseek-chat', messages); break
      case 'groq':      raw = await callGroq(config.apiKey, config.model || 'llama-3.3-70b-versatile', messages); break
      case 'google':    raw = await callGoogle(config.apiKey, config.model || 'gemini-2.0-flash', messages); break
      default:          raw = await callOpenAI(config.apiKey, config.model || 'gpt-4o', messages); break
    }
  } catch (err) {
    console.error('[AI Agent] Error:', err); return null
  }
  if (!raw) return null
  return parseAgentResponse(raw)
}
