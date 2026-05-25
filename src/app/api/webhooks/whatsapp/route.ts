// ── WhatsApp Webhook (Evolution API) ────────────────────────
// Orquestador: Evolution → State Machine → Commerce Brain → AI → Response
//
// Flujo completo:
// 1. Validar webhook secret + rate limit
// 2. Cargar contexto de conversación (in-memory cache → Supabase)
// 3. State machine trackea estado
// 4. Commerce Brain: intent → retrieval → contexto
// 5. AI genera respuesta con datos reales
// 6. Validar y ejecutar acciones server-side
// 7. Persistir contexto + mensajes
// 8. Enviar respuesta via Evolution API

import { NextRequest, NextResponse } from 'next/server'
import type { EvolutionWebhookPayload, EvolutionMessageData, BotContext, AgentAction } from '@/lib/types/whatsapp.types'
import { extractPhone, extractText } from '@/lib/bot/intent-classifier'
import { processMessage, createInitialContext } from '@/lib/bot/conversation-engine'
import { sendMultiple } from '@/lib/bot/evolution-client'
import { createServiceClient } from '@/lib/supabase/service'
import { processCommerceMessage } from '@/lib/commerce/brain'
import { generateCommerceResponse } from '@/lib/bot/ai-chat'
import { executeAction } from '@/lib/commerce/actions'
import { checkRateLimit } from '@/lib/utils/rate-limit'

// ── In-memory context cache ────────────────────────────────────

const CTX_MAX_ENTRIES = 500
const CTX_TTL_MS = 60 * 60 * 1000  // 1 hour
const ctxMap = new Map<string, BotContext>()

function evictStaleContexts() {
  if (ctxMap.size <= CTX_MAX_ENTRIES) return
  const now = Date.now()
  const toDelete: string[] = []
  for (const [phone, ctx] of ctxMap) {
    const age = ctx.lastMessageAt ? now - new Date(ctx.lastMessageAt).getTime() : Infinity
    if (age > CTX_TTL_MS) toDelete.push(phone)
  }
  for (const phone of toDelete) ctxMap.delete(phone)
  if (ctxMap.size > CTX_MAX_ENTRIES) {
    const sorted = [...ctxMap.entries()].sort(
      (a, b) => (a[1].lastMessageAt ?? '').localeCompare(b[1].lastMessageAt ?? '')
    )
    for (const [phone] of sorted.slice(0, ctxMap.size - CTX_MAX_ENTRIES)) {
      ctxMap.delete(phone)
    }
  }
}

async function loadContext(phone: string): Promise<BotContext | null> {
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('conversations')
      .select('context')
      .eq('channel_contact_id', phone)
      .maybeSingle()
    if (data?.context) {
      const ctx = data.context as BotContext
      ctxMap.set(phone, ctx)
      return ctx
    }
  } catch { /* table may not exist yet */ }
  if (ctxMap.has(phone)) return ctxMap.get(phone)!
  return null
}

async function saveContext(phone: string, ctx: BotContext) {
  ctxMap.set(phone, ctx)
  try {
    const sb = createServiceClient()
    await sb.from('conversations').upsert(
      { channel_contact_id: phone, context: ctx, last_message_at: new Date().toISOString(), channel: 'whatsapp', channel_chat_id: `${phone}@s.whatsapp.net` },
      { onConflict: 'channel_chat_id' }
    )
  } catch { /* non-critical */ }
}

async function getConversationId(phone: string): Promise<string | null> {
  try {
    const sb = createServiceClient()
    const { data } = await sb.from('conversations').select('id').eq('channel_contact_id', phone).maybeSingle()
    return data?.id ?? null
  } catch { return null }
}

async function saveMessage(convId: string, direction: 'inbound' | 'outbound', body: string) {
  const sb = createServiceClient()
  await sb.from('messages').insert({ conversation_id: convId, direction, body, type: 'text' })
}

async function findOrCreateCustomer(phone: string, orgId: string, name?: string | null): Promise<string | null> {
  const sb = createServiceClient()
  const cleanPhone = phone.replace(/@\w+$/, '')

  const { data: existing } = await sb.from('customers')
    .select('id')
    .eq('phone', cleanPhone)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created } = await sb.from('customers').insert({
    organization_id: orgId,
    full_name: name?.trim() ?? `Cliente WhatsApp ${cleanPhone.slice(-4)}`,
    phone: cleanPhone,
  }).select('id').single()

  return created?.id ?? null
}

async function fetchCategories(orgId: string): Promise<string[]> {
  try {
    const sb = createServiceClient()
    const { data } = await sb.from('categories')
      .select('name')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name')
    return (data ?? []).map((c: { name: string }) => c.name)
  } catch { return [] }
}

// ── Main webhook handler ──────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit: 30 req/min per IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const rl = checkRateLimit(`webhook:${ip}`, { windowMs: 60_000, maxHits: 30 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // Validate webhook secret
  const secret = process.env.WEBHOOK_SECRET
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: EvolutionWebhookPayload
  try { payload = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const evt = payload.event?.toLowerCase() ?? ''
  if (evt !== 'messages.upsert') {
    return NextResponse.json({ ok: true, skipped: payload.event })
  }

  const data = payload.data as EvolutionMessageData
  if (data.key?.fromMe) return NextResponse.json({ ok: true })

  const jid = data.key?.remoteJid ?? ''
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@c.us')) {
    return NextResponse.json({ ok: true })
  }

  const phone = extractPhone(jid)
  const text  = extractText(data as unknown as { message?: Record<string, unknown> })
  const name  = data.pushName

  if (!phone || !text) return NextResponse.json({ ok: true })

  // Memory leak prevention
  evictStaleContexts()

  // Load context
  let ctx = (await loadContext(phone)) ?? createInitialContext(phone)

  // Stale context recovery
  if (ctx.lastMessageAt) {
    const elapsed = Date.now() - new Date(ctx.lastMessageAt).getTime()
    if (elapsed > 30 * 60 * 1000 && ctx.state !== 'idle') {
      console.log('[Webhook] Stale context, resetting')
      ctx = createInitialContext(phone)
    }
  }

  // Resolve organization from WhatsApp instance
  let orgId: string | null = null
  let storeId: string | null = null
  let storeInfo: BotContext['storeInfo'] | undefined
  try {
    const sb = createServiceClient()
    const instanceName = payload.instance
    const { data: store } = await sb.from('stores')
      .select('id, organization_id, name, settings')
      .eq('evolution_instance', instanceName)
      .maybeSingle()
    if (store) {
      storeId = store.id
      orgId = store.organization_id
      const s = store as { name: string; settings?: Record<string, unknown> }
      ctx.storeId = store.id
      ctx.organizationId = store.organization_id
      storeInfo = {
        name: s.name,
        shipping: (s.settings?.shipping as string) ?? '',
        payment: (s.settings?.payment as string) ?? '',
        returns: (s.settings?.returns as string) ?? '',
      }
      ctx.storeInfo = storeInfo
    }
  } catch { /* ignore */ }

  // Pre-load customer data on first message
  if (['idle', 'greeting'].includes(ctx.state) && orgId) {
    const customerId = await findOrCreateCustomer(phone, orgId, name)
    if (customerId) {
      ctx.customerId = customerId
      ctx.isKnownCustomer = true
      if (name) ctx.customerName = name
    }
  }

  // Pre-load categories
  if (orgId) {
    const cats = await fetchCategories(orgId)
    ctx.availableCategories = cats
  }

  // Process through state machine
  const { newContext, responses, shouldEndSession } = processMessage(text, ctx, name)

  // Check for human takeover
  if (orgId) {
    try {
      const sb = createServiceClient()
      const { data: conv } = await sb.from('conversations')
        .select('human_takeover')
        .eq('channel_contact_id', phone)
        .maybeSingle()
      if (conv?.human_takeover === true) {
        try {
          const convId = await getConversationId(phone)
          if (convId) await saveMessage(convId, 'inbound', text)
        } catch { /* ignore */ }
        return NextResponse.json({ ok: true, human_takeover: true })
      }
    } catch { /* ignore */ }
  }

  // ── Generate AI Response ───────────────────────────────────
  let finalResponse: string | null = null
  let action: { type: string; payload: Record<string, unknown> } | undefined

  if (responses.includes('__AI_GENERATE__')) {
    // Run through Commerce Brain first
    const commerceResult = await processCommerceMessage(text, newContext, orgId)
    const contextData = commerceResult.response

    // Call AI with commerce context
    const aiResponse = await generateCommerceResponse(text, {
      customerName: newContext.customerName,
      storeName: storeInfo?.name,
      isKnownCustomer: newContext.isKnownCustomer,
      state: newContext.state,
      contextData,
      history: newContext.history ?? [],
    })

    if (aiResponse) {
      finalResponse = aiResponse.message

      // Execute AI-proposed action (with server-side validation)
      if (aiResponse.action && orgId) {
        const actionResult = await executeAction(aiResponse.action as AgentAction, {
          organizationId: orgId,
          customerId: newContext.customerId,
          phone,
        })

        if (!actionResult.ok && aiResponse.action.type !== 'human_handoff') {
          finalResponse = actionResult.message
        }

        action = { type: aiResponse.action.type, payload: aiResponse.action.payload ?? {} }
      }
    }
  }

  // Fallback: use commerce brain response directly
  if (!finalResponse && !responses.every(r => r.startsWith('__'))) {
    finalResponse = responses.filter(r => !r.startsWith('__')).join('\n')
  }

  if (!finalResponse) {
    finalResponse = '¡Hola! 😊 Soy Concierge AI. ¿En qué puedo ayudarte hoy?'
  }

  // Update conversation history
  const history = newContext.history ?? []
  history.push({ role: 'user', content: text })
  history.push({ role: 'assistant', content: finalResponse })
  newContext.history = history.slice(-20)

  // Persist context
  const finalCtx = shouldEndSession ? { ...newContext, state: 'idle' as const } : newContext
  try { await saveContext(phone, finalCtx) } catch { /* ignore */ }

  // Save messages
  try {
    const convId = await getConversationId(phone)
    if (convId) {
      await saveMessage(convId, 'inbound', text)
      await saveMessage(convId, 'outbound', finalResponse)
    }
  } catch { /* ignore */ }

  // Send response
  try {
    await sendMultiple(jid, [finalResponse])
  } catch (err) {
    console.error('[Webhook] Send error:', err)
  }

  return NextResponse.json({ ok: true, state: finalCtx.state })
}

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge)
  return NextResponse.json({ status: 'Concierge AI webhook active' })
}
