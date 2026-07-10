// ── WhatsApp webhook payload validators ──────────────────────
// HMAC signature verification, rate limiting, and payload parsing.
//
// HMAC verification: if the signature header IS present, it MUST be valid.
// Missing header is allowed (Evolution API global webhook doesn't send it).
// WEBHOOK_SECRET must be configured for when the header is present.

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { logger } from '@/lib/logger'
import type { EvolutionWebhookPayload, EvolutionMessageData } from '@/lib/types/whatsapp.types'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Startup validation
if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'placeholder') {
	if (IS_PRODUCTION) {
		logger.error('SECURITY: WEBHOOK_SECRET not configured — all webhooks rejected with 401')
	} else {
		logger.warn('HMAC: WEBHOOK_SECRET not configured — verification disabled in development')
	}
}

export interface ValidatedPayload {
	payload: EvolutionWebhookPayload
	rawBody: string
	phone: string
	text: string
	pushName?: string
	msgId?: string
}

/**
 * HMAC-SHA256 verification of Evolution API webhook payload.
 *
 * Production: REQUIRED — rejects if WEBHOOK_SECRET unset or header missing.
 * Development: OPTIONAL — missing header logs a warning but passes.
 *              If header IS present, it MUST be valid (catches config mistakes early).
 */
function verifySignature(rawBody: string, signatureHeader: string | null): { ok: boolean; reason?: string } {
	// WEBHOOK_SECRET not configured
	if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'placeholder') {
		if (IS_PRODUCTION) {
			return { ok: false, reason: 'WEBHOOK_SECRET not configured' }
		}
		return { ok: true } // dev: skip verification
	}

	// Missing signature header
	if (!signatureHeader) {
		logger.warn('HMAC: missing x-evolution-signature header — allowing request (no signature verification)')
		return { ok: true }
	}

	// Verify HMAC
	try {
		const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
		const match = expected === signatureHeader
		if (!match) {
			return { ok: false, reason: 'HMAC signature mismatch' }
		}
		return { ok: true }
	} catch (err) {
		return { ok: false, reason: `HMAC verification error: ${err}` }
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
	const sigResult = verifySignature(rawBody, req.headers.get('x-evolution-signature'))
	if (!sigResult.ok) {
		logger.warn('HMAC verification failed', { reason: sigResult.reason })
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
		logger.info('skip: no phone or text', { phone, hasText: !!text })
		return { ok: false, response: NextResponse.json({ ok: true }) }
	}

	// 6. Rate limit: 30 messages per minute per phone
	const rateCheck = await checkRateLimit(`webhook:${phone}`, { windowMs: 60_000, maxHits: 30 })
	if (!rateCheck.allowed) {
		logger.warn('rate limit exceeded', { phone })
		return { ok: false, response: NextResponse.json({ error: 'Too many requests' }, { status: 429 }) }
	}

	return {
		ok: true,
		data: { payload, rawBody, phone, text, pushName, msgId },
	}
}
