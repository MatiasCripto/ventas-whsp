// ── Conversational AI Agent for Commerce ───────────────────
// ADAPTED from Clinify's ai-chat.ts for commerce context
// Multi-provider: OpenAI / Anthropic / DeepSeek / Groq / Google

import { createServiceClient } from '@/lib/supabase/service'

interface AiConfig {
  provider: string
  apiKey: string
  model: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CommerceAiContext {
  customerName?: string | null
  storeName?: string
  isKnownCustomer?: boolean
  state: string
  // Commerce data (from Commerce Brain)
  contextData?: string
  // Conversation memory
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface AgentResponse {
  message: string
  action: AgentAction | null
}

export interface AgentAction {
  type: 'search_products' | 'get_product' | 'add_to_cart' | 'remove_from_cart'
      | 'checkout' | 'cancel_order' | 'track_order' | 'human_handoff'
      | 'apply_coupon' | 'get_customer_info' | 'update_profile'
  // For checkout:
  customerName?: string
  address?: string
  paymentMethod?: string
  // For cancel:
  orderId?: string
  orderIds?: string[]
  // For handoff:
  reason?: string
  payload?: Record<string, unknown>
}

// ── System Prompt for Commerce ─────────────────────────────

const SYSTEM_PROMPT = `SOS CONCIERGE AI. Sos una vendedora virtual experta para una tienda de ropa y accesorios.

PERSONALIDAD:
- Cálida, entusiasta, servicial, natural
- Hablás como una vendedora de verdad, no como chatbot
- Mensajes CORTOS (1-3 oraciones). UNA pregunta por vez.
- Emojis con moderación 😊
- NO usas listas numeradas, bullets, markdown, negritas, asteriscos

REGLAS DE ORO:
- NUNCA inventes stock, precios ni disponibilidad
- NUNCA confirmes un pedido sin validación server-side
- TODO lo que mostrás viene de la base de datos en el contexto
- Si algo no está en el contexto, NO EXISTE — no lo inventes

FLUJO DE VENTA NATURAL:
1. Saludar y ofrecer ayuda
2. Preguntar qué busca (categoría, color, talle, estilo)
3. Mostrar productos relevantes y recomendar
4. Preguntar variante (color/talle) cuando corresponda
5. Confirmar precio y stock
6. Agregar al carrito
7. Preguntar si quiere algo más
8. Cuando termina: preguntar dirección y método de pago
9. Confirmar pedido completo
10. Despedir y ofrecer más ayuda

UPSELL NATURAL (sin presionar):
- Si lleva una remera, sugerir jean que combine
- Si lleva 2 pares, mencionar que hay descuento
- Si es cliente recurrente, preguntar si quiere lo mismo que la vez pasada

HANDOFF:
- Cliente pide humano → action type "human_handoff"
- Problema de pago → ofrecer alternativas, si insiste → human_handoff
- Consulta muy compleja → human_handoff

RESPONDÉ SIEMPRE EN JSON:
{
  "message": "tu respuesta natural al cliente",
  "action": null
}

O si hay una acción:
{
  "message": "¡Listo! Te lo agrego al carrito 😊",
  "action": {
    "type": "add_to_cart",
    ...payload según corresponda
  }
}

⛔ RESPONDÉ SOLO EL JSON, NADA MÁS.`

// ── Build context ──────────────────────────────────────────

export function buildCommercePrompt(
  userMessage: string,
  ctx: CommerceAiContext
): string {
  const parts: string[] = []

  if (ctx.storeName) parts.push(`Tienda: ${ctx.storeName}`)
  if (ctx.customerName) {
    parts.push(`Cliente: ${ctx.customerName}`)
    if (ctx.isKnownCustomer) parts.push('Cliente registrado — ya compró antes.')
  }

  if (ctx.contextData) parts.push(ctx.contextData)

  parts.push(``)
  parts.push(`Estado: ${ctx.state}`)
  parts.push(``)
  parts.push(`Mensaje del cliente: "${userMessage}"`)

  return parts.join('\n')
}

// ── Parse agent JSON response ──────────────────────────────

export function parseAgentResponse(raw: string): AgentResponse {
  try {
    let json = raw.trim()
    if (json.startsWith('```')) {
      json = json.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    const parsed = JSON.parse(json) as { message?: string; action?: AgentAction | null }
    if (parsed.message) {
      return { message: parsed.message, action: parsed.action || null }
    }
  } catch { /* fall through */ }
  return { message: raw.trim(), action: null }
}

// ── AI API Callers (copied from Clinify) ────────────────────

async function callOpenAI(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callAnthropic(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      system: systemMsg?.content,
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.3,
      max_tokens: 500,
    }),
  })
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
  const data = await res.json() as { content: Array<{ text: string }> }
  return data.content[0]?.text ?? ''
}

async function callDeepSeek(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
  })
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callGroq(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
  })
  if (!res.ok) throw new Error(`Groq error: ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callGoogle(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const systemMsg = messages.find(m => m.role === 'system')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
    }),
  })
  if (!res.ok) throw new Error(`Google error: ${res.status}`)
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Load AI config from organization ───────────────────────

async function loadConfig(orgId?: string): Promise<AiConfig | null> {
  if (!orgId) return null
  try {
    const sb = createServiceClient()
    const { data: org } = await sb
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()

    const ai = (org?.settings as Record<string, unknown> | null)?.ai as AiConfig | undefined
    if (ai?.apiKey && ai?.provider) return ai
  } catch { /* fallback */ }
  return null
}

// ── Main AI Agent Function ─────────────────────────────────

export async function generateCommerceResponse(
  userMessage: string,
  ctx: CommerceAiContext,
  orgId?: string
): Promise<AgentResponse | null> {
  const config = await loadConfig(orgId)
  if (!config) return null

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  const history = ctx.history ?? []
  for (const h of history.slice(-6)) {
    messages.push({ role: h.role, content: h.content })
  }

  messages.push({ role: 'user', content: buildCommercePrompt(userMessage, ctx) })

  let raw: string | null = null
  try {
    switch (config.provider) {
      case 'anthropic':
        raw = await callAnthropic(config.apiKey, config.model || 'claude-sonnet-4-20250514', messages)
        break
      case 'deepseek':
        raw = await callDeepSeek(config.apiKey, config.model || 'deepseek-chat', messages)
        break
      case 'groq':
        raw = await callGroq(config.apiKey, config.model || 'llama-3.3-70b-versatile', messages)
        break
      case 'google':
        raw = await callGoogle(config.apiKey, config.model || 'gemini-2.0-flash', messages)
        break
      case 'openai':
      default:
        raw = await callOpenAI(config.apiKey, config.model || 'gpt-4o', messages)
        break
    }
  } catch (err) {
    console.error('[AI Agent] Error:', err)
    return null
  }

  if (!raw) return null
  return parseAgentResponse(raw)
}
