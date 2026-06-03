// ── WhatsApp Payment Proof Media Handler ─────────────────────
// Handles incoming images when there is an active order.

import { NextResponse } from 'next/server'
import type { BotContext } from '@/lib/types/whatsapp.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadPaymentProof } from '@/lib/bot/storage-service'
import { createPaymentProof } from '@/lib/bot/payment-proof-service'
import { recordOrderEvent } from '@/lib/services/order-event.service'
import { processPaymentProofOcr } from '@/lib/workflows/payment-proof-ocr.workflow'
import { saveMessage, updateContext } from '@/lib/bot/conversation-engine'

interface MediaHandlerParams {
  sb: SupabaseClient
  ctx: BotContext
  conversationId: string
  phone: string
  orgId: string
  storeId: string
  jid: string
  msgId: string
  evoDownload: (jid: string, msgId: string) => Promise<ArrayBuffer | null>
  evoSend: (phone: string, text: string) => Promise<any>
}

export async function handleMediaMessage(params: MediaHandlerParams): Promise<NextResponse> {
  const { sb, ctx, conversationId, phone, orgId, storeId, jid, msgId, evoDownload, evoSend } = params

  // Download the image from Evolution API
  const imageBuffer = await evoDownload(jid, msgId)
  if (!imageBuffer) {
    await evoSend(phone, 'No pude descargar la imagen. ¿Podés intentar de nuevo?')
    return NextResponse.json({ ok: true })
  }

  // Upload to Supabase Storage
  const imageUrl = await uploadPaymentProof(sb, ctx.activeOrderId!, ctx.customerId!, imageBuffer, `proof_${Date.now()}.jpg`)
  if (!imageUrl) {
    await evoSend(phone, 'No pude guardar la imagen. ¿Podés intentar de nuevo?')
    return NextResponse.json({ ok: true })
  }

  // Create payment_proof record
  const createdProof = await createPaymentProof(sb, {
    organization_id: orgId,
    store_id: storeId,
    order_id: ctx.activeOrderId!,
    customer_id: ctx.customerId!,
    image_url: imageUrl,
  })

  // Record audit event
  await recordOrderEvent(sb, {
    order_id: ctx.activeOrderId!,
    type: 'proof_received',
    actor_type: 'customer',
    actor_id: ctx.customerId!,
  })

  // Trigger OCR processing (fire-and-forget)
  if (createdProof?.id) {
    processPaymentProofOcr({ proofId: createdProof.id, imageUrl }).catch(err =>
      console.error('[WEBHOOK] OCR background error:', err)
    )
  }

  // Update order status
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
