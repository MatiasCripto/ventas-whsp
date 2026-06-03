// ── WhatsApp webhook (Evolution API) ───────────────────────────
// Receives incoming WhatsApp messages, processes them with AI,
// and sends responses via Evolution API.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendText, downloadMedia } from '@/lib/bot/evolution-client'
import {
  getOrCreateConversation, saveMessage, updateContext,
  fetchProducts, fetchCustomerOrders, fetchCustomerHistory,
  fetchCart, fetchCoupons, handleCheckout,
  acquireConversationLock, releaseConversationLock,
  resolveProductVariant,
} from '@/lib/bot/conversation-engine'
import { generateAiResponse, buildAiPrompt } from '@/lib/bot/ai-chat'
import {
  initCheckout, processCheckoutMessage, AI_GENERATE,
  buildCheckoutContext,
} from '@/lib/bot/checkout-machine'
import { buildProductPresentation } from '@/lib/bot/product-emoji-map'
import { getStorePaymentSettings, formatPaymentSettings } from '@/lib/bot/payment-service'
import { uploadPaymentProof } from '@/lib/bot/storage-service'
import { createPaymentProof } from '@/lib/bot/payment-proof-service'
import { recordOrderEvent } from '@/lib/services/order-event.service'
import { processPaymentProofOcr } from '@/lib/workflows/payment-proof-ocr.workflow'
import type { CheckoutState } from '@/lib/bot/checkout-machine'
import type { EvolutionWebhookPayload, EvolutionMessageData, BotContext } from '@/lib/types/whatsapp.types'

const CHECKOUT_STATES: Set<string> = new Set(['name', 'dni', 'shipping', 'address', 'payment_method', 'payment_waiting_proof', 'confirm', 'completed'])

// Old state values that should be reset to idle
const LEGACY_STATES: Set<string> = new Set(['checkout', 'checkout_completed'])

function isCheckoutState(s: string): boolean {
  return CHECKOUT_STATES.has(s)
}

export async function POST(req: NextRequest) {
  const __start = Date.now()
  let ctx!: BotContext
  let conversationId: string | undefined
  try {
    const payload = await req.json() as EvolutionWebhookPayload
    console.log('[WEBHOOK] event:', payload.event, 'instance:', payload.instance)
    if (payload.event !== 'messages.upsert') return NextResponse.json({ ok: true })
    const data = payload.data as EvolutionMessageData
    if (data.key?.fromMe) return NextResponse.json({ ok: true })

    const jid = data.key?.remoteJid ?? ''
    const phone = jid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '')
    const text = data.message?.conversation || data.message?.extendedTextMessage?.text || ''
    const pushName = data.pushName
    if (!phone || !text) {
      console.log('[WEBHOOK] skip: no phone or text', { phone, hasText: !!text })
      return NextResponse.json({ ok: true })
    }
    console.log('[WEBHOOK] msg from:', phone, 'text:', text.slice(0, 60))

    // Normalize common color typos (e.g. "Balnco" -> "blanco")
    function normalizeColor(c: string): string {
      return c.toLowerCase().replace(/^b(al)nco$/i, 'blanco').replace(/^gris$/i, 'gris')
    }

    // Find org by Evolution instance
    const sb = createServiceClient()
    const { data: store } = await sb.from('stores')
      .select('id, organization_id, name')
      .eq('evolution_instance', payload.instance)
      .maybeSingle()
    if (!store) {
      console.log('[WEBHOOK] unknown instance:', payload.instance)
      return NextResponse.json({ error: 'Unknown instance' }, { status: 404 })
    }
    console.log('[WEBHOOK] store:', store.name, 'org:', store.organization_id)

    const orgId = store.organization_id
    const storeId = store.id

    // Resolve Evolution instance for multi-tenant support
    const instanceName = payload.instance
    const evoSend = (phone: string, text: string) => sendText(phone, text, undefined, instanceName)
    const evoDownload = (jid: string, msgId: string) => downloadMedia(jid, msgId, instanceName)

    // Get or create conversation
    const { conversationId: cid, context: rawCtx, isNew } = await getOrCreateConversation(orgId, storeId, phone, pushName)
    conversationId = cid
    if (!conversationId) {
      console.log('[WEBHOOK] no conversationId')
      return NextResponse.json({ error: 'No conversation' }, { status: 500 })
    }
    console.log('[WEBHOOK] conv:', conversationId, 'isNew:', isNew)

    // Save inbound message
    await saveMessage(conversationId, 'inbound', text)
    ctx = rawCtx as BotContext
    console.log('[WEBHOOK] state:', ctx.state, 'customerId:', ctx.customerId, 'customerName:', ctx.customerName)

    // Acquire conversation lock (prevents concurrent processing race conditions)
    if (!acquireConversationLock(ctx)) {
      console.log('[WEBHOOK] conversation locked, skipping:', conversationId, 'processingSince:', ctx.processingStartedAt)
      return NextResponse.json({ ok: true })
    }

    // Reset legacy states from old code versions
    if (LEGACY_STATES.has(ctx.state)) {
      console.log('[WEBHOOK] resetting legacy state:', ctx.state, '→ idle')
      ctx.state = 'idle'
    }

    // ── CHECKOUT FLOW ──────────────────────────────────────────
    console.log('[WEBHOOK] routing — state:', ctx.state, 'isCheckout:', isCheckoutState(ctx.state), 'activeOrderId:', ctx.activeOrderId)
    if (isCheckoutState(ctx.state)) {
      console.log('[WEBHOOK] entering checkout flow, text:', text.slice(0, 50))
      const session = {
        state: ctx.state as CheckoutState,
        items: ctx.checkoutItems ?? [],
        customerName: ctx.checkoutName ?? ctx.customerName ?? undefined,
        dni: ctx.checkoutDni ?? undefined,
        shippingMethod: ctx.checkoutShippingMethod ?? undefined,
        address: ctx.checkoutAddress ?? undefined,
        locality: ctx.checkoutLocality ?? undefined,
        references: ctx.checkoutReferences ?? undefined,
        pickup: ctx.checkoutPickup ?? false,
        paymentMethod: ctx.checkoutPaymentMethod ?? undefined,
      }

      const result = processCheckoutMessage(text, session)

      // Persist updated session back to context
      ctx.state = result.session.state
      ctx.checkoutItems = result.session.items
      ctx.checkoutName = result.session.customerName
      ctx.checkoutDni = result.session.dni
      ctx.checkoutShippingMethod = result.session.shippingMethod
      ctx.checkoutAddress = result.session.address
      ctx.checkoutLocality = result.session.locality
      ctx.checkoutReferences = result.session.references
      ctx.checkoutPickup = result.session.pickup
      ctx.checkoutPaymentMethod = result.session.paymentMethod

      // ── Payment method: transfer → create order, send bank data ──
      if (result.session.state === 'payment_waiting_proof' && !ctx.activeOrderId) {
        if (!ctx.customerId) {
          await saveMessage(conversationId, 'outbound', 'Error: no se encontró el cliente')
          await evoSend(phone, 'Hubo un error al procesar tu pedido. Hablanos con un asesor.')
          await updateContext(conversationId, ctx)
          return NextResponse.json({ ok: true })
        }

        // Create order with 'awaiting_payment' status
        const checkoutResult = await handleCheckout(
          sb, orgId, storeId, ctx.customerId,
          {
            items: session.items,
            shippingMethod: session.shippingMethod,
            address: session.address,
            locality: session.locality,
            pickup: session.pickup,
            dni: session.dni,
            customerName: session.customerName,
          },
        )

        if (!checkoutResult.ok) {
          ctx.state = 'closed'
          await updateContext(conversationId, ctx)
          const errMsg = 'Hubo un error al crear tu pedido. Por favor hablanos con un asesor.'
          await saveMessage(conversationId, 'outbound', errMsg)
          await evoSend(phone, errMsg)
          return NextResponse.json({ ok: true })
        }

        // Update order status to awaiting_payment
        await sb.from('orders').update({
          status: 'awaiting_payment',
          payment_status: 'awaiting',
          pickup: session.pickup ?? false,
          dni: session.dni ?? null,
          locality: session.locality ?? null,
        }).eq('id', checkoutResult.orderId)

        // Record audit event — payment requested
        await recordOrderEvent(sb, {
          order_id: checkoutResult.orderId!,
          type: 'payment_requested',
          actor_type: 'customer',
          actor_id: ctx.customerId ?? null,
        })

        // Fetch bank data and send to customer
        ctx.activeOrderId = checkoutResult.orderId
        const paySettings = await getStorePaymentSettings(sb, storeId, orgId)
        let bankMsg: string
        if (paySettings) {
          console.log('[PAYMENT_INFO] sending bank data from checkout — alias:', paySettings.alias, 'bank:', paySettings.bank_name, 'org:', orgId)
          bankMsg = formatPaymentSettings(paySettings)
        } else {
          console.log('[PAYMENT_SETTINGS] no account configured — sending fallback message')
          bankMsg = '⚠️ No hay una cuenta bancaria configurada actualmente. Por favor hablanos con un asesor.'
        }

        await updateContext(conversationId, ctx)
        await saveMessage(conversationId, 'outbound', bankMsg)
        await evoSend(phone, bankMsg)
        return NextResponse.json({ ok: true })
      }

      // ── Checkout complete → execute order ────────────────────
      if (result.action?.type === 'checkout') {
        if (!ctx.customerId) {
          await saveMessage(conversationId, 'outbound', 'Error: no se encontró el cliente')
          await evoSend(phone, 'Hubo un error al procesar tu pedido. Hablanos con un asesor.')
          return NextResponse.json({ ok: true })
        }

        const customerId = ctx.customerId
        const paymentMethod = session.paymentMethod ?? ctx.checkoutPaymentMethod
        const checkoutResult = await handleCheckout(
          sb, orgId, storeId, customerId,
          { items: session.items, shippingMethod: session.shippingMethod, address: session.address, locality: session.locality, pickup: session.pickup, dni: session.dni, customerName: session.customerName },
        )

        if (checkoutResult.ok) {
          // Update order with payment method and appropriate status
          const orderStatus = paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending'
          await sb.from('orders').update({
            status: orderStatus,
            payment_status: paymentMethod === 'transfer' ? 'awaiting' : 'pending',
            payment_method: paymentMethod ?? null,
            pickup: session.pickup ?? false,
            dni: session.dni ?? null,
            locality: session.locality ?? null,
          }).eq('id', checkoutResult.orderId)

          // Update customer with collected data
          await sb.from('customers').update({
            full_name: session.customerName,
            ...(session.dni ? { dni: session.dni } : {}),
            ...(session.address && session.shippingMethod === 'shipping' ? { default_address: session.address } : {}),
          }).eq('id', customerId)

          ctx.state = 'closed'
          ctx.activeOrderId = checkoutResult.orderId
          ctx.lastOrderId = checkoutResult.orderId
          await updateContext(conversationId, ctx)
          const confirmMsg =
            `✅ ¡Pedido #${checkoutResult.orderNumber} confirmado!\n\n` +
            `${checkoutResult.itemsSummary}\n\n` +
            `💰 Total: $${checkoutResult.total?.toFixed(2)}\n\n` +
            (session.pickup
              ? '📦 Te avisamos cuando esté listo para retirar.'
              : '📦 Te vamos a informar cuando esté en camino.')
          await saveMessage(conversationId, 'outbound', confirmMsg)
          await evoSend(phone, confirmMsg)
          await updateContext(conversationId, ctx)
          return NextResponse.json({ ok: true })
        } else {
          ctx.state = 'closed'
          await updateContext(conversationId, ctx)
          const errMsg = 'Hubo un error al crear tu pedido. Por favor hablanos con un asesor.'
          await saveMessage(conversationId, 'outbound', errMsg)
          await evoSend(phone, errMsg)
          return NextResponse.json({ ok: true })
        }
      }

      // Human handoff during checkout
      if (result.action?.type === 'human_handoff') {
        ctx.state = 'human_handoff'
        await sb.from('conversations').update({ status: 'human', human_takeover: true }).eq('id', conversationId)
        const handoffMsg = 'Te paso con alguien del equipo para ayudarte.'
        await saveMessage(conversationId, 'outbound', handoffMsg)
        await evoSend(phone, handoffMsg)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      // AI-generated response (user said something unexpected during checkout)
      if (result.response === AI_GENERATE) {
        const checkoutSummary = buildCheckoutContext(session)
        const aiCtx: Record<string, any> = {
          storeName: store.name,
          customerName: ctx.customerName,
          checkoutState: result.session.state,
          checkoutData: checkoutSummary || undefined,
          history: ctx.history ?? [],
        }
        const aiResponse = await generateAiResponse(text, aiCtx, orgId)
        const replyText = aiResponse?.message ?? 'Entendido. Sigamos con el pedido.'
        const historyMsgs = ctx.history ?? []
        historyMsgs.push({ role: 'user', content: text })
        historyMsgs.push({ role: 'assistant', content: replyText })
        ctx.history = historyMsgs
        await saveMessage(conversationId, 'outbound', replyText)
        await evoSend(phone, replyText)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      // Direct response from state machine (standard question)
      const historyMsgs = ctx.history ?? []
      historyMsgs.push({ role: 'user', content: text })
      historyMsgs.push({ role: 'assistant', content: result.response })
      ctx.history = historyMsgs
      await saveMessage(conversationId, 'outbound', result.response)
      await evoSend(phone, result.response)
      await updateContext(conversationId, ctx)
      return NextResponse.json({ ok: true })
    }

    // ── PAYMENT PROOF DETECTION (image + active order) ────────
    if (ctx.activeOrderId && (data.message?.imageMessage?.url || data.message?.imageMessage)) {
      const jid = data.key.remoteJid
      const msgId = data.key.id
      if (!jid || !msgId) return NextResponse.json({ ok: true })

      // Download the image from Evolution API
      const imageBuffer = await evoDownload(jid, msgId)
      if (!imageBuffer) {
        await evoSend(phone, 'No pude descargar la imagen. ¿Podés intentar de nuevo?')
        return NextResponse.json({ ok: true })
      }

      // Upload to Supabase Storage
      const imageUrl = await uploadPaymentProof(sb, ctx.activeOrderId, ctx.customerId!, imageBuffer, `proof_${Date.now()}.jpg`)
      if (!imageUrl) {
        await evoSend(phone, 'No pude guardar la imagen. ¿Podés intentar de nuevo?')
        return NextResponse.json({ ok: true })
      }

      // Create payment_proof record
      const createdProof = await createPaymentProof(sb, {
        organization_id: orgId,
        store_id: storeId,
        order_id: ctx.activeOrderId,
        customer_id: ctx.customerId!,
        image_url: imageUrl,
      })

      // Record audit event — proof received
      await recordOrderEvent(sb, {
        order_id: ctx.activeOrderId,
        type: 'proof_received',
        actor_type: 'customer',
        actor_id: ctx.customerId!,
      })

      // Trigger OCR processing (fire-and-forget — non blocking)
      if (createdProof?.id) {
        processPaymentProofOcr({ proofId: createdProof.id, imageUrl }).catch(err =>
          console.error('[WEBHOOK] OCR background error:', err)
        )
      }

      // Update order status to payment_under_review
      await sb.from('orders').update({
        status: 'payment_under_review',
        payment_status: 'under_review',
      }).eq('id', ctx.activeOrderId)

      // Reset checkout state
      ctx.checkoutItems = undefined
      ctx.checkoutName = undefined
      ctx.checkoutDni = undefined
      ctx.checkoutShippingMethod = undefined
      ctx.checkoutAddress = undefined
      ctx.checkoutLocality = undefined
      ctx.checkoutReferences = undefined
      ctx.checkoutPickup = undefined
      ctx.checkoutPaymentMethod = undefined
      ctx.activeOrderId = undefined
      ctx.state = 'closed'

      const confirmMsg = '¡Gracias! Recibí el comprobante 📸 Lo vamos a revisar y te avisamos cuando esté aprobado. 😊'
      await saveMessage(conversationId, 'outbound', confirmMsg)
      await evoSend(phone, confirmMsg)
      await updateContext(conversationId, ctx)
      return NextResponse.json({ ok: true })
    }

    // ── NORMAL FLOW (no checkout) ──────────────────────────────
    console.log('[WEBHOOK] entering normal flow', 'customerId:', ctx.customerId, 'historyLen:', ctx.history?.length ?? 0, 'activeOrderId:', ctx.activeOrderId)

    const customerId = ctx.customerId
    const [products, orders, history, cart, coupons] = await Promise.all([
      fetchProducts(sb, orgId),
      customerId ? fetchCustomerOrders(sb, orgId, customerId) : [],
      customerId ? fetchCustomerHistory(sb, orgId, customerId) : [],
      customerId ? fetchCart(sb, customerId) : null,
      fetchCoupons(sb, orgId),
    ])

    // Find active order details if there's an active order
    let activeOrderDetails: any[] | undefined
    let activeOrderStatus: string | undefined

    // Auto-detect active order from orders list if not already set
    if (!ctx.activeOrderId && orders?.length) {
      const EDITABLE_STATUSES = ['pending', 'awaiting_payment', 'payment_under_review', 'payment_confirmed', 'preparing']
      const activeOrder = orders.find((o: any) => EDITABLE_STATUSES.includes(o.status))
      if (activeOrder) {
        ctx.activeOrderId = activeOrder.id
        ctx.lastOrderId = activeOrder.id
        console.log('[WEBHOOK] auto-detected active order:', activeOrder.id, 'status:', activeOrder.status)
        // Save to context so it persists
        await updateContext(conversationId, ctx)
      }
    }

    if (ctx.activeOrderId && orders?.length) {
      const activeOrder = orders.find((o: any) => o.id === ctx.activeOrderId)
      activeOrderDetails = activeOrder?.items ?? undefined
      activeOrderStatus = activeOrder?.status ?? undefined
    }

    const aiCtx: Record<string, any> = {
      storeName: store.name,
      customerName: ctx.customerName,
      customerHistory: history,
      products,
      orders,
      cart,
      coupons,
      history: ctx.history ?? [],
      activeOrderId: ctx.activeOrderId ?? undefined,
      activeOrderStatus,
      activeOrderDetails,
    }

    // Generate AI response
    const response = await generateAiResponse(text, aiCtx, orgId)
    console.log('[WEBHOOK] AI response', 'hasResponse:', !!response, 'msg:', response?.message?.slice(0, 80), 'action:', response?.action?.type, 'items:', JSON.stringify(response?.action?.items), 'customerId:', ctx.customerId)
    if (!response) {
      const fallbackMsgs = [
        'Uh, disculpa, estoy teniendo una pequeña falla técnica. Deci "hola" para seguir hablando!',
        'Perdón, me trabé un segundo. Decime "hola" si seguis ahi y te atiendo al toque.',
      ]
      const fallback = fallbackMsgs[Math.floor(Math.random() * fallbackMsgs.length)]
      await saveMessage(conversationId, 'outbound', fallback)
      await evoSend(phone, fallback)
      return NextResponse.json({ ok: true })
    }

    // Save AI context to history (skip if message is empty or raw JSON)
    const historyMsgs = ctx.history ?? []
    historyMsgs.push({ role: 'user', content: text })
    if (response.message?.trim() && !response.message.trim().startsWith('{') && !response.message.trim().startsWith('[')) {
      historyMsgs.push({ role: 'assistant', content: response.message.trim() })
    }
    ctx.history = historyMsgs

    // Handle actions
    if (response.action?.type === 'human_handoff') {
      ctx.state = 'human_handoff'
      await sb.from('conversations').update({ status: 'human', human_takeover: true }).eq('id', conversationId)
    }

    if (response.action?.type === 'start_checkout') {
      console.log('[WEBHOOK] start_checkout received', 'hasCustomerId:', !!ctx.customerId, 'items:', JSON.stringify(response.action.items), 'customerId:', ctx.customerId)
    }
    if (response.action?.type === 'start_checkout' && ctx.customerId) {
      // Load existing customer data for smart skip
      const { data: customerData } = await sb.from('customers')
        .select('full_name, dni, default_address')
        .eq('id', ctx.customerId)
        .single()

      const existingData = {
        customerName: customerData?.full_name ?? ctx.customerName ?? undefined,
        dni: customerData?.dni ?? undefined,
        address: customerData?.default_address ?? undefined,
      }

      const session = initCheckout(response.action.items ?? [], existingData)
      ctx.state = session.state
      ctx.checkoutItems = session.items
      ctx.checkoutName = session.customerName
      ctx.checkoutDni = session.dni
      ctx.checkoutShippingMethod = session.shippingMethod
      ctx.checkoutAddress = session.address
      ctx.checkoutPickup = session.pickup

      // If all data existed, go straight to confirm with a summary
      if (session.state === 'confirm') {
        const confirmMsg =
          `Perfecto. Confirmamos:\n\n` +
          session.items.map(i => buildProductPresentation(i.productName, i.color, i.quantity, i.size)).join('\n') +
          `\n\n¿Está todo bien para generar el pedido?`
        await saveMessage(conversationId, 'outbound', confirmMsg)
        await evoSend(phone, confirmMsg)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      // Use the first question from the state machine
      const firstQuestion = getFirstQuestion(session.state)
      await saveMessage(conversationId, 'outbound', firstQuestion)
      await evoSend(phone, firstQuestion)
      await updateContext(conversationId, ctx)
      return NextResponse.json({ ok: true })
    }

    // ── Payment info request (backend handles bank data, NOT the AI) ──
    if (response.action?.type === 'request_payment_info') {
      console.log('[PAYMENT_HANDLER] request_payment_info triggered — store:', storeId, 'org:', orgId)
      const paySettings = await getStorePaymentSettings(sb, storeId, orgId)

      // Remove the AI's response from history — backend replaces it
      historyMsgs.pop()
      historyMsgs.pop()

      let bankMsg: string
      if (paySettings) {
        bankMsg = formatPaymentSettings(paySettings)
        console.log('[PAYMENT_INFO] sending bank data — alias:', paySettings.alias, 'bank:', paySettings.bank_name, 'source:', paySettings.source)
      } else {
        bankMsg = '⚠️ No hay una cuenta bancaria configurada actualmente. Por favor hablanos con un asesor.'
        console.log('[PAYMENT_INFO] no active account found')
      }

      await saveMessage(conversationId, 'outbound', bankMsg)
      await evoSend(phone, bankMsg)
      await updateContext(conversationId, ctx)
      return NextResponse.json({ ok: true })
    }

    // ── Payment info fallback (when AI doesn't generate action) ──
    const paymentKeywords = /pasame los datos|datos bancarios|alias|quiero pagar|quiero transferir|me pasas.*(?:cuenta|banco|alias|cbu|cvu)|necesito.*(?:pagar|transferir)|cbu|cvu|a qué (?:cuenta|banco)|cuenta bancaria|para transferir|para pagar|hacer el pago|realizar (?:la )?transferencia|datos de pago|mandame.*(?:cuenta|banco|alias)/i
    if (!response.action?.type && paymentKeywords.test(text)) {
      console.log('[PAYMENT_HANDLER] fallback triggered — user asked for payment data')
      const paySettings = await getStorePaymentSettings(sb, storeId, orgId)

      let bankMsg: string
      if (paySettings) {
        bankMsg = formatPaymentSettings(paySettings)
        console.log('[PAYMENT_INFO] fallback sending bank data — alias:', paySettings.alias, 'bank:', paySettings.bank_name)
      } else {
        bankMsg = 'Lo siento, no hay una cuenta bancaria configurada actualmente. Por favor consulta con un asesor.'
        console.log('[PAYMENT_INFO] fallback no active account found')
      }

      // Remove AI's response from history if it mentioned payment info
      if (/(?:paso|mando|envio|doy).*(?:datos|cuenta|alias|banco)/i.test(response.message ?? '')) {
        historyMsgs.pop()
        historyMsgs.pop()
      }

      await saveMessage(conversationId, 'outbound', bankMsg)
      await evoSend(phone, bankMsg)
      await updateContext(conversationId, ctx)
      return NextResponse.json({ ok: true })
    }

    // ── Add to existing order ──────────────────────────────────
    if (response.action?.type === 'add_to_order' && ctx.activeOrderId) {
      console.log('[WEBHOOK] add_to_order received', 'orderId:', ctx.activeOrderId, 'items:', JSON.stringify(response.action.items))

      // Check order is in editable status
      const { data: orderCheck } = await sb.from('orders')
        .select('status').eq('id', ctx.activeOrderId).single()
      const NON_EDITABLE = ['shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'expired']
      if (orderCheck && NON_EDITABLE.includes(orderCheck.status)) {
        const errMsg = `El pedido ya está "${orderCheck.status}" y no se puede modificar. ¿Querés que te prepare un pedido nuevo con esos productos?`
        historyMsgs.push({ role: 'assistant', content: errMsg })
        await saveMessage(conversationId, 'outbound', errMsg)
        await evoSend(phone, errMsg)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      const items = response.action.items ?? []
      if (items.length === 0) {
        const errMsg = 'No entendí qué producto querés agregar. ¿Me decís nombre, talle y color?'
        historyMsgs.push({ role: 'assistant', content: errMsg })
        await saveMessage(conversationId, 'outbound', errMsg)
        await evoSend(phone, errMsg)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      // Look up variant for each item — track successfully inserted ones
      let itemsInserted = 0
      const insertedNames: string[] = []

      for (const item of items) {
        const resolved = resolveProductVariant(products, item)
        if (!resolved) {
          console.log('[WEBHOOK] add_to_order: product NOT FOUND for', JSON.stringify({ productName: item.productName, productId: item.productId, variantId: item.variantId }), '(available:', products.map((p: any) => p.name).join(', '), ')')
          continue
        }
        const { product: productMatch, variant } = resolved
        console.log('[WEBHOOK] add_to_order: product found', productMatch.name, 'for', item.productName)
        if (!variant) {
          console.log('[WEBHOOK] add_to_order: variant NOT FOUND for', productMatch.name, 'color:', item.color, 'size:', item.size, 'available:', productMatch.variants?.map((v: any) => `${v.color}/${v.size}(${v.is_active ? 'active' : 'inactive'})`).join(', '))
          continue
        }
        console.log('[WEBHOOK] add_to_order: variant found', variant.id, 'color:', variant.color, 'size:', variant.size)

        const unitPrice = variant.price_override ?? productMatch.price
        const { error } = await sb.from('order_items').insert({
          order_id: ctx.activeOrderId,
          variant_id: variant.id,
          product_name: productMatch.name,
          variant_label: [variant.color, variant.size].filter(Boolean).join(' / '),
          quantity: item.quantity ?? 1,
          unit_price: unitPrice,
          total: (item.quantity ?? 1) * unitPrice,
        })
        if (error) {
          console.error('[WEBHOOK] add_to_order insert error:', error)
        } else {
          itemsInserted++
          insertedNames.push(`${productMatch.name} x${item.quantity ?? 1}`)
          console.log('[WEBHOOK] add_to_order: INSERTED', productMatch.name, 'x' + (item.quantity ?? 1))
        }
      }

      if (itemsInserted === 0) {
        const errMsg = 'No encontré ese producto en el catálogo. ¿Podés verificar el nombre? Los productos disponibles son: ' + products.map((p: any) => p.name).join(', ')
        console.log('[WEBHOOK] add_to_order: NO items inserted')
        historyMsgs.push({ role: 'assistant', content: errMsg })
        await saveMessage(conversationId, 'outbound', errMsg)
        await evoSend(phone, errMsg)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      // Recalculate order totals
      const { data: orderItems } = await sb.from('order_items')
        .select('total').eq('order_id', ctx.activeOrderId)
      const newSubtotal = (orderItems ?? []).reduce((sum: number, i: any) => sum + (i.total ?? 0), 0)
      const { data: currentOrder } = await sb.from('orders')
        .select('shipping_cost, discount').eq('id', ctx.activeOrderId).single()
      const newTotal = newSubtotal + (currentOrder?.shipping_cost ?? 0) - (currentOrder?.discount ?? 0)
      await sb.from('orders').update({
        subtotal: newSubtotal,
        total: newTotal,
      }).eq('id', ctx.activeOrderId)
      console.log('[WEBHOOK] add_to_order: totals recalculated', 'subtotal:', newSubtotal, 'total:', newTotal)

      // Record audit event
      await recordOrderEvent(sb, {
        order_id: ctx.activeOrderId,
        type: 'item_added',
        actor_type: 'customer',
        actor_id: ctx.customerId!,
        metadata: { items: insertedNames },
      })

      const okMsg = 'Listo, se agregaron los productos a tu pedido. ¿Algo más o lo dejamos así?'
      historyMsgs.push({ role: 'assistant', content: okMsg })
      await saveMessage(conversationId, 'outbound', okMsg)
      await evoSend(phone, okMsg)
      await updateContext(conversationId, ctx)
      return NextResponse.json({ ok: true })
    }

    // ── Remove from order ──────────────────────────────────
    if (response.action?.type === 'remove_from_order' && ctx.activeOrderId) {
      console.log('[WEBHOOK] remove_from_order received', 'orderId:', ctx.activeOrderId, 'items:', JSON.stringify(response.action.items))

      // Check order is in editable status
      const { data: orderCheck } = await sb.from('orders')
        .select('status').eq('id', ctx.activeOrderId).single()
      const NON_EDITABLE = ['shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'expired']
      if (orderCheck && NON_EDITABLE.includes(orderCheck.status)) {
        const errMsg = 'El pedido ya esta "' + orderCheck.status + '" y no se puede modificar.'
        historyMsgs.push({ role: 'assistant', content: errMsg })
        await saveMessage(conversationId, 'outbound', errMsg)
        await evoSend(phone, errMsg)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      const items = response.action.items ?? []
      if (items.length === 0) {
        const errMsg = 'No entendi que producto queres sacar. Me decis el nombre?'
        historyMsgs.push({ role: 'assistant', content: errMsg })
        await saveMessage(conversationId, 'outbound', errMsg)
        await evoSend(phone, errMsg)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      // Find and delete matching order items
      let itemsRemoved = 0
      const removedNames: string[] = []

      for (const item of items) {
        // Find order_items matching the product name (case-insensitive, partial match)
        const { data: orderItemRows } = await sb.from('order_items')
          .select('id, product_name, variant_id, total')
          .eq('order_id', ctx.activeOrderId)

        const matchingItem = orderItemRows?.find((oi: any) =>
          oi.product_name.toLowerCase().includes(item.productName.toLowerCase())
        )

        if (!matchingItem) {
          console.log('[WEBHOOK] remove_from_order: item NOT FOUND for', item.productName)
          continue
        }

        const { error } = await sb.from('order_items')
          .delete()
          .eq('id', matchingItem.id)

        if (error) {
          console.error('[WEBHOOK] remove_from_order delete error:', error)
        } else {
          console.log('[WEBHOOK] remove_from_order: deleted', matchingItem.product_name)
          itemsRemoved++
          removedNames.push(matchingItem.product_name)
        }
      }

      if (itemsRemoved === 0) {
        const { data: remainingItems } = await sb.from('order_items')
          .select('product_name').eq('order_id', ctx.activeOrderId)
        const productList = remainingItems?.map((i: any) => i.product_name).join(', ') ?? ''
        const errMsg = 'No encontre ese producto en tu pedido. Los productos que tenes son: ' + productList
        historyMsgs.push({ role: 'assistant', content: errMsg })
        await saveMessage(conversationId, 'outbound', errMsg)
        await evoSend(phone, errMsg)
        await updateContext(conversationId, ctx)
        return NextResponse.json({ ok: true })
      }

      // Recalculate order totals
      const { data: currentItems } = await sb.from('order_items')
        .select('total').eq('order_id', ctx.activeOrderId)
      const newSubtotal = (currentItems ?? []).reduce((sum: number, i: any) => sum + (i.total ?? 0), 0)
      const { data: currentOrder } = await sb.from('orders')
        .select('shipping_cost, discount').eq('id', ctx.activeOrderId).single()
      const shippingCost = currentOrder?.shipping_cost ?? 0
      const discount = currentOrder?.discount ?? 0
      const newTotal = newSubtotal + shippingCost - discount
      await sb.from('orders').update({ subtotal: newSubtotal, total: newTotal }).eq('id', ctx.activeOrderId)
      console.log('[WEBHOOK] remove_from_order: totals recalculated', 'subtotal:', newSubtotal, 'total:', newTotal)

      // Record audit event
      await recordOrderEvent(sb, {
        order_id: ctx.activeOrderId,
        type: 'item_removed',
        actor_type: 'customer',
        actor_id: ctx.customerId ?? undefined,
        metadata: { items: removedNames },
      })

      const okMsg = 'Listo, saque del pedido: ' + removedNames.join(', ') + '. Algo mas o lo dejamos asi?'
      historyMsgs.push({ role: 'assistant', content: okMsg })
      await saveMessage(conversationId, 'outbound', okMsg)
      await evoSend(phone, okMsg)
      await updateContext(conversationId, ctx)
      return NextResponse.json({ ok: true })
    }

    // ── Fallback: detect add-to-order intent from AI message ─────
    // If the AI said it added items but didn't generate the action,
    // try to extract from conversation history.
    if (ctx.activeOrderId && !response.action) {
      const aiMsg = response.message?.toLowerCase() ?? ''
      const userMsg = text.toLowerCase()
      const addKeywords = /(agregad|agrego|agrega|sumad|sumo|anadid|agregue|sume|qued[oó]).*(pedido|orden)/i
      const confirmWords = /^(s[ií]|si|dale|ok|confirmo|perfecto)\b/i

      if ((addKeywords.test(aiMsg) && confirmWords.test(userMsg)) ||
          (addKeywords.test(aiMsg) && /agregar|sumar|anadir|pon(e|é)/i.test(userMsg))) {
        console.log('[WEBHOOK] add_to_order fallback triggered', 'user:', text.slice(0, 80), 'ai:', aiMsg.slice(0, 80))

        const historyText = (ctx.history ?? [])
          .filter(h => h.role === 'user')
          .slice(-5)
          .map(h => h.content.toLowerCase())
          .join(' ')

        const searchText = (historyText + ' ' + text.toLowerCase())
        const guessedName = products.find((p: any) =>
          p.name && searchText.includes(p.name.toLowerCase())
        )?.name

        if (guessedName) {
          console.log('[WEBHOOK] add_to_order fallback: found product', guessedName)
          // Try to match color/size from conversation history
          const histText = ((ctx.history ?? []).map( function(h: any) { return h.content; } ).join(' ') + ' ' + text).toLowerCase()
          const colorMatch = histText.match(/\b(blanco|negro|gris|azul|rojo|verde|amarillo|rosa|celeste|marron|beige|violeta|naranja)\b/i)
          const sizeMatch = histText.match(/\b([sml]|xl|xxl|xxxl|unico)\b/i)

          const fallbackItem: any = { productName: guessedName }
          if (colorMatch) fallbackItem.color = normalizeColor(colorMatch[1])
          if (sizeMatch) fallbackItem.size = sizeMatch[1].toLowerCase()

          const resolved = resolveProductVariant(products, fallbackItem)
          let matchedProduct: any = null
          if (resolved) {
            matchedProduct = resolved.product
            const variant = resolved.variant
            const unitPrice = variant.price_override ?? matchedProduct.price
            const { error } = await sb.from('order_items').insert({
              order_id: ctx.activeOrderId,
              variant_id: variant.id,
              product_name: matchedProduct.name,
              variant_label: [variant.color, variant.size].filter(Boolean).join(' / '),
              quantity: 1,
              unit_price: unitPrice,
              total: unitPrice,
            })
            if (error) {
              console.error('[WEBHOOK] add_to_order fallback insert error:', error)
            } else {
              console.log('[WEBHOOK] add_to_order fallback: item inserted')

              const { data: orderItems } = await sb.from('order_items')
                .select('total').eq('order_id', ctx.activeOrderId)
              const newSubtotal = (orderItems ?? []).reduce((sum, i) => sum + (i.total ?? 0), 0)
              const { data: currentOrder } = await sb.from('orders')
                .select('shipping_cost, discount').eq('id', ctx.activeOrderId).single()
              const newTotal = newSubtotal + (currentOrder?.shipping_cost ?? 0) - (currentOrder?.discount ?? 0)
              await sb.from('orders').update({ subtotal: newSubtotal, total: newTotal }).eq('id', ctx.activeOrderId)
              console.log('[WEBHOOK] add_to_order fallback: totals recalculated', 'subtotal:', newSubtotal, 'total:', newTotal)

              await recordOrderEvent(sb, {
                order_id: ctx.activeOrderId,
                type: 'item_added',
                actor_type: 'customer',
                actor_id: ctx.customerId,
                metadata: { items: [matchedProduct.name], source: 'fallback' },
              })

              // Fallback succeeded — send the AI's response (it already said it added the item)
              // and return early to prevent falling through to safety check
              await saveMessage(conversationId, 'outbound', response.message!)
              await evoSend(phone, response.message!)
              await updateContext(conversationId, ctx)
              return NextResponse.json({ ok: true })
            }
          } else {
            console.log('[WEBHOOK] add_to_order fallback: no active variant with stock for', matchedProduct.name, 'variants:', matchedProduct.variants?.map((v: any) => `${v.color}/${v.size} stock:${v.stock} active:${v.is_active}`).join(', '))
          }
        } else {
          console.log('[WEBHOOK] add_to_order fallback: no product match in history', 'search:', searchText.slice(0, 100), 'products:', products.map((p: any) => p.name).join(', '))
        }
      }
    }

    // Safety check: never send raw JSON or empty message to customer
    let safeMessage = response.message?.trim()
    if (!safeMessage || safeMessage.startsWith('{') || safeMessage.startsWith('[')) {
      console.log('[WEBHOOK] SAFETY: blocked raw/empty message from leaking: ' + JSON.stringify(safeMessage?.slice(0, 120)))
      safeMessage = 'Dale, decime cómo puedo ayudarte.'
    }
    await saveMessage(conversationId, 'outbound', safeMessage)
    await evoSend(phone, safeMessage)
    await updateContext(conversationId, ctx)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp Webhook]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conversationId) {
      releaseConversationLock(ctx)
      // Persist lock release to DB so the next webhook sees it
      await updateContext(conversationId, ctx).catch(() => {})
    }
  }
}

function getFirstQuestion(state: string): string {
  switch (state) {
    case 'name': return 'Perfecto, ¿me decís tu nombre completo?'
    case 'dni': return 'Gracias. ¿Cuál es tu DNI?'
    case 'shipping': return '¿Cómo preferís recibirlo? ¿Envío a domicilio o retiro por el local?'
    case 'address': return '¿Cuál es tu dirección completa? Incluí localidad si querés.'
    case 'payment_method': return '¿Cómo preferís pagar? ¿Transferencia bancaria o efectivo contra entrega?'
    default: return 'Decime, ¿qué más necesitás?'
  }
}
