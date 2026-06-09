// ── WhatsApp webhook payload validators ──────────────────────
// HMAC signature verification, rate limiting, and payload parsing.

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import type { EvolutionWebhookPayload, EvolutionMessageData } from '@/lib/types/whatsapp.types'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export interface ValidatedPayload {
  payload: EvolutionWebhookPayload
  rawBody: string
  phone: string
  text: string
  pushName?: string
  msgId?: string
}

/**
 * Optional HMAC-SHA256 verification of Evolution API webhook payload.
 * Only enforces when WEBHOOK_SECRET is set AND x-evolution-signature header is present.
 */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'placeholder') return true
  if (!signatureHeader) {
    console.warn('[WEBHOOK] WEBHOOK_SECRET set but no x-evolution-signature header — allowing')
    return true
  }
  try {
    const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
    return expected === signatureHeader
  } catch (err) {
    console.error('[WEBHOOK] HMAC verification error:', err)
    return false
  }
}

export async function validateWebhookPayload(req: NextRequest): Promise<
  { ok: true; data: ValidatedPayload } | { ok: false; response: NextResponse }
> {
  // 1. Read raw body for HMAC
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Cannot read body' }, { status: 400 }) }
  }

  // 2. Verify HMAC signature
  if (!verifySignature(rawBody, req.headers.get('x-evolution-signature'))) {
    console.warn('[WEBHOOK] HMAC verification failed — rejecting')
    return { ok: false, response: NextResponse.json({ error: 'Invalid signature' }, { status: 401 }) }
  }

  // 3. Parse JSON payload
  let payload: EvolutionWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  }

  // 4. Filter events
  if (payload.event !== 'messages.upsert') {
    return { ok: false, response: NextResponse.json({ ok: true }) }
  }

  const data = payload.data as EvolutionMessageData
  if (data.key?.fromMe) {
    return { ok: false, response: NextResponse.json({ ok: true }) }
  }

  // 5. Extract phone and text
  // Handle @lid JID format (LinkedIn Device ID) by falling back to top-level sender field
  let jid = data.key?.remoteJid ?? ''
  let phone = jid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '').replace(/@lid$/, '')
  // If @lid format produced no extractable number, use the top-level sender field
  if (!phone || jid.endsWith('@lid')) {
    const senderJid = (payload as any).sender ?? ''
    phone = senderJid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '') || phone
    if (senderJid) jid = senderJid // prefer sender JID for downstream use
  }
  const text = data.message?.conversation || data.message?.extendedTextMessage?.text || ''
  const pushName = data.pushName
  const msgId = data.key?.id

  if (!phone || !text) {
    console.log('[WEBHOOK] skip: no phone or text', { phone, hasText: !!text })
    return { ok: false, response: NextResponse.json({ ok: true }) }
  }

  // 6. Rate limit: 30 messages per minute per phone
  const rateCheck = checkRateLimit(`webhook:${phone}`, { windowMs: 60_000, maxHits: 30 })
  if (!rateCheck.allowed) {
    console.warn('[WEBHOOK] rate limit exceeded for', phone)
    return { ok: false, response: NextResponse.json({ error: 'Too many requests' }, { status: 429 }) }
  }

  return {
    ok: true,
    data: { payload, rawBody, phone, text, pushName, msgId },
  }
}
