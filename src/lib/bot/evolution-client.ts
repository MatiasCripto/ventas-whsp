// Evolution API client — wraps HTTP calls to the Evolution API instance
import type { SendTextPayload } from '@/lib/types/whatsapp.types'

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'concierge'

async function evolutionFetch(path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API error: ${err}`)
  }
  return res.json()
}

export async function sendText(phone: string, text: string, delay = 1200) {
  const payload: SendTextPayload = {
    number: phone,
    textMessage: { text },
    options: { delay, presence: 'composing' },
  }
  return evolutionFetch(`/message/sendText/${INSTANCE}`, payload)
}

export async function sendMultiple(phone: string, messages: string[], delayBetween = 1500) {
  for (const msg of messages) {
    await sendText(phone, msg, delayBetween)
  }
}

export async function markAsRead(jid: string, messageId: string) {
  return evolutionFetch(`/message/markMessageAsRead/${INSTANCE}`, {
    readMessages: [{ remoteJid: jid, fromMe: false, id: messageId }],
  })
}

export async function getQrCode() {
  const res = await fetch(`${BASE_URL}/instance/connect/${INSTANCE}`, {
    headers: { apikey: API_KEY },
  })
  return res.json()
}

export async function getInstanceStatus() {
  const res = await fetch(`${BASE_URL}/instance/connectionState/${INSTANCE}`, {
    headers: { apikey: API_KEY },
  })
  return res.json()
}

// ── Media / Image helpers ───────────────────────────────────

export async function sendImage(
  phone: string,
  imageUrl: string,
  caption?: string,
  delay = 1200,
) {
  return evolutionFetch(`/message/sendMedia/${INSTANCE}`, {
    number: phone,
    mediaMessage: {
      mediatype: 'image',
      media: imageUrl,
      caption: caption ?? '',
    },
    options: { delay, presence: 'composing' },
  })
}

/**
 * Download media from Evolution API by message key.
 * Returns raw ArrayBuffer for upload to Supabase Storage.
 */
export async function downloadMedia(
  remoteJid: string,
  messageId: string,
): Promise<ArrayBuffer | null> {
  try {
    const url = `${BASE_URL}/chat/getMedia/${INSTANCE}?msgKey=${messageId}&remoteJid=${encodeURIComponent(remoteJid)}`
    const res = await fetch(url, {
      headers: { apikey: API_KEY },
    })
    if (!res.ok) {
      console.error('[Evolution] downloadMedia error:', res.status)
      return null
    }
    return res.arrayBuffer()
  } catch (err) {
    console.error('[Evolution] downloadMedia exception:', err)
    return null
  }
}
